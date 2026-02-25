// ==========================
// CONFIG
// ==========================
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTT7xvkCJSgSTq11zBbaqXrxVuz2EV9KkLcXWElt0MbV5lWaaVWgBr4F6mriA3osJfFZ46ZbNq764kP/pubhtml?gid=923538560&single=true";

const MAX_ATHLETES = 30;

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    boxes: document.getElementById("boxes"),
    tbody: document.getElementById("tbody"),
    search: document.getElementById("search"),
    workout: document.getElementById("workout"),
    tableTitle: document.getElementById("tableTitle"),
    lastUpdated: document.getElementById("lastUpdated"),
  };

  let rows = [];

  // ==========================
  // UTILIDADES
  // ==========================
  function pointsFromRank(rank) {
    const r = Number(rank);
    if (!Number.isFinite(r) || r < 1) return 0;
    if (r > MAX_ATHLETES) return 0;
    return MAX_ATHLETES + 1 - r;
  }

  function escapeHTML(str = "") {
    return String(str).replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  function fallbackAvatar() {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
        <rect width="100%" height="100%" fill="#111827"/>
        <text x="50%" y="54%" text-anchor="middle" fill="#8aa0b2" font-size="18" font-family="Arial">IFL</text>
      </svg>`
    );
    return `data:image/svg+xml,${svg}`;
  }

  function safeImg(url) {
    const u = (url || "").trim();
    return u ? u : fallbackAvatar();
  }

  // Parser simple (como ya lo traías)
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map((h) => h.trim());

    return lines.map((line) => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
      return obj;
    });
  }

  // ==========================
  // MODELO
  // ==========================
  function computeModel(r) {
    const w1Pts = pointsFromRank(r.w1_rank);
    const w2Pts = pointsFromRank(r.w2_rank);
    const w3Pts = pointsFromRank(r.w3_rank);

    return {
      athlete_id: r.athlete_id,
      name: r.name,
      box: r.box,
      box_logo: r.box_logo,
      photo_url: r.photo_url,

      w1_rank: r.w1_rank,
      w1_score: r.w1_score,
      w1Pts,

      w2_rank: r.w2_rank,
      w2_score: r.w2_score,
      w2Pts,

      w3_rank: r.w3_rank,
      w3_score: r.w3_score,
      w3Pts,

      overallPts: w1Pts + w2Pts + w3Pts,
    };
  }

  // 1,1,3,4...
  function assignCompetitionRanks(sorted, getPointsFn) {
    let lastPts = null;
    let lastRank = 0;

    return sorted.map((item, idx) => {
      const pts = Number(getPointsFn(item)) || 0;

      if (idx === 0) {
        lastPts = pts;
        lastRank = 1;
        return { ...item, rank: 1 };
      }

      if (pts === lastPts) return { ...item, rank: lastRank };

      lastPts = pts;
      lastRank = idx + 1;
      return { ...item, rank: lastRank };
    });
  }

  // ==========================
  // ORDENAMIENTO (tabla)
  // ==========================
  function sortByView(data, view) {
    const copy = [...data];

    if (view === "w1") copy.sort((a, b) => b.w1Pts - a.w1Pts);
    else if (view === "w2") copy.sort((a, b) => b.w2Pts - a.w2Pts);
    else if (view === "w3") copy.sort((a, b) => b.w3Pts - a.w3Pts);
    else copy.sort((a, b) => b.overallPts - a.overallPts);

    return copy;
  }

  // ==========================
  // TOP 3 POR BOX (nuevo)
  // ==========================
  function renderTop3ByBox(data, view) {
    if (!els.boxes) return;

    const ptsOf = (a) =>
      view === "w1" ? a.w1Pts :
      view === "w2" ? a.w2Pts :
      view === "w3" ? a.w3Pts :
      a.overallPts;

    const map = new Map();

    data.forEach((a) => {
      const boxName = (a.box || "").trim();
      if (!boxName) return;

      if (!map.has(boxName)) {
        map.set(boxName, { name: boxName, logo: a.box_logo, athletes: [] });
      }
      const item = map.get(boxName);
      item.athletes.push(a);
      if (!item.logo && a.box_logo) item.logo = a.box_logo;
    });

    const boxes = [...map.values()].sort((x, y) =>
      x.name.localeCompare(y.name)
    );

    const viewLabel =
      view === "w1" ? "W1" :
      view === "w2" ? "W2" :
      view === "w3" ? "W3" : "Overall";

    els.boxes.innerHTML = boxes
      .map((b) => {
        const sorted = [...b.athletes].sort((a, c) => {
          const d = (Number(ptsOf(c)) || 0) - (Number(ptsOf(a)) || 0);
          if (d !== 0) return d;
          return (a.name || "").localeCompare(c.name || "");
        });

        const ranked = assignCompetitionRanks(sorted, ptsOf);
        const top = ranked.filter((a) => a.rank <= 3);

        const podiumHTML = top
          .map((a) => {
            const medal = a.rank === 1 ? "🥇" : a.rank === 2 ? "🥈" : "🥉";
            const pts = ptsOf(a);

            return `
              <div class="podiumItem">
                <div class="podiumMedal">${medal}</div>
                <div style="min-width:0;">
                  <div class="podiumName">${escapeHTML(a.name)}</div>
                  <div class="podiumSub">${escapeHTML(a.box || "")}</div>
                </div>
                <div class="podiumPts">
                  ${pts} pts
                  <small>${viewLabel}</small>
                </div>
              </div>
            `;
          })
          .join("");

        const emptyState = `<div class="podiumSub">Sin atletas</div>`;

        return `
          <article class="card">
            <div class="boxHead">
              <div class="boxHeadLeft">
                <img class="boxLogoSm"
                     src="${safeImg(b.logo)}"
                     alt="${escapeHTML(b.name)}"
                     onerror="this.src='${fallbackAvatar()}'">
                <div style="min-width:0;">
                  <div class="boxTitle">${escapeHTML(b.name)}</div>
                  <div class="boxMetaSm">${b.athletes.length} atletas</div>
                </div>
              </div>
              <div class="boxMetaSm">${escapeHTML(viewLabel)}</div>
            </div>

            <div class="podiumList">
              ${podiumHTML || emptyState}
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ==========================
  // TABLA GENERAL
  // ==========================
  function renderTable(sorted, view, query) {
    if (!els.tbody) return;

    const ptsOf = (a) =>
      view === "w1" ? a.w1Pts :
      view === "w2" ? a.w2Pts :
      view === "w3" ? a.w3Pts :
      a.overallPts;

    const ranked = assignCompetitionRanks(sorted, ptsOf);

    const q = (query || "").toLowerCase().trim();
    const filtered = ranked.filter((a) => {
      if (!q) return true;
      return (a.name || "").toLowerCase().includes(q) ||
             (a.box || "").toLowerCase().includes(q);
    });

    els.tbody.innerHTML = filtered
      .map((a) => {
        const pts = ptsOf(a);
        const w1 = `#${a.w1_rank || "-"} · ${a.w1_score || "-"}`;
        const w2 = `#${a.w2_rank || "-"} · ${a.w2_score || "-"}`;
        const w3 = `#${a.w3_rank || "-"} · ${a.w3_score || "-"}`;

        return `
          <tr>
            <td><strong>${a.rank}</strong></td>
            <td>${escapeHTML(a.name)}</td>
            <td>${escapeHTML(a.box || "")}</td>
            <td class="right"><strong>${pts}</strong></td>
            <td><small>${escapeHTML(w1)}</small></td>
            <td><small>${escapeHTML(w2)}</small></td>
            <td><small>${escapeHTML(w3)}</small></td>
          </tr>
        `;
      })
      .join("");
  }

  function refresh() {
    const view = els.workout?.value || "overall";

    if (els.tableTitle) {
      els.tableTitle.textContent =
        view === "w1" ? "Workout 1" :
        view === "w2" ? "Workout 2" :
        view === "w3" ? "Workout 3" : "Overall";
    }

    renderTop3ByBox(rows, view);
    renderTable(sortByView(rows, view), view, els.search?.value || "");
  }

  async function load() {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch CSV falló: ${res.status}`);
      const text = await res.text();

      const raw = parseCSV(text);
      rows = raw.map(computeModel);

      refresh();

      if (els.lastUpdated) {
        els.lastUpdated.textContent = "Actualizado: " + new Date().toLocaleString();
      }
    } catch (e) {
      console.error(e);
      if (els.lastUpdated) els.lastUpdated.textContent = "Error: " + (e?.message || e);
    }
  }

  els.search?.addEventListener("input", refresh);
  els.workout?.addEventListener("change", refresh);

  load();
});
