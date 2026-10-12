const $ = (id) => document.getElementById(id);
let original = null,
  current = null,
  page = 1;
const PAGE = 8;
let toastTimer;
function toast(s) {
  const el = $("toast");
  el.textContent = s;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
function parseCSV(text) {
  let rows = [],
    row = [],
    cell = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
function missing(v) {
  return (
    v == null ||
    ["", "na", "n/a", "null", "none", "undefined", "-"].includes(
      String(v).trim().toLowerCase(),
    )
  );
}
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function scan(d) {
  let miss = 0,
    dups = 0,
    seen = new Set();
  d.rows.forEach((r) =>
    d.headers.forEach((_, i) => {
      if (missing(r[i])) miss++;
    }),
  );
  d.rows.forEach((r) => {
    let k = JSON.stringify(r);
    if (seen.has(k)) dups++;
    else seen.add(k);
  });
  let cells = d.rows.length * d.headers.length;
  return {
    miss,
    dups,
    complete: cells ? Math.round(((cells - miss) / cells) * 100) : 100,
  };
}
function setData(headers, rows, name, size) {
  if (!headers.length) {
    toast("No headers found in this CSV.");
    return;
  }
  headers = headers.map((h, i) => String(h).trim() || `Column ${i + 1}`);
  rows = rows.map((r) => headers.map((_, i) => r[i] ?? ""));
  original = { headers, rows: rows.map((r) => [...r]), name, size };
  current = {
    headers: [...headers],
    rows: rows.map((r) => [...r]),
    name,
    size,
  };
  page = 1;
  $("empty").hidden = true;
  $("tableWrap").hidden = false;
  $("tableFoot").hidden = false;
  $("clean").disabled = false;
  $("download").disabled = false;
  $("report").hidden = true;
  $("fileBadge").textContent =
    name.length > 20 ? name.slice(0, 17) + "…" : name.toUpperCase();
  $("datasetInfo").textContent = `${name} · Original dataset loaded`;
  populateColumns();
  render();
  toast(`Loaded ${name}`);
}
function populateColumns() {
  $("column").innerHTML =
    '<option value="all">All columns</option>' +
    current.headers
      .map((h, i) => `<option value="${i}">${esc(h)}</option>`)
      .join("");
}
$("importBtn").onclick =
  $("emptyImport").onclick =
  $("navImport").onclick =
    () => $("file").click();
$("file").addEventListener("change", async (e) => {
  let f = e.target.files[0];
  if (!f) return;
  if (!f.name.toLowerCase().endsWith(".csv")) {
    toast("Please select a CSV file.");
    e.target.value = "";
    return;
  }
  try {
    let parsed = parseCSV(await f.text());
    setData(parsed[0] || [], parsed.slice(1), f.name, f.size);
  } catch (err) {
    toast("Could not read this CSV file.");
  } finally {
    e.target.value = "";
  }
});
function sample() {
  let h = ["Customer ID", "Name", "City", "Age", "Order Value"],
    r = [
      ["101", " Aanya Sharma ", "Delhi", "24", "1200"],
      ["102", "Kabir Mehta", "Mumbai", "29", "2500"],
      ["103", "Riya Verma", "Delhi", "", "1800"],
      ["104", "Dev Patel", "Pune", "31", ""],
      ["105", "Aanya Sharma", "Delhi", "24", "1200"],
      ["106", "Ishaan Roy", "Kolkata", "27", "950"],
      ["107", "Meera Iyer", "Chennai", "NA", "1400"],
      ["108", "Arjun Singh", "Jaipur", "22", "1100"],
      ["109", "Sara Khan", "Mumbai", "26", "1750"],
      ["110", "Neil Das", "Pune", "28", "1300"],
      ["111", "  ", "Bengaluru", "30", "900"],
      ["112", "Tara Joshi", "Delhi", "25", "N/A"],
    ];
  setData(
    h,
    r,
    "sample_customers.csv",
    new Blob([h.join(",") + "\n" + r.map((x) => x.join(",")).join("\n")]).size,
  );
}
$("sample").onclick = sample;
function render() {
  if (!current) return;
  let s = scan(current);
  $("records").textContent = current.rows.length.toLocaleString();
  $("recordHint").textContent =
    `${current.headers.length} columns in ${current.name}`;
  $("missing").textContent = s.miss.toLocaleString();
  $("missingHelp").textContent = `${s.miss} missing cells found`;
  $("duplicates").textContent = s.dups.toLocaleString();
  $("duplicateHelp").textContent = `${s.dups} duplicate rows found`;
  $("complete").textContent = s.complete + "%";
  $("bar").style.width = s.complete + "%";
  let q = $("search").value.toLowerCase().trim(),
    col = $("column").value;
  let rows = current.rows
    .map((r, i) => ({ r, i }))
    .filter((o) =>
      o.r.some(
        (v, i) =>
          (col === "all" || +col === i) &&
          String(v ?? "")
            .toLowerCase()
            .includes(q),
      ),
    );
  let max = Math.max(1, Math.ceil(rows.length / PAGE));
  page = Math.min(page, max);
  let start = (page - 1) * PAGE,
    shown = rows.slice(start, start + PAGE);
  $("table").innerHTML =
    "<thead><tr>" +
    current.headers.map((h) => `<th>${esc(h)}</th>`).join("") +
    "</tr></thead><tbody>" +
    shown
      .map(
        (o) =>
          "<tr>" +
          current.headers
            .map((_, i) => {
              let v = o.r[i] ?? "";
              return `<td class="${missing(v) ? "missing-cell" : ""}">${missing(v) ? String(v).trim() || "Missing" : esc(v)}</td>`;
            })
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody>";
  $("rowSummary").textContent =
    `Showing ${rows.length ? start + 1 : 0}–${Math.min(start + PAGE, rows.length)} of ${rows.length} matching records`;
  $("pageInfo").textContent = `${page} / ${max}`;
  $("prev").disabled = page <= 1;
  $("next").disabled = page >= max;
}
$("search").oninput = () => {
  page = 1;
  render();
};
$("column").onchange = () => {
  page = 1;
  render();
};
$("prev").onclick = () => {
  page--;
  render();
};
$("next").onclick = () => {
  page++;
  render();
};
$("reset").onclick = () => {
  if (!original) return toast("Load a dataset first.");
  current = {
    headers: [...original.headers],
    rows: original.rows.map((r) => [...r]),
    name: original.name,
    size: original.size,
  };
  $("search").value = "";
  $("column").value = "all";
  page = 1;
  $("report").hidden = true;
  $("datasetInfo").textContent = `${original.name} · Original dataset restored`;
  render();
  toast("Original dataset restored.");
};
$("clean").onclick = () => {
  if (!current) return;
  let before = scan(current),
    beforeRows = current.rows.length,
    action = $("missingAction").value,
    fill = $("fillValue").value,
    rows = current.rows.map((r) => [...r]),
    filled = 0,
    removedMissing = 0,
    trimmed = 0,
    normalized = 0,
    removedDuplicates = 0;
  if ($("trim").checked)
    rows = rows.map((r) =>
      r.map((v) => {
        let n = String(v ?? "").trim();
        if (n !== String(v ?? "")) trimmed++;
        return n;
      }),
    );
  if ($("normalize").checked)
    rows = rows.map((r) =>
      r.map((v) => {
        if (missing(v) && String(v ?? "").trim() !== "") {
          normalized++;
          return "";
        }
        return v;
      }),
    );
  if (action === "remove") {
    let kept = rows.filter((r) => !r.some(missing));
    removedMissing = rows.length - kept.length;
    rows = kept;
  } else if (action === "fill")
    rows = rows.map((r) =>
      r.map((v) => {
        if (missing(v)) {
          filled++;
          return fill;
        }
        return v;
      }),
    );
  else if (["mean", "median", "mode"].includes(action)) {
    current.headers.forEach((_, c) => {
      let vals = rows.map((r) => r[c]).filter((v) => !missing(v)),
        numeric = vals.length && vals.every((v) => Number.isFinite(Number(v))),
        replacement = "";
      if (action === "mean" && numeric)
        replacement = String(
          vals.reduce((a, v) => a + Number(v), 0) / vals.length,
        );
      if (action === "median" && numeric) {
        let a = vals.map(Number).sort((a, b) => a - b),
          m = Math.floor(a.length / 2);
        replacement = String(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2);
      }
      if (action === "mode") {
        let freq = {};
        vals.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
        replacement =
          Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] ?? "";
      }
      if (replacement !== "")
        rows.forEach((r) => {
          if (missing(r[c])) {
            r[c] = replacement;
            filled++;
          }
        });
    });
  }
  if ($("removeDuplicates").checked) {
    let seen = new Set();
    rows = rows.filter((r) => {
      let k = JSON.stringify(r);
      if (seen.has(k)) {
        removedDuplicates++;
        return false;
      }
      seen.add(k);
      return true;
    });
  }
  current.rows = rows;
  $("datasetInfo").textContent = `${current.name} · Cleaned version`;
  $("report").hidden = false;
  let after = scan(current),
    items = [
      [
        "Rows removed",
        removedMissing + removedDuplicates,
        `${removedMissing} missing · ${removedDuplicates} duplicate`,
      ],
      ["Values filled", filled, "Missing cells replaced"],
      ["Whitespace fixed", trimmed, "Text values trimmed"],
      ["Markers normalized", normalized, "NA/null-style markers cleared"],
      ["Missing cells left", after.miss, "Remaining missing values"],
      ["Completeness", after.complete + "%", `Before: ${before.complete}%`],
      ["Records remaining", current.rows.length, `Before: ${beforeRows}`],
      ["Duplicate rows left", after.dups, "Exact repeated records"],
    ];
  $("reportGrid").innerHTML = items
    .map(
      (a) =>
        `<div class="report-item"><span>${esc(a[0])}</span><strong>${esc(a[1])}</strong><p>${esc(a[2])}</p></div>`,
    )
    .join("");
  page = 1;
  render();
  $("report").scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Dataset cleaned successfully.");
};
$("download").onclick = () => {
  if (!current) return;
  let csv = [current.headers, ...current.rows]
      .map((r) =>
        r
          .map((v) => {
            let s = String(v ?? "");
            return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(","),
      )
      .join("\r\n"),
    url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = current.name.replace(/\.csv$/i, "") + "_cleaned.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Cleaned CSV download started.");
};
$("navTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
$("navTools").onclick = () => {
  if (!current) toast("Import a dataset to begin cleaning.");
  $("cleaningTools").scrollIntoView({ behavior: "smooth", block: "start" });
};
