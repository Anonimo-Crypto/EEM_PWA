/* =========================================================
   EEM – Earnings and Expenses Monitor
   v1.0.0
   ========================================================= */

(function () {
  "use strict";

  // ---------- Storage keys ----------
  const KEY_CATS = "eem_categories";
  const KEY_HIST = "eem_history";
  const KEY_THEME = "eem_theme";

  // ---------- State ----------
  let categories = [];
  let history = [];
  let editingCatId = null;
  let pieChart = null;
  let barChart = null;

  // Colors palette for categories
  const COLORS = [
    "#0d9488", "#3b82f6", "#8b5cf6", "#ec4899",
    "#f59e0b", "#10b981", "#ef4444", "#06b6d4",
    "#6366f1", "#84cc16", "#f97316", "#14b8a6"
  ];

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function formatMoney(n) {
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function formatDate(str) {
    if (!str) return "—";
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }

  function toast(msg, ms = 2600) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  function load() {
    try {
      categories = JSON.parse(localStorage.getItem(KEY_CATS) || "[]");
      history = JSON.parse(localStorage.getItem(KEY_HIST) || "[]");
    } catch (e) {
      categories = [];
      history = [];
    }
  }

  function save() {
    localStorage.setItem(KEY_CATS, JSON.stringify(categories));
    localStorage.setItem(KEY_HIST, JSON.stringify(history));
  }

  function getTotalPct() {
    return categories.reduce((s, c) => s + (parseFloat(c.pct) || 0), 0);
  }

  function getColor(i) {
    return COLORS[i % COLORS.length];
  }

  // Date helpers for filters
  function startOfWeek(d = new Date()) {
    const day = d.getDay(); // 0 Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function startOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function inRange(dateStr, from, to) {
    return dateStr >= from && dateStr <= to;
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY_THEME, theme);
    const sun = document.getElementById("iconSun");
    const moon = document.getElementById("iconMoon");
    if (theme === "dark") {
      sun.classList.add("hidden");
      moon.classList.remove("hidden");
    } else {
      sun.classList.remove("hidden");
      moon.classList.add("hidden");
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(KEY_THEME) ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(saved);
  }

  // ---------- Navigation ----------
  function switchTab(name) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const panel = document.getElementById("panel-" + name);
    if (panel) panel.classList.add("active");
    const nav = document.querySelector(`.nav-item[data-tab="${name}"]`);
    if (nav) nav.classList.add("active");

    if (name === "charts") updateCharts();
    if (name === "hist") renderHistory();
    if (name === "hoy") renderPreview();
    if (name === "cats") renderCategories();
  }

  // ---------- Categories UI ----------
  function renderCategories() {
    const list = document.getElementById("catList");
    const totalEl = document.getElementById("pctTotal");
    const total = getTotalPct();

    totalEl.textContent = `Total: ${total.toFixed(1)} % ${total === 100 ? "✓" : "(debe ser 100 %)"}`;
    totalEl.className = "pct-total " + (Math.abs(total - 100) < 0.05 ? "ok" : "bad");

    if (!categories.length) {
      list.innerHTML = `<li class="empty-state" style="padding:24px;">No hay categorías. Añade al menos una.</li>`;
      return;
    }

    list.innerHTML = categories.map((c, i) => `
      <li class="cat-item" data-id="${c.id}">
        <span class="cat-color" style="background:${getColor(i)}"></span>
        <div class="cat-info">
          <div class="cat-name">${escapeHtml(c.name)}</div>
          <div class="cat-pct">${c.pct} %</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}" title="Editar">✎</button>
        <button class="btn btn-ghost btn-sm" data-del="${c.id}" title="Eliminar">✕</button>
      </li>
    `).join("");
  }

  function openCatModal(id = null) {
    editingCatId = id;
    const modal = document.getElementById("modalCat");
    const title = document.getElementById("modalCatTitle");
    const nameIn = document.getElementById("catName");
    const pctIn = document.getElementById("catPct");

    if (id) {
      const cat = categories.find(c => c.id === id);
      title.textContent = "Editar categoría";
      nameIn.value = cat.name;
      pctIn.value = cat.pct;
    } else {
      title.textContent = "Nueva categoría";
      nameIn.value = "";
      pctIn.value = "";
    }
    modal.classList.add("open");
    nameIn.focus();
  }

  function closeCatModal() {
    document.getElementById("modalCat").classList.remove("open");
    editingCatId = null;
  }

  function saveCategory() {
    const name = document.getElementById("catName").value.trim();
    const pct = parseFloat(document.getElementById("catPct").value);

    if (!name) {
      toast("Escribe un nombre");
      return;
    }
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast("Porcentaje inválido (0-100)");
      return;
    }

    if (editingCatId) {
      const cat = categories.find(c => c.id === editingCatId);
      if (cat) {
        cat.name = name;
        cat.pct = pct;
      }
    } else {
      categories.push({ id: uid(), name, pct });
    }
    save();
    closeCatModal();
    renderCategories();
    renderPreview();
    toast(editingCatId ? "Categoría actualizada" : "Categoría añadida");
  }

  function deleteCategory(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    categories = categories.filter(c => c.id !== id);
    save();
    renderCategories();
    renderPreview();
    toast("Categoría eliminada");
  }

  // ---------- Today / Preview ----------
  function renderPreview() {
    const list = document.getElementById("previewList");
    const badge = document.getElementById("pctBadge");
    const total = getTotalPct();
    badge.textContent = total.toFixed(1) + " %";

    const earnings = parseFloat(document.getElementById("inputEarnings").value) || 0;

    if (!categories.length) {
      list.innerHTML = `<li class="empty-state" style="padding:20px;">Añade categorías primero</li>`;
      return;
    }

    list.innerHTML = categories.map((c, i) => {
      const amount = (earnings * (c.pct / 100));
      return `
        <li class="cat-item">
          <span class="cat-color" style="background:${getColor(i)}"></span>
          <div class="cat-info">
            <div class="cat-name">${escapeHtml(c.name)}</div>
            <div class="cat-pct">${c.pct} %</div>
          </div>
          <div class="cat-amount">${formatMoney(amount)}</div>
        </li>
      `;
    }).join("");
  }

  function saveToday() {
    const earnings = parseFloat(document.getElementById("inputEarnings").value);
    if (isNaN(earnings) || earnings < 0) {
      toast("Introduce una cantidad válida");
      return;
    }
    if (categories.length === 0) {
      toast("Primero crea al menos una categoría");
      return;
    }
    const total = getTotalPct();
    if (Math.abs(total - 100) > 0.05) {
      toast("Los porcentajes deben sumar exactamente 100 %");
      return;
    }

    const date = todayStr();
    const distributions = {};
    categories.forEach(c => {
      distributions[c.id] = +(earnings * (c.pct / 100)).toFixed(2);
    });

    // Snapshot of categories at save time (name + pct) for history integrity
    const catsSnapshot = categories.map(c => ({
      id: c.id,
      name: c.name,
      pct: c.pct
    }));

    const existingIdx = history.findIndex(h => h.date === date);
    const entry = {
      date,
      earnings: +earnings.toFixed(2),
      distributions,
      categories: catsSnapshot
    };

    if (existingIdx >= 0) {
      if (!confirm("Ya hay un registro para hoy. ¿Sobrescribir?")) return;
      history[existingIdx] = entry;
    } else {
      history.push(entry);
    }

    history.sort((a, b) => a.date.localeCompare(b.date));
    save();
    updateStats();
    renderHistory();
    toast("Gastos guardados ✓");
  }

  // ---------- Stats & Estimates ----------
  function updateStats() {
    if (!history.length) {
      document.getElementById("statDaily").textContent = "—";
      document.getElementById("statWeekly").textContent = "—";
      document.getElementById("statMonthly").textContent = "—";
      document.getElementById("statEstimate").textContent = "—";
      return;
    }

    const totalEarnings = history.reduce((s, h) => s + h.earnings, 0);
    const days = history.length;
    const avgDaily = totalEarnings / days;

    // Approximate weekly: avgDaily * 7
    const avgWeekly = avgDaily * 7;
    // Approximate monthly: avgDaily * 30.44
    const avgMonthly = avgDaily * 30.44;

    // Current month estimate based on days so far this month
    const now = new Date();
    const thisMonth = history.filter(h => {
      const d = new Date(h.date + "T12:00:00");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    let estimate = "—";
    if (thisMonth.length > 0) {
      const monthSum = thisMonth.reduce((s, h) => s + h.earnings, 0);
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projected = (monthSum / dayOfMonth) * daysInMonth;
      estimate = formatMoney(projected);
    }

    document.getElementById("statDaily").textContent = formatMoney(avgDaily);
    document.getElementById("statWeekly").textContent = formatMoney(avgWeekly);
    document.getElementById("statMonthly").textContent = formatMoney(avgMonthly);
    document.getElementById("statEstimate").textContent = estimate;
  }

  // ---------- History ----------
  function getFilteredHistory() {
    const filter = document.getElementById("histFilter").value;
    const now = new Date();
    const today = todayStr();

    if (filter === "day") {
      return history.filter(h => h.date === today);
    }
    if (filter === "week") {
      const start = startOfWeek(now);
      const startStr = start.toISOString().slice(0, 10);
      return history.filter(h => h.date >= startStr && h.date <= today);
    }
    if (filter === "month") {
      const start = startOfMonth(now);
      const startStr = start.toISOString().slice(0, 10);
      return history.filter(h => h.date >= startStr && h.date <= today);
    }
    return [...history].reverse(); // newest first
  }

  function renderHistory() {
    const body = document.getElementById("histBody");
    const empty = document.getElementById("histEmpty");
    const rows = getFilteredHistory();

    if (!rows.length) {
      body.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    body.innerHTML = rows.map(h => {
      const detail = (h.categories || []).map(c => {
        const amt = h.distributions[c.id] || 0;
        return `${escapeHtml(c.name)}: ${formatMoney(amt)}`;
      }).join(" · ");
      return `
        <tr>
          <td>${formatDate(h.date)}</td>
          <td class="fw-600">${formatMoney(h.earnings)}</td>
          <td style="font-size:0.8rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(detail)}">${escapeHtml(detail)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" data-del-hist="${h.date}" title="Eliminar">✕</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function deleteHistoryEntry(date) {
    if (!confirm(`¿Eliminar el registro del ${formatDate(date)}?`)) return;
    history = history.filter(h => h.date !== date);
    save();
    renderHistory();
    updateStats();
    updateCharts();
    toast("Registro eliminado");
  }

  // ---------- Charts ----------
  function updateCharts() {
    if (typeof Chart === "undefined") return;

    // Aggregate totals per category name (use snapshot names)
    const totals = {};
    history.forEach(h => {
      (h.categories || []).forEach(c => {
        const amt = h.distributions[c.id] || 0;
        totals[c.name] = (totals[c.name] || 0) + amt;
      });
    });

    const labels = Object.keys(totals);
    const data = Object.values(totals);
    const colors = labels.map((_, i) => getColor(i));

    // Pie
    const pieCtx = document.getElementById("pieChart");
    if (pieChart) pieChart.destroy();
    if (labels.length) {
      pieChart = new Chart(pieCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#0f172a" }
            }
          }
        }
      });
    } else {
      pieCtx.getContext("2d").clearRect(0, 0, pieCtx.width, pieCtx.height);
    }

    // Bar – last 14 entries or all if fewer
    const recent = [...history].slice(-14);
    const catNames = [...new Set(recent.flatMap(h => (h.categories || []).map(c => c.name)))];

    const datasets = catNames.map((name, i) => {
      return {
        label: name,
        data: recent.map(h => {
          const cat = (h.categories || []).find(c => c.name === name);
          return cat ? (h.distributions[cat.id] || 0) : 0;
        }),
        backgroundColor: getColor(i),
        borderRadius: 4
      };
    });

    const barCtx = document.getElementById("barChart");
    if (barChart) barChart.destroy();
    if (recent.length && catNames.length) {
      barChart = new Chart(barCtx, {
        type: "bar",
        data: {
          labels: recent.map(h => formatDate(h.date)),
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            x: {
              ticks: { color: getComputedStyle(document.documentElement).getPropertyValue("--text-muted").trim() },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: getComputedStyle(document.documentElement).getPropertyValue("--text-muted").trim() },
              grid: { color: getComputedStyle(document.documentElement).getPropertyValue("--border").trim() }
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() }
            }
          }
        }
      });
    } else {
      barCtx.getContext("2d").clearRect(0, 0, barCtx.width, barCtx.height);
    }
  }

  // ---------- Export CSV ----------
  function exportCSV() {
    if (!history.length) {
      toast("No hay datos para exportar");
      return;
    }

    // Header: date, earnings, then for each unique category across history: name_pct, amount
    // Simpler well-organized format:
    // date,earnings,category,percentage,amount
    // one row per category per day

    const lines = ["date,earnings,category,percentage,amount"];

    history.forEach(h => {
      (h.categories || []).forEach(c => {
        const amt = h.distributions[c.id] || 0;
        lines.push([
          h.date,
          h.earnings.toFixed(2),
          `"${c.name.replace(/"/g, '""')}"`,
          c.pct,
          amt.toFixed(2)
        ].join(","));
      });
    });

    // Also a second section for categories definition (current)
    lines.push("");
    lines.push("# CURRENT_CATEGORIES");
    lines.push("id,name,percentage");
    categories.forEach(c => {
      lines.push([c.id, `"${c.name.replace(/"/g, '""')}"`, c.pct].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eem_export_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exportado");
  }

  // ---------- Import CSV ----------
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const entries = [];
    let currentCats = [];
    let mode = "data"; // data | cats

    // Group by date
    const byDate = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("# CURRENT_CATEGORIES")) {
        mode = "cats";
        continue;
      }
      if (line.startsWith("date,") || line.startsWith("id,")) continue; // headers

      if (mode === "cats") {
        // id,name,percentage
        const parts = parseCSVLine(line);
        if (parts.length >= 3) {
          currentCats.push({
            id: parts[0],
            name: parts[1].replace(/^"|"$/g, "").replace(/""/g, '"'),
            pct: parseFloat(parts[2]) || 0
          });
        }
        continue;
      }

      // data row: date,earnings,category,percentage,amount
      const parts = parseCSVLine(line);
      if (parts.length < 5) continue;
      const date = parts[0];
      const earnings = parseFloat(parts[1]);
      const catName = parts[2].replace(/^"|"$/g, "").replace(/""/g, '"');
      const pct = parseFloat(parts[3]) || 0;
      const amount = parseFloat(parts[4]) || 0;

      if (!byDate[date]) {
        byDate[date] = {
          date,
          earnings,
          distributions: {},
          categories: []
        };
      }
      // Use a generated id based on name for consistency within the entry
      const cid = "imp_" + catName.toLowerCase().replace(/\s+/g, "_") + "_" + date;
      byDate[date].distributions[cid] = amount;
      byDate[date].categories.push({ id: cid, name: catName, pct });
      byDate[date].earnings = earnings; // last one wins, all same
    }

    Object.values(byDate).forEach(e => entries.push(e));
    entries.sort((a, b) => a.date.localeCompare(b.date));

    return { entries, currentCats };
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    result.push(cur);
    return result;
  }

  function filterEntriesByScope(entries, scope) {
    const now = new Date();
    const today = todayStr();

    if (scope === "all") return entries;

    if (scope === "day") {
      return entries.filter(e => e.date === today);
    }
    if (scope === "week") {
      const start = startOfWeek(now).toISOString().slice(0, 10);
      return entries.filter(e => e.date >= start && e.date <= today);
    }
    if (scope === "month") {
      const start = startOfMonth(now).toISOString().slice(0, 10);
      return entries.filter(e => e.date >= start && e.date <= today);
    }
    if (scope === "custom") {
      const from = document.getElementById("dateFrom").value;
      const to = document.getElementById("dateTo").value;
      if (!from || !to) {
        toast("Selecciona rango de fechas");
        return null;
      }
      return entries.filter(e => e.date >= from && e.date <= to);
    }
    return entries;
  }

  function doImport() {
    const fileInput = document.getElementById("fileImport");
    const file = fileInput.files[0];
    if (!file) {
      toast("Selecciona un archivo CSV");
      return;
    }

    const mode = document.querySelector('input[name="importMode"]:checked').value;
    const scope = document.querySelector('input[name="importScope"]:checked').value;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const { entries, currentCats } = parseCSV(e.target.result);
        if (!entries.length && !currentCats.length) {
          toast("El CSV no contiene datos reconocibles");
          return;
        }

        let filtered = filterEntriesByScope(entries, scope);
        if (filtered === null) return;

        if (mode === "backup") {
          // Merge or replace? For true backup restore we replace filtered range or all
          if (scope === "all") {
            history = filtered;
            if (currentCats.length) categories = currentCats;
          } else {
            // Remove existing in range then add
            const dates = new Set(filtered.map(e => e.date));
            history = history.filter(h => !dates.has(h.date));
            history = history.concat(filtered);
            history.sort((a, b) => a.date.localeCompare(b.date));
          }
          save();
          renderCategories();
          renderPreview();
          renderHistory();
          updateStats();
          updateCharts();
          toast(`Respaldo importado (${filtered.length} días)`);
        } else {
          // Review mode → open new window
          openReviewWindow(filtered, currentCats);
          toast("Ventana de revisión abierta");
        }
        fileInput.value = "";
      } catch (err) {
        console.error(err);
        toast("Error al leer el CSV");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function openReviewWindow(entries, cats) {
    const w = window.open("", "_blank", "width=480,height=720");
    if (!w) {
      toast("Permite ventanas emergentes para la revisión");
      return;
    }

    // Aggregate for charts
    const totals = {};
    entries.forEach(h => {
      (h.categories || []).forEach(c => {
        totals[c.name] = (totals[c.name] || 0) + (h.distributions[c.id] || 0);
      });
    });

    const labels = Object.keys(totals);
    const data = Object.values(totals);

    let histRows = entries.map(h => {
      const detail = (h.categories || []).map(c =>
        `${c.name}: ${formatMoney(h.distributions[c.id] || 0)}`
      ).join(" · ");
      return `<tr><td>${formatDate(h.date)}</td><td>${formatMoney(h.earnings)}</td><td style="font-size:0.8rem">${detail}</td></tr>`;
    }).join("");

    if (!histRows) histRows = `<tr><td colspan="3" style="text-align:center;padding:20px;">Sin datos en el período</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>EEM – Revisión</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f1f5f9;color:#0f172a}
    h1{font-size:1.2rem;color:#0d9488;margin-bottom:16px}
    .card{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}
    th{font-size:.75rem;color:#64748b;text-transform:uppercase}
    canvas{max-height:240px}
  </style>
</head>
<body>
  <h1>EEM – Revisión de datos</h1>
  <div class="card">
    <strong>Registros:</strong> ${entries.length} día(s)
  </div>
  <div class="card">
    <h3 style="margin:0 0 12px;font-size:1rem">Historial del período</h3>
    <table>
      <thead><tr><th>Fecha</th><th>Ingreso</th><th>Detalle</th></tr></thead>
      <tbody>${histRows}</tbody>
    </table>
  </div>
  <div class="card">
    <h3 style="margin:0 0 12px;font-size:1rem">Distribución acumulada</h3>
    <canvas id="revPie"></canvas>
  </div>
  <script>
    const labels = ${JSON.stringify(labels)};
    const data = ${JSON.stringify(data)};
    if (labels.length && typeof Chart !== "undefined") {
      new Chart(document.getElementById("revPie"), {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data, backgroundColor: ${JSON.stringify(COLORS.slice(0, labels.length))}, borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }
  <\/script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  }

  // ---------- Clear all ----------
  function clearAll() {
    if (!confirm("¿Estás seguro? Se borrarán TODAS las categorías y el historial. Esta acción no se puede deshacer.")) return;
    if (!confirm("Última confirmación: ¿borrar todo?")) return;
    categories = [];
    history = [];
    save();
    renderCategories();
    renderPreview();
    renderHistory();
    updateStats();
    updateCharts();
    document.getElementById("inputEarnings").value = "";
    toast("Todos los datos eliminados");
  }

  // ---------- Escape ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Event listeners ----------
  function bind() {
    // Tabs
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Theme
    document.getElementById("btnTheme").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(cur === "dark" ? "light" : "dark");
      // redraw charts with new colors
      if (document.getElementById("panel-charts").classList.contains("active")) {
        updateCharts();
      }
    });

    // Earnings input live preview
    document.getElementById("inputEarnings").addEventListener("input", renderPreview);

    // Save today
    document.getElementById("btnSave").addEventListener("click", saveToday);

    // Categories
    document.getElementById("btnAddCat").addEventListener("click", () => openCatModal());
    document.getElementById("btnCancelCat").addEventListener("click", closeCatModal);
    document.getElementById("btnSaveCat").addEventListener("click", saveCategory);
    document.getElementById("modalCat").addEventListener("click", e => {
      if (e.target.id === "modalCat") closeCatModal();
    });

    document.getElementById("catList").addEventListener("click", e => {
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (edit) openCatModal(edit.dataset.edit);
      if (del) deleteCategory(del.dataset.del);
    });

    // History filter & delete
    document.getElementById("histFilter").addEventListener("change", renderHistory);
    document.getElementById("histBody").addEventListener("click", e => {
      const btn = e.target.closest("[data-del-hist]");
      if (btn) deleteHistoryEntry(btn.dataset.delHist);
    });

    // Export / Import
    document.getElementById("btnExport").addEventListener("click", exportCSV);
    document.getElementById("btnImport").addEventListener("click", doImport);
    document.getElementById("btnClearAll").addEventListener("click", clearAll);

    // Radio cards visual
    document.querySelectorAll(".radio-card").forEach(card => {
      card.addEventListener("click", () => {
        const name = card.querySelector("input").name;
        document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
          r.closest(".radio-card").classList.remove("selected");
        });
        card.classList.add("selected");
        card.querySelector("input").checked = true;

        // show/hide custom range
        if (name === "importScope") {
          const isCustom = card.querySelector("input").value === "custom";
          document.getElementById("customRange").classList.toggle("show", isCustom);
        }
      });
    });
  }

  // ---------- Init ----------
  function init() {
    load();
    initTheme();
    bind();

    document.getElementById("todayDate").textContent =
      "Fecha: " + formatDate(todayStr());

    // Set default dates for custom range
    document.getElementById("dateFrom").value = todayStr();
    document.getElementById("dateTo").value = todayStr();

    renderCategories();
    renderPreview();
    updateStats();
    renderHistory();

    // Check if review mode via query? (not needed)
  }

  // Wait for DOM + Chart if possible
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
