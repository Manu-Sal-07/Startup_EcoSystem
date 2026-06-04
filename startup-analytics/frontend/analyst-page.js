"use strict";

// ── State ──────────────────────────────────────────────────────
const analystState = {
  activePage: "overview",
  commandPaletteOpen: false,
  data: {},
  selectedEntity: null
};

const COMMAND_REGISTRY = [
  { label: "Overview",          icon: "grid",        page: "overview"       },
  { label: "Explorer",          icon: "search",      page: "explorer"       },
  { label: "Startup Intel",     icon: "trending-up", page: "startups"       },
  { label: "Investor Intel",    icon: "dollar-sign", page: "investors"      },
  { label: "Sector Analytics",  icon: "bar-chart-2", page: "sectors"        },
  { label: "Network Graph",     icon: "share-2",     page: "graph"          },
  { label: "Predictive Insights",icon: "cpu",        page: "predictive"     },
  { label: "Reports",           icon: "file-text",   page: "reports"        },
  { label: "System Health",     icon: "activity",    page: "system-health"  },
];

// ── Helpers ────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatMoney(n) {
  if (!n) return "INR 0";
  if (n >= 1e7) return `INR ${(n/1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `INR ${(n/1e5).toFixed(1)} L`;
  return `INR ${n}`;
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

function el(id) { return document.getElementById(id); }

function showToast(msg, type = "info") {
  const t = el("toast"); if (!t) return;
  const c = { info:"var(--primary)", success:"var(--success)", warn:"var(--warning)", error:"var(--danger)" };
  t.textContent = msg;
  t.style.borderLeftColor = c[type] || c.info;
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3000);
}

function countUp(elem, target, duration = 900) {
  let start = 0, step = target / (duration / 16);
  const tick = () => {
    start = Math.min(start + step, target);
    elem.textContent = Number.isInteger(target) ? Math.round(start) : start.toFixed(4);
    if (start < target) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function navigate(page) { window.location.hash = `#${page}`; }

// ── Routing ────────────────────────────────────────────────────
function handleRoute() {
  const hash = window.location.hash.replace("#","").trim() || "overview";
  analystState.activePage = hash;
  document.querySelectorAll(".sp-nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === hash));
  document.querySelectorAll(".sp-page").forEach(s => s.classList.toggle("active", s.id === `page-${hash}`));
  if (hash === "overview")   renderOverview();
  if (hash === "explorer")   renderExplorer();
  if (hash === "startups")   renderStartupIntel();
  if (hash === "investors")  renderInvestorIntel();
  if (hash === "sectors")    renderSectorAnalytics();
  if (hash === "predictive") renderPredictive();
  if (hash === "reports")    renderReportsPage();
  if (typeof feather !== "undefined") feather.replace();
}

// ── Overview Page ──────────────────────────────────────────────
async function renderOverview() {
  const d = analystState.data;
  if (!d._loaded) return; // data not ready yet

  const { network, sectorTrends, hotSectors, leaderboard, achievementLeaders } = d;
  const nodes  = network?.nodes  || [];
  const edges  = network?.edges  || [];
  const sectors = sectorTrends  || [];
  const hot    = hotSectors     || [];
  const leaders = achievementLeaders || [];
  const invLb   = leaderboard   || [];

  const startups  = nodes.filter(n => n.label === "Startup");
  const investors = nodes.filter(n => n.label === "Investor");
  const founders  = nodes.filter(n => n.label === "Founder");
  const totalAsk  = sectors.reduce((s,r) => s + (r.total_funding_ask||0), 0);
  const totalInv  = hot.reduce((s,r) => s + (r.interest_count||0), 0);
  const density   = nodes.length > 1 ? edges.length / (nodes.length * (nodes.length-1)) : 0;

  // Health score (composite)
  const densityScore  = Math.min(100, density * 5000);
  const sectorScore   = Math.min(100, sectors.length * 14);
  const investorScore = Math.min(100, totalInv * 10);
  const healthScore   = Math.round((densityScore * 0.35) + (sectorScore * 0.35) + (investorScore * 0.3));

  // ① Health Ring
  const numEl = el("healthScoreNum");
  if (numEl) {
    countUp(numEl, healthScore);
    const grade = healthScore >= 85 ? ["Excellent","#10B981"] : healthScore >= 70 ? ["Good","#3B82F6"] : healthScore >= 50 ? ["Caution","#F59E0B"] : ["Critical","#EF4444"];
    const gradeEl = el("healthScoreGrade");
    if (gradeEl) { gradeEl.textContent = grade[0]; gradeEl.style.color = grade[1]; }
    const descEl = el("healthScoreDesc");
    if (descEl) descEl.textContent = `${startups.length} startups · ${investors.length} investors · ${edges.length} connections across ${sectors.length} sectors`;
    const ring = el("healthRingFill");
    if (ring) {
      const offset = 377 - (377 * healthScore / 100);
      ring.style.stroke = grade[1];
      setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
    }
    const bars = [
      ["hbar-density","hval-density", densityScore],
      ["hbar-sector","hval-sector",   sectorScore],
      ["hbar-investor","hval-investor",investorScore],
    ];
    bars.forEach(([bid, vid, val]) => {
      const b = el(bid), v = el(vid);
      if (b) setTimeout(()=>{ b.style.width = `${Math.round(val)}%`; }, 200);
      if (v) v.textContent = `${Math.round(val)}%`;
    });
  }

  // ② KPI Grid
  const kpiEl = el("kpiGrid");
  if (kpiEl) {
    const kpis = [
      { label:"Total Startups",    value: startups.length,      trend:"+12%",  dir:"up",   accent:"#3B82F6", sub:"Active cohort" },
      { label:"Total Investors",   value: investors.length,     trend:"+5%",   dir:"up",   accent:"#F59E0B", sub:"Capital allocators" },
      { label:"Connections",       value: edges.length,         trend:"+18%",  dir:"up",   accent:"#10B981", sub:"Graph traversal paths" },
      { label:"Funding Demand",    value: formatMoney(totalAsk),      trend:"+9%",   dir:"up",   accent:"#8B5CF6", sub:"Aggregated ask", raw:true },
      { label:"Investor Intents",  value: totalInv,             trend: totalInv>5?"+22%":"-4%", dir: totalInv>5?"up":"down", accent:"#EC4899", sub:"Last 30 days" },
      { label:"Network Density",   value: density.toFixed(4),   trend:"+11%",  dir:"up",   accent:"#06B6D4", sub:"Edge / node ratio", raw:true },
    ];
    kpiEl.innerHTML = kpis.map((k,i) => `
      <div class="kpi-card" style="--kpi-accent:${k.accent};">
        <div class="kpi-card__label">${escapeHtml(k.label)}</div>
        <div class="kpi-card__value" id="kv${i}">${k.raw ? escapeHtml(k.value) : 0}</div>
        <div class="kpi-card__meta">
          <span class="kpi-card__trend kpi-card__trend--${k.dir}">${k.dir==="up"?"▲":"▼"} ${escapeHtml(k.trend)}</span>
          <span style="color:var(--text-tertiary);font-size:0.7rem;">${escapeHtml(k.sub)}</span>
        </div>
      </div>`).join("");
    kpis.forEach((k,i) => {
      if (!k.raw) { const e = el(`kv${i}`); if(e) countUp(e, k.value); }
    });
    el("kpiLastUpdated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }

  // ③ AI Insights
  const insEl = el("insightsList");
  if (insEl) {
    const hotSec  = hot[0]?.sector  || "SaaS";
    const topStart = leaders[0]?.name || null;
    const riskSec  = sectors.find(s => s.total_funding_ask > 2000000 && !hot.find(h=>h.sector===s.sector))?.sector;
    const insights = [
      { dot:"#10B981", priority:"HIGH",   confidence:"94%", text: `<strong>${escapeHtml(hotSec)}</strong> sector is the top investor attention hub this month — INTERESTED_IN signals peaked.`, ts: "2m ago" },
      topStart ? { dot:"#3B82F6", priority:"MED", confidence:"87%", text: `Startup <strong>${escapeHtml(topStart)}</strong> is in the 95th percentile for achievement velocity this quarter.`, ts: "15m ago" } : null,
      riskSec  ? { dot:"#F59E0B", priority:"MED", confidence:"78%", text: `<strong>${escapeHtml(riskSec)}</strong> has high funding demand but zero recent investor interest — potential bottleneck.`, ts: "1h ago" } : null,
      { dot:"#8B5CF6", priority:"LOW", confidence:"71%", text: `Network density improved ${density>0.002?"significantly":"marginally"} — graph connectivity is ${density>0.005?"excellent":"developing"}.`, ts: "2h ago" },
    ].filter(Boolean);
    const pColor = { HIGH:"var(--danger)", MED:"var(--warning)", LOW:"var(--primary)" };
    insEl.innerHTML = insights.map(ins => `
      <div class="insight-item">
        <div class="insight-item__dot" style="background:${ins.dot}"></div>
        <div class="insight-item__body">
          <div class="insight-item__text">${ins.text}</div>
          <div class="insight-item__meta">
            <span class="insight-confidence" style="background:${pColor[ins.priority]}22;color:${pColor[ins.priority]}">${ins.priority}</span>
            <span class="insight-confidence" style="background:rgba(255,255,255,0.05);color:var(--text-sec)">Confidence: ${ins.confidence}</span>
            <span>${ins.ts}</span>
          </div>
        </div>
      </div>`).join("");
  }

  // ④ Activity Feed (derived from graph data)
  const feedEl = el("activityFeed");
  if (feedEl) {
    const iconMap = {
      "Startup":  { icon:"🚀", bg:"rgba(59,130,246,0.15)",  label:"Startup Registered" },
      "Investor": { icon:"💼", bg:"rgba(245,158,11,0.15)",  label:"Investor Joined" },
      "Founder":  { icon:"👤", bg:"rgba(16,185,129,0.15)",  label:"Founder Added" },
    };
    const edgeMap = {
      "INTERESTED_IN": { icon:"⭐", bg:"rgba(251,191,36,0.15)", label:"Interest Expressed" },
      "FOUNDED":       { icon:"🔗", bg:"rgba(16,185,129,0.15)", label:"Connection Created" },
      "INVESTED_IN":   { icon:"💰", bg:"rgba(139,92,246,0.15)", label:"Investment Recorded" },
    };
    const events = [];
    nodes.slice(0,6).forEach((n,i) => {
      const cfg = iconMap[n.label] || iconMap.Startup;
      events.push({ icon:cfg.icon, bg:cfg.bg, title:`${cfg.label}: ${n.name}`, sub: n.sector||n.label, ago: (i+1)*7 });
    });
    edges.slice(0,4).forEach((e,i) => {
      const cfg = edgeMap[e.type] || { icon:"🔗", bg:"rgba(255,255,255,0.06)", label:e.type };
      const src = nodes.find(n=>n.id===e.source)?.name || e.source;
      const tgt = nodes.find(n=>n.id===e.target)?.name || e.target;
      events.push({ icon:cfg.icon, bg:cfg.bg, title:`${cfg.label}: ${src} → ${tgt}`, sub:e.type, ago:(i+3)*20 });
    });
    events.sort((a,b) => a.ago - b.ago);
    feedEl.innerHTML = events.slice(0,8).map(ev => `
      <div class="activity-event">
        <div class="activity-event__icon" style="background:${ev.bg}">${ev.icon}</div>
        <div class="activity-event__body">
          <div class="activity-event__title">${escapeHtml(ev.title)}</div>
          <div class="activity-event__sub">${escapeHtml(ev.sub)}</div>
        </div>
        <div class="activity-event__time">${ev.ago}m ago</div>
      </div>`).join("") || `<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No recent activity.</div>`;
  }

  // ⑤ Sector Snapshot (top 5)
  const secEl = el("sectorSnapshot");
  if (secEl && sectors.length) {
    const COLORS = ["#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444"];
    const hotMap = Object.fromEntries(hot.map(h=>[h.sector,h.interest_count]));
    const top5 = sectors.slice(0,5);
    const maxAsk = Math.max(...top5.map(s=>s.total_funding_ask||0)) || 1;
    secEl.innerHTML = top5.map((s,i) => {
      const col = COLORS[i % COLORS.length];
      const growPct = Math.round(((s.total_funding_ask||0) / maxAsk) * 100);
      const intents = hotMap[s.sector] || 0;
      return `
        <div class="sector-card" style="--sector-color:${col}" onclick="navigate('sectors')">
          <div class="sector-card__name">${escapeHtml(s.sector)}</div>
          <div class="sector-card__ask">${formatMoney(s.total_funding_ask)}</div>
          <div class="sector-card__stats">
            <div class="sector-card__stat"><span>Startups</span><strong>${s.startup_count}</strong></div>
            <div class="sector-card__stat"><span>Intents</span><strong>${intents}</strong></div>
          </div>
          <div class="sector-card__growth" style="color:${col}">▲ ${growPct}% relative demand</div>
        </div>`;
    }).join("");
  }

  // ⑥ Startup Leaderboard
  const stLbEl = el("startupLeaderboard");
  if (stLbEl) {
    const rankColors = ["leaderboard-row__rank--gold","leaderboard-row__rank--silver","leaderboard-row__rank--bronze","",""];
    const COLORS = ["#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444"];
    stLbEl.innerHTML = leaders.slice(0,5).map((l,i) => `
      <div class="leaderboard-row">
        <div class="leaderboard-row__rank ${rankColors[i]||''}">#${i+1}</div>
        <div class="leaderboard-row__avatar" style="background:${COLORS[i%5]}">${escapeHtml(l.name[0]||"S")}</div>
        <div class="leaderboard-row__info">
          <div class="leaderboard-row__name">${escapeHtml(l.name)}</div>
          <div class="leaderboard-row__sub">${escapeHtml(l.sector||"—")}</div>
        </div>
        <div class="leaderboard-row__score">${l.ach_count} ach.</div>
      </div>`).join("") || `<div style="padding:16px;color:var(--text-tertiary);font-size:0.8rem;text-align:center">No data</div>`;
  }

  // ⑦ Investor Leaderboard
  const invLbEl = el("investorLeaderboard");
  if (invLbEl) {
    const rankColors = ["leaderboard-row__rank--gold","leaderboard-row__rank--silver","leaderboard-row__rank--bronze","",""];
    const COLORS = ["#F59E0B","#3B82F6","#10B981","#8B5CF6","#EF4444"];
    invLbEl.innerHTML = invLb.slice(0,5).map((inv,i) => `
      <div class="leaderboard-row">
        <div class="leaderboard-row__rank ${rankColors[i]||''}">#${i+1}</div>
        <div class="leaderboard-row__avatar" style="background:${COLORS[i%5]}">${escapeHtml((inv.investor_id||"I")[0])}</div>
        <div class="leaderboard-row__info">
          <div class="leaderboard-row__name">${escapeHtml(inv.investor_id)}</div>
          <div class="leaderboard-row__sub">Influence score</div>
        </div>
        <div class="leaderboard-row__score">${inv.score?.toFixed(1)||"—"}</div>
      </div>`).join("") || `<div style="padding:16px;color:var(--text-tertiary);font-size:0.8rem;text-align:center">No data</div>`;
  }

  // ⑧ Network Snapshot
  const nn = el("netNodes"), ne = el("netEdges"), nd = el("netDensity");
  if (nn) countUp(nn, nodes.length);
  if (ne) countUp(ne, edges.length);
  if (nd) nd.textContent = density.toFixed(4);

  if (typeof feather !== "undefined") feather.replace();
}

function renderGraph(payload) {
  const notice = el("graphNotice");
  if (typeof d3 === "undefined" || !d3?.select) {
    if (notice) {
      notice.textContent = "Graph library failed to load. Network graph is unavailable.";
      notice.style.display = "block";
    }
    return;
  }

  const svg = d3.select("#networkGraph");
  const tip = el("graphTip");
  if (svg.empty()) {
    if (notice) {
      notice.textContent = "Graph container not found.";
      notice.style.display = "block";
    }
    return;
  }
  svg.selectAll("*").remove();
  svg.attr("width", 960).attr("height", 470);
  const width = 960;
  const height = 470;
  const nodes = (payload?.nodes || []).map(item => ({ ...item }));
  const edges = (payload?.edges || []).map(item => ({ ...item }));
  if (notice) {
    notice.textContent = nodes.length ? "" : "No network nodes available to render.";
    notice.style.display = nodes.length ? "none" : "block";
  }
  const nodeColors = { Startup: "#0f4c81", Investor: "#d14343", Founder: "#15803d", Achievement: "#b45309", Analyst: "#7c3aed" };
  const edgeColors = { INTERESTED_IN: "#f59e0b", CONNECTED_TO: "#16a34a", INVESTED_IN: "#2563eb", FOUNDED: "#64748b", COMPETES_WITH: "#c084fc", HAS_ACHIEVEMENT: "#b45309", FUNDED: "#0f766e" };

  const graphLayer = svg.append("g");
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.2, 3])
    .on("zoom", event => graphLayer.attr("transform", event.transform));

  svg.call(zoomBehavior).call(zoomBehavior.transform, d3.zoomIdentity);
  svg.style("cursor", "move");

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(item => item.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-280))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(22));

  const link = graphLayer.append("g").attr("class", "graph-links").selectAll("line").data(edges).join("line")
    .attr("stroke", item => edgeColors[item.type] || "#94a3b8")
    .attr("stroke-opacity", .72)
    .attr("stroke-width", item => item.type === "INVESTED_IN" || item.type === "FUNDED" ? 2.8 : 1.8);

  const node = graphLayer.append("g").attr("class", "graph-nodes").selectAll("circle").data(nodes).join("circle")
    .attr("r", item => item.label === "Investor" ? 10 : item.label === "Achievement" ? 7 : 8)
    .attr("fill", item => nodeColors[item.label] || "#334155")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.8)
    .call(d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded));

  if (tip) {
    node.on("mousemove", (event, item) => {
      tip.style.opacity = "1";
      tip.style.left = `${event.offsetX}px`;
      tip.style.top = `${event.offsetY}px`;
      tip.innerHTML = `<strong>${escapeHtml(item.name)}</strong><div>${escapeHtml(item.label)}</div><div>${escapeHtml(item.sector || "")}</div>`;
    }).on("mouseleave", () => { tip.style.opacity = "0"; });
  }

  const labels = svg.append("g").selectAll("text").data(nodes.slice(0, 50)).join("text")
    .text(item => item.name)
    .attr("font-size", 11)
    .attr("fill", "#36454f")
    .attr("dx", 12)
    .attr("dy", 4);

  simulation.on("tick", () => {
    link.attr("x1", item => item.source.x)
      .attr("y1", item => item.source.y)
      .attr("x2", item => item.target.x)
      .attr("y2", item => item.target.y);
    node.attr("cx", item => item.x).attr("cy", item => item.y);
    labels.attr("x", item => item.x).attr("y", item => item.y);
  });

  function dragStarted(event) {
    if (!event.active) simulation.alphaTarget(.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

function renderMiniGraph(payload) {
  const canvas = document.getElementById("networkMiniCanvas");
  const label = document.getElementById("networkPreviewLabel");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const nodes = (payload?.nodes || []).slice(0, 20).map((item, index) => ({ ...item, index }));
  const edges = (payload?.edges || []).filter(edge => nodes.some(n => n.id === edge.source) && nodes.some(n => n.id === edge.target)).slice(0, 36);

  if (!nodes.length) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (label) label.style.display = "block";
    return;
  }
  if (label) label.style.display = "none";

  ctx.fillStyle = "rgba(15,19,28,0.95)";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 18;
  const angleStep = Math.PI * 2 / nodes.length;
  const positions = nodes.map((node, idx) => ({
    ...node,
    x: centerX + Math.cos(idx * angleStep) * radius * (0.75 + (idx % 4) * 0.06),
    y: centerY + Math.sin(idx * angleStep) * radius * (0.75 + ((idx + 2) % 4) * 0.06),
  }));

  ctx.strokeStyle = "rgba(148,163,184,0.22)";
  ctx.lineWidth = 1;
  edges.forEach(edge => {
    const source = positions.find(n => n.id === edge.source);
    const target = positions.find(n => n.id === edge.target);
    if (!source || !target) return;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });

  const nodeColors = { Startup: "#60a5fa", Investor: "#f97316", Founder: "#22c55e", Achievement: "#facc15", Analyst: "#a78bfa" };
  positions.forEach(node => {
    ctx.beginPath();
    ctx.fillStyle = nodeColors[node.label] || "#94a3b8";
    const radius = node.label === "Investor" ? 5 : node.label === "Achievement" ? 4 : 4.5;
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  });
}

// ── Explorer State ──────────────────────────────────────────────
const explorerState = { activeType: "all", query: "" };

// Build entity list merging network nodes + sectors
function getExplorerEntities() {
  const d = analystState.data;
  const nodes = (d.network?.nodes || []).map(n => ({ ...n, _kind: n.label }));
  const sectors = (d.sectorTrends || []).map(s => ({
    id: `sector_${s.sector}`, name: s.sector, label: "Sector", _kind: "sector",
    sector: s.sector, startup_count: s.startup_count, total_funding_ask: s.total_funding_ask
  }));
  return [...nodes, ...sectors];
}

function renderExplorer() {
  if (!analystState.data._loaded) return;
  const all = getExplorerEntities();
  const q   = explorerState.query.toLowerCase();
  const type = explorerState.activeType;

  // Tab counts
  const counts = { all: all.length, Startup:0, Investor:0, Founder:0, sector:0 };
  all.forEach(e => { if (counts[e._kind] !== undefined) counts[e._kind]++; });
  Object.entries(counts).forEach(([k,v]) => { const t = el(`tabCount-${k}`); if(t) t.textContent = v; });

  // Filter
  const filtered = all.filter(e => {
    const matchType = type === "all" || e._kind === type;
    const matchQ    = !q || e.name.toLowerCase().includes(q)
      || (e.sector||e.label||"").toLowerCase().includes(q)
      || (e.stage||"").toLowerCase().includes(q)
      || (e.id||"").toLowerCase().includes(q);
    return matchType && matchQ;
  });

  const countEl = el("explorerCountLabel");
  if (countEl) countEl.textContent = `${filtered.length} result${filtered.length!==1?"s":""}`;
  const badgeEl = el("explorerResultCount");
  if (badgeEl) badgeEl.textContent = `${filtered.length} entities`;

  const container = el("explorerResults");
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `
      <div class="explorer-empty">
        <div class="explorer-empty__icon"><i data-feather="search" style="width:40px;height:40px;"></i></div>
        <div class="explorer-empty__title">No results found</div>
        <div class="explorer-empty__sub">Try a different keyword or filter type</div>
      </div>`;
    if (typeof feather !== "undefined") feather.replace();
    return;
  }

  const COLORS = { Startup:"#3B82F6", Investor:"#F59E0B", Founder:"#10B981", Sector:"#8B5CF6", sector:"#8B5CF6" };
  const BADGES = { Startup:"sp-badge--blue", Investor:"sp-badge--yellow", Founder:"sp-badge--green", Sector:"sp-badge--blue", sector:"sp-badge--blue" };
  const influenceMap = Object.fromEntries((analystState.data.influence||[]).map(i=>[i.id, i.influence_score]));
  const leaderMap    = Object.fromEntries((analystState.data.leaderboard||[]).map(l=>[l.investor_id, l.score]));
  const achMap       = Object.fromEntries((analystState.data.achievementLeaders||[]).map(l=>[l.name, l.ach_count]));
  const edgeCount    = id => (analystState.data.network?.edges||[]).filter(e=>e.source===id||e.target===id).length;
  const selId        = analystState.selectedEntity?.id || analystState.selectedEntity?.name;

  container.innerHTML = filtered.slice(0, 60).map(entity => {
    const color   = COLORS[entity._kind] || "#6B7280";
    const badge   = BADGES[entity._kind] || "sp-badge--blue";
    const initial = (entity.name||"?")[0].toUpperCase();
    const conns   = entity._kind !== "sector" ? edgeCount(entity.id) : entity.startup_count || 0;
    const infScore = influenceMap[entity.id];
    const score   = entity._kind === "Investor" ? (leaderMap[entity.id]||0).toFixed(1)
                  : entity._kind === "Startup"  ? (achMap[entity.name]||0)
                  : entity._kind === "sector"   ? formatMoney(entity.total_funding_ask)
                  : infScore !== undefined ? infScore : conns;
    const scoreLabel = entity._kind === "Investor" ? "Influence" : entity._kind === "Startup" ? "Ach." : entity._kind === "sector" ? "Ask" : "Score";
    const isSelected = (entity.id||entity.name) === selId;

    return `
      <div class="entity-card${isSelected ? " selected" : ""}" data-id="${escapeHtml(entity.id || entity.name)}" data-kind="${escapeHtml(entity._kind)}">
        <div class="entity-card__avatar" style="background:${color}">${initial}</div>
        <div class="entity-card__body">
          <div class="entity-card__name">${escapeHtml(entity.name)}</div>
          <div class="entity-card__meta">
            <span class="sp-badge ${badge}" style="font-size:0.62rem">${escapeHtml(entity.label || entity._kind)}</span>
            ${entity.sector && entity._kind !== "sector" ? "<span>· " + escapeHtml(entity.sector) + "</span>" : ""}
            ${entity.stage ? "<span>· " + escapeHtml(entity.stage) + "</span>" : ""}
            <span>${conns} conn.</span>
          </div>
        </div>
        <div class="entity-card__stats">
          <div class="entity-card__stat">
            <div class="entity-card__stat-val">${escapeHtml(String(score))}</div>
            <div class="entity-card__stat-label">${scoreLabel}</div>
          </div>
        </div>
        <i data-feather="chevron-right" class="entity-card__arrow" style="width:14px;height:14px"></i>
      </div>`;
  }).join("");

  // Click → select entity and show right panel
  container.querySelectorAll(".entity-card").forEach(card => {
    card.addEventListener("click", () => {
      const entityId = card.dataset.id;
      const entity   = getExplorerEntities().find(e => (e.id||e.name) === entityId);
      if (!entity) return;
      analystState.selectedEntity = entity;
      // Update selected style without full re-render
      container.querySelectorAll(".entity-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      // Populate right panel
      showExplorerDetail(entity);
      // Also update the slide drawer on narrow screens
      openEntityDrawer(entity);
    });
  });

  // If something was already selected, show it
  if (analystState.selectedEntity) showExplorerDetail(analystState.selectedEntity);

  if (typeof feather !== "undefined") feather.replace();
}

// ── Right-panel entity detail (two-panel layout) ───────────────
function showExplorerDetail(entity) {
  const emptyEl   = el("explorerDetailEmpty");
  const contentEl = el("explorerDetailContent");
  if (!emptyEl || !contentEl) return;

  emptyEl.style.display   = "none";
  contentEl.style.display = "block";

  const COLORS = { Startup:"#3B82F6", Investor:"#F59E0B", Founder:"#10B981", Sector:"#8B5CF6", sector:"#8B5CF6" };
  const color   = COLORS[entity._kind] || "#6B7280";
  const initial = (entity.name||"?")[0].toUpperCase();
  const edges   = analystState.data.network?.edges || [];
  const nodes   = analystState.data.network?.nodes || [];

  const rels = entity._kind !== "sector"
    ? edges.filter(e => e.source===entity.id || e.target===entity.id).slice(0,10).map(e => {
        const otherId = e.source===entity.id ? e.target : e.source;
        const other   = nodes.find(n => n.id===otherId);
        return { type: e.type, name: other?.name||otherId, label: other?.label||"Entity", dir: e.source===entity.id?"→":"←" };
      })
    : [];

  const influenceMap = Object.fromEntries((analystState.data.influence||[]).map(i=>[i.id, i.influence_score]));
  const maxInf       = Math.max(...(analystState.data.influence||[]).map(i=>i.influence_score||0), 1);
  const infScore     = influenceMap[entity.id] ?? null;
  const infPct       = infScore !== null ? Math.round((infScore/maxInf)*100) : 0;

  const achData = (analystState.data.achievementLeaders||[]).find(l=>l.name===entity.name);
  const lbScore = (analystState.data.leaderboard||[]).find(l=>l.investor_id===entity.id)?.score;
  const secData = (analystState.data.sectorTrends||[]).find(s=>s.sector===entity.sector);
  const hotData = (analystState.data.hotSectors||[]).find(s=>s.sector===entity.sector);
  const degree  = rels.length;
  const totalN  = nodes.length || 1;
  const percentile = Math.round((degree / totalN) * 100);

  // Related entities: connected nodes + same-sector peers
  const connectedNodes = rels.slice(0,5).map(r => {
    const n = nodes.find(nd => nd.name===r.name);
    return { name: r.name, label: r.label, color: COLORS[r.label]||"#6B7280", relType: r.type };
  });
  const peers = entity._kind==="Startup" && entity.sector
    ? nodes.filter(n=>n.label==="Startup"&&n.sector===entity.sector&&n.id!==entity.id).slice(0,4).map(n=>({ name:n.name, label:"Startup", color:"#3B82F6" }))
    : [];
  const related = [...new Map([...connectedNodes,...peers].map(r=>[r.name,r])).values()].slice(0,8);

  // Recent activity events (from achievement leaders & edge data)
  const achTypes = achData?.types || [];
  const activities = [
    ...achTypes.slice(0,3).map((t,i) => ({ dot:"#10B981", text:`Achievement posted: ${t}`, ago:`${(i+1)*2}d` })),
    degree > 0 ? { dot:"#3B82F6", text:`${rels[0]?.type} relationship with ${rels[0]?.name}`, ago:"Recently" } : null,
    hotData    ? { dot:"#F59E0B", text:`Investor interest signal in ${entity.sector||"sector"}`, ago:"30d window" } : null,
  ].filter(Boolean).slice(0,5);

  contentEl.innerHTML = `
    <!-- Header -->
    <div class="explorer-detail-panel__header">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;border-radius:6px;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:0.9rem">${initial}</div>
        <div>
          <div style="font-weight:700;font-size:0.9rem">${escapeHtml(entity.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-sec)">${escapeHtml(entity.label||entity._kind)}${entity.sector?" · "+escapeHtml(entity.sector):""}</div>
        </div>
      </div>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" onclick="analystState.selectedEntity=null;el('explorerDetailEmpty').style.display='';el('explorerDetailContent').style.display='none'" title="Close">
        <i data-feather="x" style="width:14px;height:14px"></i>
      </button>
    </div>

    <div class="explorer-detail-panel__body">

      <!-- Stat boxes -->
      <div class="detail-stat-row">
        <div class="detail-stat-box">
          <div class="detail-stat-box__val">${degree}</div>
          <div class="detail-stat-box__label">Connections</div>
        </div>
        <div class="detail-stat-box">
          <div class="detail-stat-box__val">${infScore !== null ? infScore : "—"}</div>
          <div class="detail-stat-box__label">Graph Score</div>
        </div>
        <div class="detail-stat-box">
          <div class="detail-stat-box__val">${achData?.ach_count ?? (lbScore?.toFixed(1) ?? "—")}</div>
          <div class="detail-stat-box__label">${entity._kind==="Investor"?"Influence":"Achievements"}</div>
        </div>
        <div class="detail-stat-box">
          <div class="detail-stat-box__val">${percentile}%</div>
          <div class="detail-stat-box__label">Network %ile</div>
        </div>
      </div>

      <hr class="drawer-sep">

      <!-- Influence Score -->
      <div>
        <div class="dp-section-title">Influence Score</div>
        <div class="influence-score-big" id="dpInfluenceNum">${infScore !== null ? infScore : "—"}</div>
        <div class="influence-bar-wrap">
          <div class="influence-bar-track">
            <div class="influence-bar-fill" id="dpInfluenceBar" style="width:0%"></div>
          </div>
          <span style="font-size:0.7rem;color:var(--text-tertiary);font-family:var(--font-mono);white-space:nowrap">${infPct}%ile</span>
        </div>
      </div>

      <hr class="drawer-sep">

      <!-- Profile -->
      <div>
        <div class="dp-section-title">Profile</div>
        ${entity.sector ? `<div class="drawer-kv"><span class="drawer-kv__key">Sector</span><span class="drawer-kv__value">${escapeHtml(entity.sector)}</span></div>` : ""}
        ${entity.stage  ? `<div class="drawer-kv"><span class="drawer-kv__key">Stage</span><span class="drawer-kv__value">${escapeHtml(entity.stage)}</span></div>` : ""}
        ${entity.id     ? `<div class="drawer-kv"><span class="drawer-kv__key">Node ID</span><span class="drawer-kv__value" style="font-size:0.65rem">${escapeHtml(entity.id)}</span></div>` : ""}
        ${secData ? `<div class="drawer-kv"><span class="drawer-kv__key">Sector Ask</span><span class="drawer-kv__value">${formatMoney(secData.total_funding_ask)}</span></div>` : ""}
        ${lbScore !== undefined ? `<div class="drawer-kv"><span class="drawer-kv__key">Investor Score</span><span class="drawer-kv__value">${lbScore.toFixed(2)}</span></div>` : ""}
      </div>

      <hr class="drawer-sep">

      <!-- Relationships -->
      <div>
        <div class="dp-section-title">Relationships (${rels.length})</div>
        ${rels.length ? rels.slice(0,6).map(r => `
          <div class="drawer-rel-item">
            <span class="drawer-rel-type">${escapeHtml(r.type)}</span>
            <span style="color:var(--text-tertiary);font-size:0.7rem">${r.dir}</span>
            <span style="flex:1;font-size:0.8rem">${escapeHtml(r.name)}</span>
          </div>`).join("") : `<div style="font-size:0.78rem;color:var(--text-tertiary)">No direct relationships.</div>`}
      </div>

      <hr class="drawer-sep">

      <!-- Recent Activity -->
      <div>
        <div class="dp-section-title">Recent Activity</div>
        ${activities.length ? activities.map(a => `
          <div class="drawer-activity-item">
            <div class="drawer-activity-dot" style="background:${a.dot}"></div>
            <div class="drawer-activity-text">${escapeHtml(a.text)}</div>
            <div class="drawer-activity-time">${escapeHtml(a.ago)}</div>
          </div>`).join("") : `<div style="font-size:0.78rem;color:var(--text-tertiary)">No recorded activity.</div>`}
      </div>

      <hr class="drawer-sep">

      <!-- Related Entities -->
      <div>
        <div class="dp-section-title">Related Entities (${related.length})</div>
        <div class="related-chips">
          ${related.map(r => `
            <div class="related-chip">
              <span class="related-chip__dot" style="background:${r.color}"></span>
              ${escapeHtml(r.name)}
            </div>`).join("") || `<span style="font-size:0.78rem;color:var(--text-tertiary)">None found.</span>`}
        </div>
      </div>

    </div>`;

  // Animate influence bar
  setTimeout(() => {
    const bar = el("dpInfluenceBar");
    if (bar) bar.style.width = `${infPct}%`;
  }, 100);

  if (typeof feather !== "undefined") feather.replace();
}

function setupExplorer() {
  // Search input
  el("explorerSearchInput")?.addEventListener("input", e => {
    explorerState.query = e.target.value;
    renderExplorer();
  });
  // Tab switching
  el("explorerTabs")?.addEventListener("click", e => {
    const tab = e.target.closest(".explorer-tab");
    if (!tab) return;
    document.querySelectorAll(".explorer-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    explorerState.activeType = tab.dataset.type;
    renderExplorer();
  });
}

// ── Entity Intelligence Drawer ──────────────────────────────────
function openEntityDrawer(entity) {
  const drawer   = el("intelligenceDrawer");
  const backdrop = el("intelligenceDrawerBackdrop");
  if (!drawer) return;

  const COLORS = { Startup:"#3B82F6", Investor:"#F59E0B", Founder:"#10B981", Sector:"#8B5CF6" };
  const color  = COLORS[entity.label] || "#6B7280";
  const initial = (entity.name||"?")[0].toUpperCase();
  const edges  = analystState.data.network?.edges || [];
  const nodes  = analystState.data.network?.nodes || [];

  // Build relationships
  const rels = entity._kind !== "sector"
    ? edges.filter(e => e.source === entity.id || e.target === entity.id).slice(0, 8).map(e => {
        const otherId = e.source === entity.id ? e.target : e.source;
        const other   = nodes.find(n => n.id === otherId);
        const dir     = e.source === entity.id ? "→" : "←";
        return { type: e.type, name: other?.name || otherId, dir };
      })
    : [];

  // Network position
  const degree = rels.length;
  const totalNodes = nodes.length || 1;
  const percentile = Math.round((1 - degree / totalNodes) * 100);

  // Leaderboard score
  const lbScore  = (analystState.data.leaderboard||[]).find(l => l.investor_id === entity.id)?.score;
  const achCount = (analystState.data.achievementLeaders||[]).find(l => l.name === entity.name)?.ach_count;
  const sectors  = analystState.data.sectorTrends || [];
  const secData  = sectors.find(s => s.sector === entity.sector);

  // Sector peers (startups in same sector)
  const peers = entity._kind === "Startup" && entity.sector
    ? nodes.filter(n => n.label === "Startup" && n.sector === entity.sector && n.id !== entity.id).slice(0, 4)
    : [];

  el("drawerTitle").textContent    = entity.name;
  el("drawerSubtitle").textContent = entity.label || entity._kind;

  el("drawerBody").innerHTML = `
    <!-- Profile Header -->
    <div class="drawer-profile-header">
      <div class="drawer-profile-avatar" style="background:${color}">${initial}</div>
      <div>
        <div class="drawer-profile-name">${escapeHtml(entity.name)}</div>
        <div class="drawer-profile-sub">${escapeHtml(entity.label||entity._kind)} ${entity.sector ? `· ${escapeHtml(entity.sector)}` : ""} ${entity.stage ? `· ${escapeHtml(entity.stage)}` : ""}</div>
      </div>
    </div>

    <!-- Profile Details -->
    <div class="drawer-section">
      <div class="drawer-section__title">Profile</div>
      <div class="drawer-kv"><span class="drawer-kv__key">Type</span><span class="drawer-kv__value">${escapeHtml(entity.label||entity._kind)}</span></div>
      ${entity.sector ? `<div class="drawer-kv"><span class="drawer-kv__key">Sector</span><span class="drawer-kv__value">${escapeHtml(entity.sector)}</span></div>` : ""}
      ${entity.stage  ? `<div class="drawer-kv"><span class="drawer-kv__key">Stage</span><span class="drawer-kv__value">${escapeHtml(entity.stage)}</span></div>` : ""}
      ${entity.id     ? `<div class="drawer-kv"><span class="drawer-kv__key">Node ID</span><span class="drawer-kv__value" style="font-size:0.68rem;">${escapeHtml(entity.id)}</span></div>` : ""}
    </div>

    <!-- Funding -->
    ${entity._kind === "Startup" || entity._kind === "sector" ? `
    <div class="drawer-section">
      <div class="drawer-section__title">Funding</div>
      ${achCount !== undefined ? `<div class="drawer-kv"><span class="drawer-kv__key">Achievements (90d)</span><span class="drawer-kv__value">${achCount}</span></div>` : ""}
      ${secData  ? `<div class="drawer-kv"><span class="drawer-kv__key">Sector Ask (Total)</span><span class="drawer-kv__value">${formatMoney(secData.total_funding_ask)}</span></div>` : ""}
      ${secData  ? `<div class="drawer-kv"><span class="drawer-kv__key">Sector Startups</span><span class="drawer-kv__value">${secData.startup_count}</span></div>` : ""}
    </div>` : ""}

    <!-- Investor Score -->
    ${lbScore !== undefined ? `
    <div class="drawer-section">
      <div class="drawer-section__title">Investor Metrics</div>
      <div class="drawer-kv"><span class="drawer-kv__key">Influence Score</span><span class="drawer-kv__value">${lbScore.toFixed(2)}</span></div>
    </div>` : ""}

    <!-- Relationships -->
    ${rels.length ? `
    <div class="drawer-section">
      <div class="drawer-section__title">Relationships (${rels.length})</div>
      ${rels.map(r => `
        <div class="drawer-rel-item">
          <span class="drawer-rel-type">${escapeHtml(r.type)}</span>
          <span>${r.dir}</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(r.name)}</span>
        </div>`).join("")}
    </div>` : `
    <div class="drawer-section">
      <div class="drawer-section__title">Relationships</div>
      <div style="font-size:0.8rem;color:var(--text-tertiary)">No direct relationships in graph data.</div>
    </div>`}

    <!-- Network Position -->
    <div class="drawer-section">
      <div class="drawer-section__title">Network Position</div>
      <div class="drawer-network-stat"><span style="color:var(--text-sec)">Direct Connections</span><strong>${degree}</strong></div>
      <div class="drawer-network-stat"><span style="color:var(--text-sec)">Network Percentile</span><strong>${percentile}th</strong></div>
      <div class="drawer-network-bar"><div class="drawer-network-bar__fill" style="width:0%" id="netBarFill"></div></div>
    </div>

    <!-- Sector Peers -->
    ${peers.length ? `
    <div class="drawer-section">
      <div class="drawer-section__title">Sector Peers</div>
      ${peers.map(p => `
        <div class="drawer-kv" style="cursor:pointer" onclick="openEntityDrawer(${JSON.stringify({...p,_kind:p.label})}">
          <span class="drawer-kv__key">${escapeHtml(p.name)}</span>
          <span class="sp-badge sp-badge--blue" style="font-size:0.6rem">${escapeHtml(p.label)}</span>
        </div>`).join("")}
    </div>` : ""}`;

  drawer.classList.add("active");
  backdrop?.classList.add("active");

  // Animate network bar
  setTimeout(() => {
    const bar = el("netBarFill");
    if (bar) bar.style.width = `${Math.min(100, degree * 10)}%`;
  }, 100);

  if (typeof feather !== "undefined") feather.replace();
}

// keep backward-compat alias used in HTML onclick attrs
function openIntelligenceDrawer(name, label = "Entity") {
  openEntityDrawer({ id: name, name, label, _kind: label });
}

function closeIntelligenceDrawer() {
  el("intelligenceDrawer")?.classList.remove("active");
  el("intelligenceDrawerBackdrop")?.classList.remove("active");
}

// ── Command Palette ─────────────────────────────────────────────
function openCommandPalette() {
  el("commandPalette")?.classList.add("active");
  analystState.commandPaletteOpen = true;
  const inp = el("commandPaletteInput");
  if (inp) { inp.value = ""; inp.focus(); }
  renderPaletteList("");
}
function closeCommandPalette() {
  el("commandPalette")?.classList.remove("active");
  analystState.commandPaletteOpen = false;
}
function toggleCommandPalette() { analystState.commandPaletteOpen ? closeCommandPalette() : openCommandPalette(); }

function renderPaletteList(q) {
  const list = el("commandPaletteResults"); if (!list) return;
  const filtered = q ? COMMAND_REGISTRY.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : COMMAND_REGISTRY;
  if (!filtered.length) { list.innerHTML = `<div style="padding:14px 20px;color:var(--text-tertiary);font-size:0.85rem">No commands matched.</div>`; return; }
  list.innerHTML = filtered.map((cmd,i) => `<button class="command-palette__item" data-page="${escapeHtml(cmd.page)}"><span>${escapeHtml(cmd.label)}</span><span class="command-palette__shortcut">↵</span></button>`).join("");
  list.querySelectorAll(".command-palette__item").forEach(btn => btn.addEventListener("click", () => { navigate(btn.dataset.page); closeCommandPalette(); }));
}

// ── Reports ─────────────────────────────────────────────────────
function setupReports() {
  el("reportsGenerateBtn")?.addEventListener("click", () => {
    const type = el("reportsSelectType")?.value || "weekly";
    el("reportsPreviewArea").innerHTML = _buildReportHTML(type);
    showToast("Report compiled.", "success");
    if (typeof feather !== "undefined") feather.replace();
  });
  el("reportsExportCSV")?.addEventListener("click", _exportReportCSV);
  el("reportsExportExcel")?.addEventListener("click", _exportReportExcel);
  el("reportsExportPDF")?.addEventListener("click", _exportReportPDF);
}

// ── Init ────────────────────────────────────────────────────────
async function initAnalystPage() {
  const user = (typeof requireAuth === "function") ? requireAuth("ANALYST") : null;
  const nameEl = el("topBarUserName");
  if (nameEl && user?.name) nameEl.textContent = user.name;

  // Sidebar nav
  document.querySelectorAll(".sp-nav-item").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.page)));

  // Top bar
  el("refreshWorkspaceButton")?.addEventListener("click", () => window.location.reload());
  el("logoutButton")?.addEventListener("click", () => { if (typeof logout === "function") logout(); });
  el("topBarSearchTrigger")?.addEventListener("click", openCommandPalette);

  // Drawer
  el("drawerCloseBtn")?.addEventListener("click", closeIntelligenceDrawer);
  el("intelligenceDrawerBackdrop")?.addEventListener("click", closeIntelligenceDrawer);

  // Palette
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey||e.metaKey) && e.key==="k") { e.preventDefault(); toggleCommandPalette(); }
    if (e.key==="Escape" && analystState.commandPaletteOpen) closeCommandPalette();
  });
  el("commandPaletteInput")?.addEventListener("input", e => renderPaletteList(e.target.value));
  el("commandPalette")?.addEventListener("click", e => { if (e.target===e.currentTarget) closeCommandPalette(); });

  setupReports();
  setupExplorer();
  setupStartupIntel();
  setupInvestorIntel();

  // Load data
  try {
    const [network, sectorTrends, hotSectors, leaderboard, achievementLeaders] = await Promise.all([
      apiCall("GET","/analytics/network"),
      apiCall("GET","/analytics/sector-trends"),
      apiCall("GET","/analytics/hot-sectors"),
      apiCall("GET","/analytics/leaderboard"),
      apiCall("GET","/analytics/achievement-leaders"),
    ]);
    let influence = [];
    try { const r = await apiCall("GET","/analytics/influence"); influence = r?.items || []; } catch(_){}
    analystState.data = {
      network:           network?.items        || { nodes:[], edges:[] },
      sectorTrends:      sectorTrends?.items   || [],
      hotSectors:        hotSectors?.items     || [],
      leaderboard:       leaderboard?.items    || [],
      achievementLeaders:achievementLeaders?.items || [],
      influence,
      _loaded: true,
    };
    const badge = el("apiHealthBadge") || document.querySelector(".sp-badge.sp-badge--green");
    if (badge) { badge.textContent = "Ecosystem Synced"; badge.className = "sp-badge sp-badge--green"; }
    renderGraph(analystState.data.network);
    renderMiniGraph(analystState.data.network);
  } catch(err) {
    analystState.data = { network:{nodes:[],edges:[]}, sectorTrends:[], hotSectors:[], leaderboard:[], achievementLeaders:[], _loaded:true };
    showToast("Some data failed to load.", "warn");
    renderGraph(analystState.data.network);
    renderMiniGraph(analystState.data.network);
  }

  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE LAYER — Shared helpers
// ═══════════════════════════════════════════════════════════════

// Chart.js global defaults (dark theme)
function applyChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color = "#94A3B8";
  Chart.defaults.borderColor = "rgba(255,255,255,0.07)";
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
}

// Destroy old chart and draw new one
const _charts = {};
function makeChart(id, config) {
  if (typeof Chart === "undefined") return;
  applyChartDefaults();
  const canvas = el(id);
  if (!canvas) return;
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  _charts[id] = new Chart(canvas, config);
}

// Chart palette
const CHART_COLORS = ["#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444","#06B6D4","#EC4899","#F97316"];

// Reusable ranking table builder
function buildRankTable(containerId, rows, columns, maxVal) {
  const container = el(containerId);
  if (!container) return;
  if (!rows.length) { container.innerHTML = '<div class="intel-loading">No data available</div>'; return; }

  const thead = `<thead><tr>${columns.map(c => "<th>" + c + "</th>").join("")}</tr></thead>`;
  const tbody = "<tbody>" + rows.map((r, i) => {
    const pct = maxVal > 0 ? Math.round((r.val / maxVal) * 100) : 0;
    return `<tr>
      <td>#${i + 1}</td>
      <td class="name-cell">${escapeHtml(r.name)}</td>
      ${r.meta ? `<td><span class="sp-badge sp-badge--blue" style="font-size:0.65rem">${escapeHtml(r.meta)}</span></td>` : ""}
      <td>
        <div class="intel-mini-bar-wrap">
          <div class="intel-mini-bar"><div class="intel-mini-bar__fill" style="width:0%" data-pct="${pct}"></div></div>
          <span class="intel-mini-bar__val">${escapeHtml(String(r.val))}</span>
        </div>
      </td>
    </tr>`;
  }).join("") + "</tbody>";

  container.innerHTML = `<table class="intel-rank-table">${thead}${tbody}</table>`;

  // Animate bars
  requestAnimationFrame(() => {
    container.querySelectorAll(".intel-mini-bar__fill").forEach(bar => {
      bar.style.width = bar.dataset.pct + "%";
    });
  });
}

// Populate sector <select> dropdowns
function populateSectorSelects(...selectIds) {
  const sectors = [...new Set((analystState.data.sectorTrends || []).map(s => s.sector))];
  selectIds.forEach(id => {
    const sel = el(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Sectors</option>' +
      sectors.map(s => `<option value="${escapeHtml(s)}"${s === current ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");
  });
}

// Export table rows to CSV
function exportTableCSV(rows, headers, filename) {
  const lines = [headers.join(","),
    ...rows.map(r => [r.rank, r.name, r.meta || "", r.val].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ═══════════════════════════════════════════════════════════════
// STARTUP INTELLIGENCE PAGE
// ═══════════════════════════════════════════════════════════════

const stFilter = { sector: "", stage: "", search: "", sort: "ach" };

function setupStartupIntel() {
  el("stApplyFilter")?.addEventListener("click", () => {
    stFilter.sector = el("stFilterSector")?.value || "";
    stFilter.stage  = el("stFilterStage")?.value  || "";
    stFilter.search = el("stFilterSearch")?.value  || "";
    stFilter.sort   = el("stFilterSort")?.value   || "ach";
    renderStartupIntel();
  });
  el("stFilterSearch")?.addEventListener("keydown", e => {
    if (e.key === "Enter") el("stApplyFilter")?.click();
  });
  el("startupExportCSV")?.addEventListener("click", exportStartupCSV);
  el("startupExportPDF")?.addEventListener("click", () => showToast("PDF export requires a print-ready build.", "info"));
}

function renderStartupIntel() {
  const d = analystState.data;
  if (!d._loaded) return;

  populateSectorSelects("stFilterSector", "invFilterSector");

  const nodes   = d.network?.nodes || [];
  const edges   = d.network?.edges || [];
  const achLeaders = d.achievementLeaders || [];
  const influence  = d.influence || [];
  const sectors    = d.sectorTrends || [];

  // Startups filtered
  let startups = nodes.filter(n => n.label === "Startup");
  if (stFilter.sector) startups = startups.filter(s => s.sector === stFilter.sector);
  if (stFilter.stage)  startups = startups.filter(s => s.stage  === stFilter.stage);
  if (stFilter.search) startups = startups.filter(s => s.name.toLowerCase().includes(stFilter.search.toLowerCase()));

  // Build enriched list
  const inflMap = Object.fromEntries(influence.filter(i => i.label === "Startup").map(i => [i.id, i.influence_score]));
  const achMap  = Object.fromEntries(achLeaders.map(a => [a.name, a.ach_count]));
  const edgeCnt = id => edges.filter(e => e.source === id || e.target === id).length;

  const enriched = startups.map(s => ({
    ...s,
    ach_count:   achMap[s.name] || 0,
    connections: edgeCnt(s.id),
    infl_score:  inflMap[s.id] || 0,
  }));

  // Sort
  if (stFilter.sort === "ach")         enriched.sort((a,b) => b.ach_count   - a.ach_count);
  else if (stFilter.sort === "connections") enriched.sort((a,b) => b.connections - a.connections);
  else if (stFilter.sort === "influence")   enriched.sort((a,b) => b.infl_score  - a.infl_score);

  // ── KPIs
  const topAch  = achLeaders[0];
  const topConn = [...enriched].sort((a,b) => b.connections - a.connections)[0];
  const topInfl = [...enriched].sort((a,b) => b.infl_score  - a.infl_score)[0];
  if (el("stKpiTotal"))       el("stKpiTotal").textContent = enriched.length;
  if (el("stKpiTopAch"))      el("stKpiTopAch").textContent = topAch ? topAch.ach_count : "—";
  if (el("stKpiConnected"))   el("stKpiConnected").textContent = topConn ? topConn.name : "—";
  if (el("stKpiTopInfluence")) el("stKpiTopInfluence").textContent = topInfl ? topInfl.infl_score : "—";

  // ── Ranking Tables
  const achRows  = achLeaders.slice(0,10).map(a => ({ name: a.name, meta: a.sector, val: a.ach_count }));
  const connRows = [...enriched].sort((a,b) => b.connections - a.connections).slice(0,10).map(s => ({ name: s.name, meta: s.sector, val: s.connections }));
  const inflRows = [...enriched].sort((a,b) => b.infl_score - a.infl_score).slice(0,10).map(s => ({ name: s.name, meta: s.sector, val: s.infl_score }));

  buildRankTable("startupRankAch",  achRows,  ["#","Startup","Sector","Achievements"], Math.max(...achRows.map(r=>r.val),1));
  buildRankTable("startupRankConn", connRows, ["#","Startup","Sector","Connections"],  Math.max(...connRows.map(r=>r.val),1));
  buildRankTable("startupRankInfl", inflRows, ["#","Startup","Sector","Infl. Score"],  Math.max(...inflRows.map(r=>r.val),1));

  // Funding table (from sectors × startups)
  const fundRows = [...enriched].sort((a,b) => {
    const sa = sectors.find(s=>s.sector===a.sector);
    const sb = sectors.find(s=>s.sector===b.sector);
    return (sb?.total_funding_ask||0) - (sa?.total_funding_ask||0);
  }).slice(0,10).map(s => {
    const sec = sectors.find(x=>x.sector===s.sector);
    return { name: s.name, meta: s.stage, val: formatMoney(sec?.total_funding_ask||0) };
  });
  buildRankTable("startupRankFund", fundRows, ["#","Startup","Stage","Sector Ask"], 1);

  // ── Charts
  buildStartupCharts(enriched, sectors, achLeaders);
}

function buildStartupCharts(enriched, sectors, achLeaders) {
  if (typeof Chart === "undefined") return;

  // 1. Funding vs Attention Scatter
  const hotMap = Object.fromEntries((analystState.data.hotSectors || []).map(h => [h.sector, h.interest_count]));
  makeChart("chartFundingAttention", {
    type: "scatter",
    data: {
      datasets: [{
        label: "Startups",
        data: enriched.slice(0, 40).map(s => {
          const sec = sectors.find(x => x.sector === s.sector);
          return { x: (sec?.total_funding_ask || 0) / 1e5, y: hotMap[s.sector] || 0, name: s.name };
        }),
        backgroundColor: "rgba(59,130,246,0.6)",
        pointRadius: 6,
        pointHoverRadius: 9,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw.name } } },
      scales: {
        x: { title: { display: true, text: "Funding Ask (L)", color: "#64748B" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { title: { display: true, text: "Investor Attention", color: "#64748B" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  // 2. Sector Distribution Doughnut
  makeChart("chartSectorDist", {
    type: "doughnut",
    data: {
      labels: sectors.map(s => s.sector),
      datasets: [{ data: sectors.map(s => s.startup_count), backgroundColor: CHART_COLORS, borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 10 } } }, cutout: "60%" }
  });

  // 3. Achievement Velocity Bar
  const achTop = achLeaders.slice(0, 8);
  makeChart("chartAchVelocity", {
    type: "bar",
    data: {
      labels: achTop.map(a => a.name.split(" ")[0]),
      datasets: [{ label: "Achievements (90d)", data: achTop.map(a => a.ach_count), backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 }]
    },
    options: {
      responsive: true, indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: "rgba(255,255,255,0.05)" } }, y: { grid: { display: false } } }
    }
  });

  // 4. Lifecycle (stage split)
  const stageCounts = {};
  enriched.forEach(s => { stageCounts[s.stage || "Unknown"] = (stageCounts[s.stage || "Unknown"] || 0) + 1; });
  makeChart("chartLifecycle", {
    type: "pie",
    data: {
      labels: Object.keys(stageCounts),
      datasets: [{ data: Object.values(stageCounts), backgroundColor: CHART_COLORS, borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 10 } } } }
  });
}

function exportStartupCSV() {
  const rows = (analystState.data.achievementLeaders || []).map((a, i) => ({
    rank: i + 1, name: a.name, meta: a.sector, val: a.ach_count
  }));
  exportTableCSV(rows, ["Rank","Name","Sector","Achievements"], "startup_intelligence.csv");
  showToast("CSV exported.", "success");
}

// ═══════════════════════════════════════════════════════════════
// INVESTOR INTELLIGENCE PAGE
// ═══════════════════════════════════════════════════════════════

const invFilter = { sector: "", search: "", sort: "influence" };

function setupInvestorIntel() {
  el("invApplyFilter")?.addEventListener("click", () => {
    invFilter.sector = el("invFilterSector")?.value || "";
    invFilter.search = el("invFilterSearch")?.value || "";
    invFilter.sort   = el("invFilterSort")?.value   || "influence";
    renderInvestorIntel();
  });
  el("invFilterSearch")?.addEventListener("keydown", e => {
    if (e.key === "Enter") el("invApplyFilter")?.click();
  });
  el("investorExportCSV")?.addEventListener("click", exportInvestorCSV);
  el("investorExportPDF")?.addEventListener("click", () => showToast("PDF export requires a print-ready build.", "info"));
}

function renderInvestorIntel() {
  const d = analystState.data;
  if (!d._loaded) return;

  populateSectorSelects("stFilterSector", "invFilterSector");

  const nodes     = d.network?.nodes || [];
  const edges     = d.network?.edges || [];
  const influence = d.influence || [];
  const leaderboard = d.leaderboard || [];
  const sectors   = d.sectorTrends || [];

  // Investors
  let investors = nodes.filter(n => n.label === "Investor");
  if (invFilter.search) investors = investors.filter(i => i.name.toLowerCase().includes(invFilter.search.toLowerCase()));

  const inflMap   = Object.fromEntries(influence.filter(i => i.label === "Investor").map(i => [i.id, i.influence_score]));
  const lbMap     = Object.fromEntries(leaderboard.map(l => [l.investor_id, l.score]));
  const edgeCnt   = id => edges.filter(e => e.source === id || e.target === id).length;

  const enriched = investors.map(i => ({
    ...i,
    infl_score:  inflMap[i.id] || 0,
    lb_score:    lbMap[i.id]   || 0,
    connections: edgeCnt(i.id),
  }));

  // Sort
  if (invFilter.sort === "influence")   enriched.sort((a,b) => b.infl_score  - a.infl_score);
  else if (invFilter.sort === "connections") enriched.sort((a,b) => b.connections - a.connections);
  else if (invFilter.sort === "leaderboard") enriched.sort((a,b) => b.lb_score   - a.lb_score);

  // ── KPIs
  const topInfl = enriched[0];
  const topConn = [...enriched].sort((a,b) => b.connections - a.connections)[0];
  const topLb   = [...enriched].sort((a,b) => b.lb_score - a.lb_score)[0];
  if (el("invKpiTotal"))     el("invKpiTotal").textContent = enriched.length;
  if (el("invKpiTopInfl"))   el("invKpiTopInfl").textContent = topInfl?.infl_score || "—";
  if (el("invKpiConnected")) el("invKpiConnected").textContent = topConn?.name || "—";
  if (el("invKpiTopScore"))  el("invKpiTopScore").textContent = topLb?.lb_score?.toFixed(1) || "—";

  // ── Ranking Tables
  const inflRows = enriched.slice(0, 10).map(i => ({ name: i.name, meta: i.label, val: i.infl_score }));
  const connRows = [...enriched].sort((a,b) => b.connections - a.connections).slice(0,10).map(i => ({ name: i.name, meta: null, val: i.connections }));
  const lbRows   = leaderboard.slice(0, 10).map((l, idx) => {
    const node = nodes.find(n => n.id === l.investor_id);
    return { name: node?.name || l.investor_id, meta: null, val: parseFloat(l.score.toFixed(2)) };
  });

  buildRankTable("investorRankInfl",  inflRows, ["#","Investor","Type","Infl. Score"],  Math.max(...inflRows.map(r=>r.val),1));
  buildRankTable("investorRankConn",  connRows, ["#","Investor","","Connections"],       Math.max(...connRows.map(r=>r.val),1));
  buildRankTable("investorRankRedis", lbRows,   ["#","Investor","","Redis Score"],       Math.max(...lbRows.map(r=>r.val),1));

  // ── Charts
  buildInvestorCharts(enriched, sectors);
}

function buildInvestorCharts(enriched, sectors) {
  if (typeof Chart === "undefined") return;

  // 1. Sector preference (derived from connections to startups by sector)
  const sectorPref = {};
  const nodes = analystState.data.network?.nodes || [];
  const edges = analystState.data.network?.edges || [];
  enriched.forEach(inv => {
    edges.filter(e => e.source === inv.id && e.type === "INTERESTED_IN").forEach(e => {
      const startup = nodes.find(n => n.id === e.target);
      if (startup?.sector) sectorPref[startup.sector] = (sectorPref[startup.sector] || 0) + 1;
    });
  });
  const secLabels = Object.keys(sectorPref);
  const secData   = Object.values(sectorPref);

  if (secLabels.length) {
    makeChart("chartInvSectorPref", {
      type: "bar",
      data: {
        labels: secLabels,
        datasets: [{ label: "Interest Signals", data: secData, backgroundColor: CHART_COLORS, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(255,255,255,0.05)" } } }
      }
    });
  } else {
    // Fallback: use sector trends as preference proxy
    makeChart("chartInvSectorPref", {
      type: "bar",
      data: {
        labels: sectors.map(s => s.sector),
        datasets: [{ label: "Funding Ask (L)", data: sectors.map(s => Math.round((s.total_funding_ask||0)/1e5)), backgroundColor: CHART_COLORS, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(255,255,255,0.05)" } } }
      }
    });
  }

  // 2. Investor influence distribution (histogram buckets)
  const buckets = ["0-5","6-10","11-20","21-50","50+"];
  const counts  = [0, 0, 0, 0, 0];
  enriched.forEach(i => {
    const s = i.infl_score;
    if (s <= 5)  counts[0]++;
    else if (s <= 10) counts[1]++;
    else if (s <= 20) counts[2]++;
    else if (s <= 50) counts[3]++;
    else counts[4]++;
  });
  makeChart("chartInvInfl", {
    type: "bar",
    data: {
      labels: buckets,
      datasets: [{ label: "Investors", data: counts, backgroundColor: "rgba(139,92,246,0.7)", borderRadius: 4 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { stepSize: 1 } } }
    }
  });
}

function exportInvestorCSV() {
  const nodes = analystState.data.network?.nodes || [];
  const rows = (analystState.data.leaderboard || []).map((l, i) => {
    const node = nodes.find(n => n.id === l.investor_id);
    return { rank: i + 1, name: node?.name || l.investor_id, meta: "", val: l.score.toFixed(2) };
  });
  exportTableCSV(rows, ["Rank","Investor","Type","Score"], "investor_intelligence.csv");
  showToast("CSV exported.", "success");
}

// ═══════════════════════════════════════════════════════════════
// SECTOR ANALYTICS PAGE
// ═══════════════════════════════════════════════════════════════

function renderSectorAnalytics() {
  const d = analystState.data;
  if (!d._loaded) return;

  const sectors = d.sectorTrends || [];
  const hot     = d.hotSectors   || [];
  const nodes   = d.network?.nodes || [];
  const edges   = d.network?.edges || [];
  const hotMap  = Object.fromEntries(hot.map(h => [h.sector, h.interest_count]));

  // Connection density per sector
  const sectorConns = {};
  nodes.filter(n => n.label === "Startup").forEach(n => {
    const cnt = edges.filter(e => e.source === n.id || e.target === n.id).length;
    sectorConns[n.sector] = (sectorConns[n.sector] || 0) + cnt;
  });

  // Comparison matrix
  const maxAsk = Math.max(...sectors.map(s => s.total_funding_ask || 0), 1);
  const matrixRows = sectors.map(s => {
    const intents = hotMap[s.sector] || 0;
    const conns   = sectorConns[s.sector] || 0;
    const avgAsk  = s.startup_count > 0 ? Math.round((s.total_funding_ask || 0) / s.startup_count) : 0;
    const momentum = intents > 3 ? "Rapid" : intents > 0 ? "Steady" : "Dormant";
    const momClass = intents > 3 ? "green" : intents > 0 ? "blue" : "yellow";
    const pct = Math.round(((s.total_funding_ask || 0) / maxAsk) * 100);
    return { sector: s.sector, count: s.startup_count, ask: s.total_funding_ask, avgAsk, intents, conns, momentum, momClass, pct };
  });

  const container = el("sectorsComparisonMatrix");
  if (container) {
    const thead = `<thead><tr><th>#</th><th>Sector</th><th>Startups</th><th>Total Ask</th><th>Avg Ticket</th><th>Intents</th><th>Connections</th><th>Demand</th><th>Momentum</th></tr></thead>`;
    const tbody = "<tbody>" + matrixRows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td class="name-cell">${escapeHtml(r.sector)}</td>
      <td>${r.count}</td>
      <td style="color:var(--primary);font-weight:600">${formatMoney(r.ask)}</td>
      <td>${formatMoney(r.avgAsk)}</td>
      <td>${r.intents}</td>
      <td>${r.conns}</td>
      <td><div class="intel-mini-bar-wrap"><div class="intel-mini-bar"><div class="intel-mini-bar__fill" style="width:0%" data-pct="${r.pct}"></div></div><span class="intel-mini-bar__val">${r.pct}%</span></div></td>
      <td><span class="sp-badge sp-badge--${r.momClass}">${r.momentum}</span></td>
    </tr>`).join("") + "</tbody>";
    container.innerHTML = `<table class="intel-rank-table">${thead}${tbody}</table>`;
    requestAnimationFrame(() => {
      container.querySelectorAll(".intel-mini-bar__fill").forEach(b => { b.style.width = b.dataset.pct + "%"; });
    });
  }

  // Funding Demand Chart
  makeChart("chartSectorsFundingAsk", {
    type: "bar",
    data: {
      labels: sectors.map(s => s.sector),
      datasets: [{ label: "Funding Ask (₹L)", data: sectors.map(s => Math.round((s.total_funding_ask || 0) / 1e5)), backgroundColor: CHART_COLORS, borderRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(255,255,255,0.05)" } } } }
  });

  // Interest Analysis Chart
  const interestLabels = sectors.map(s => s.sector);
  const interestData   = sectors.map(s => hotMap[s.sector] || 0);
  makeChart("chartSectorsInterest", {
    type: "doughnut",
    data: {
      labels: interestLabels,
      datasets: [{ data: interestData.map(v => v || 1), backgroundColor: CHART_COLORS, borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 8 } } }, cutout: "55%" }
  });

  if (typeof feather !== "undefined") feather.replace();
}

// ═══════════════════════════════════════════════════════════════
// PREDICTIVE INSIGHTS PAGE
// ═══════════════════════════════════════════════════════════════

function renderPredictive() {
  const d = analystState.data;
  if (!d._loaded) return;

  const sectors  = d.sectorTrends || [];
  const hot      = d.hotSectors   || [];
  const nodes    = d.network?.nodes || [];
  const edges    = d.network?.edges || [];
  const leaders  = d.achievementLeaders || [];
  const influence = d.influence || [];
  const leaderboard = d.leaderboard || [];
  const hotMap   = Object.fromEntries(hot.map(h => [h.sector, h.interest_count]));

  // Compute signals
  const totalAsk = sectors.reduce((s, r) => s + (r.total_funding_ask || 0), 0);
  const avgAsk   = sectors.length ? totalAsk / sectors.length : 0;

  // Emerging sectors: highest interest + above average ask
  const emerging = sectors.map(s => {
    const intents = hotMap[s.sector] || 0;
    const askRatio = avgAsk > 0 ? (s.total_funding_ask || 0) / avgAsk : 1;
    const conf = Math.min(98, Math.round(40 + intents * 8 + askRatio * 10 + s.startup_count * 2));
    return { sector: s.sector, confidence: conf, intents, startups: s.startup_count, ask: s.total_funding_ask, dir: intents > 2 ? "▲" : intents > 0 ? "→" : "▼" };
  }).sort((a, b) => b.confidence - a.confidence);

  // Rising investors: top leaderboard score acceleration
  const invNodes = nodes.filter(n => n.label === "Investor");
  const inflMap  = Object.fromEntries(influence.filter(i => i.label === "Investor").map(i => [i.id, i.influence_score]));
  const rising = leaderboard.slice(0, 5).map(l => {
    const node = nodes.find(n => n.id === l.investor_id);
    const infl = inflMap[l.investor_id] || 0;
    const conf = Math.min(95, Math.round(50 + l.score * 5 + infl));
    return { name: node?.name || l.investor_id, score: l.score, infl, confidence: conf };
  });

  // High potential startups: top achievement velocity + connections
  const achMap = Object.fromEntries(leaders.map(a => [a.name, a.ach_count]));
  const startups = nodes.filter(n => n.label === "Startup");
  const highPot = startups.map(s => {
    const ach = achMap[s.name] || 0;
    const conns = edges.filter(e => e.source === s.id || e.target === s.id).length;
    const conf = Math.min(96, Math.round(30 + ach * 15 + conns * 3));
    return { name: s.name, sector: s.sector, ach, conns, confidence: conf };
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 5);

  // Bottlenecks: sectors with high ask but low investor connections
  const sectorInvConns = {};
  invNodes.forEach(inv => {
    edges.filter(e => e.source === inv.id).forEach(e => {
      const tgt = nodes.find(n => n.id === e.target);
      if (tgt?.sector) sectorInvConns[tgt.sector] = (sectorInvConns[tgt.sector] || 0) + 1;
    });
  });
  const bottlenecks = sectors.filter(s => {
    const ask = s.total_funding_ask || 0;
    const invC = sectorInvConns[s.sector] || 0;
    return ask > avgAsk * 0.8 && invC < 5;
  }).map(s => ({ sector: s.sector, ask: s.total_funding_ask, invConns: sectorInvConns[s.sector] || 0 }));

  // Render hotspots panel
  const hpEl = el("predictiveHotspots");
  if (hpEl) {
    let html = `<div class="dp-section-title" style="margin-bottom:8px">Emerging Sectors</div>`;
    html += emerging.slice(0, 4).map(e => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:600">
          <span>${e.dir} ${escapeHtml(e.sector)}</span>
          <span style="color:${e.confidence > 70 ? 'var(--success)' : 'var(--warning)'}">${e.confidence}%</span>
        </div>
        <div class="confidence-bar"><div class="confidence-bar__fill" style="width:${e.confidence}%"></div></div>
        <div style="font-size:0.7rem;color:var(--text-tertiary);margin-top:2px">${e.startups} startups · ${e.intents} intents · ${formatMoney(e.ask)} ask</div>
      </div>`).join("");

    html += `<hr class="drawer-sep"><div class="dp-section-title" style="margin-bottom:8px">Rising Investors</div>`;
    html += rising.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-weight:600">${escapeHtml(r.name)}</span>
        <span class="sp-badge sp-badge--green" style="font-size:0.65rem">${r.confidence}% conf.</span>
      </div>`).join("");

    html += `<hr class="drawer-sep"><div class="dp-section-title" style="margin-bottom:8px">High Potential Startups</div>`;
    html += highPot.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div><span style="font-weight:600">${escapeHtml(s.name)}</span> <span style="color:var(--text-tertiary);font-size:0.7rem">· ${escapeHtml(s.sector)}</span></div>
        <span class="sp-badge sp-badge--blue" style="font-size:0.65rem">${s.confidence}%</span>
      </div>`).join("");

    hpEl.innerHTML = html;
  }

  // Render risks panel
  const riskEl = el("predictiveRisks");
  if (riskEl) {
    let html = `<div class="dp-section-title" style="margin-bottom:8px">Network Bottlenecks</div>`;
    if (bottlenecks.length) {
      html += bottlenecks.map(b => `
        <div style="display:flex;gap:10px;align-items:start;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <span class="sp-badge sp-badge--red" style="font-size:0.65rem">Bottleneck</span>
          <div>
            <strong style="font-size:0.82rem">${escapeHtml(b.sector)}</strong>
            <p style="font-size:0.72rem;color:var(--text-sec);margin-top:2px">Ask: ${formatMoney(b.ask)} with only ${b.invConns} investor connections — supply-demand gap detected.</p>
          </div>
        </div>`).join("");
    } else {
      html += `<div style="font-size:0.8rem;color:var(--text-tertiary);padding:8px 0">No critical bottlenecks detected. All sectors have adequate investor coverage.</div>`;
    }

    // Risk signals: sectors with zero interest
    const dormant = sectors.filter(s => !(hotMap[s.sector]));
    html += `<hr class="drawer-sep"><div class="dp-section-title" style="margin-bottom:8px">Risk Signals</div>`;
    if (dormant.length) {
      html += dormant.map(s => `
        <div style="display:flex;gap:10px;align-items:start;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <span class="sp-badge sp-badge--yellow" style="font-size:0.65rem">Low Activity</span>
          <div>
            <strong style="font-size:0.82rem">${escapeHtml(s.sector)}</strong>
            <p style="font-size:0.72rem;color:var(--text-sec);margin-top:2px">${s.startup_count} startups with ${formatMoney(s.total_funding_ask)} ask but zero recent investor interest signals.</p>
          </div>
        </div>`).join("");
    } else {
      html += `<div style="font-size:0.8rem;color:var(--success);padding:8px 0">✓ All sectors showing healthy activity levels.</div>`;
    }

    // Funding hotspot summary
    const topFunding = [...sectors].sort((a, b) => (b.total_funding_ask || 0) - (a.total_funding_ask || 0))[0];
    if (topFunding) {
      html += `<hr class="drawer-sep"><div class="dp-section-title" style="margin-bottom:8px">Funding Hotspot</div>`;
      html += `<div style="padding:10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:6px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--primary)">${escapeHtml(topFunding.sector)}</div>
        <div style="font-size:0.75rem;color:var(--text-sec);margin-top:4px">Highest capital demand at ${formatMoney(topFunding.total_funding_ask)} across ${topFunding.startup_count} startups.</div>
      </div>`;
    }

    riskEl.innerHTML = html;
  }

  if (typeof feather !== "undefined") feather.replace();
}

// ═══════════════════════════════════════════════════════════════
// REPORTS PAGE (upgraded)
// ═══════════════════════════════════════════════════════════════

let _lastReportData = null;

function renderReportsPage() {
  if (typeof feather !== "undefined") feather.replace();
}

function _buildReportHTML(type) {
  const d = analystState.data;
  const nodes = d.network?.nodes || [];
  const edges = d.network?.edges || [];
  const sectors = d.sectorTrends || [];
  const hot = d.hotSectors || [];
  const leaders = d.achievementLeaders || [];
  const leaderboard = d.leaderboard || [];
  const startups = nodes.filter(n => n.label === "Startup");
  const investors = nodes.filter(n => n.label === "Investor");
  const totalAsk = sectors.reduce((s, r) => s + (r.total_funding_ask || 0), 0);
  const ts = new Date().toLocaleString();

  const hdr = (title) => `<h4 style="font-size:1rem;font-weight:700;margin:0 0 6px">${escapeHtml(title)}</h4><p style="font-size:0.72rem;color:var(--text-tertiary);margin-bottom:14px">Generated: ${ts}</p><hr style="border-color:var(--border-color);margin-bottom:14px">`;
  const kv = (k, v) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.82rem;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:var(--text-sec)">${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`;

  const sectorTable = `<table class="intel-rank-table" style="margin-top:10px"><thead><tr><th>Sector</th><th>Startups</th><th>Total Ask</th></tr></thead><tbody>${sectors.map(s => `<tr><td>${escapeHtml(s.sector)}</td><td>${s.startup_count}</td><td>${formatMoney(s.total_funding_ask)}</td></tr>`).join("")}</tbody></table>`;

  _lastReportData = { type, sectors, leaders, leaderboard, startups, investors, edges, nodes };

  if (type === "weekly") {
    return hdr("Weekly Ecosystem Overview") +
      kv("Total Startups", startups.length) + kv("Total Investors", investors.length) +
      kv("Total Connections", edges.length) + kv("Aggregate Funding Demand", formatMoney(totalAsk)) +
      kv("Active Sectors", sectors.length) + kv("Achievement Leaders", leaders.length) +
      `<h5 style="font-size:0.85rem;font-weight:600;margin:16px 0 6px">Sector Breakdown</h5>` + sectorTable;
  }
  if (type === "monthly") {
    return hdr("Monthly Capital Deployment") +
      kv("Capital Demand", formatMoney(totalAsk)) + kv("Sectors Active", sectors.length) +
      kv("Investor Pool", investors.length) + kv("Graph Edges", edges.length) +
      `<h5 style="font-size:0.85rem;font-weight:600;margin:16px 0 6px">Sector Capital Allocation</h5>` + sectorTable;
  }
  if (type === "investor") {
    const invTable = `<table class="intel-rank-table" style="margin-top:10px"><thead><tr><th>#</th><th>Investor</th><th>Score</th></tr></thead><tbody>${leaderboard.slice(0, 15).map((l, i) => { const n = nodes.find(x => x.id === l.investor_id); return `<tr><td>${i + 1}</td><td>${escapeHtml(n?.name || l.investor_id)}</td><td>${l.score.toFixed(1)}</td></tr>`; }).join("")}</tbody></table>`;
    return hdr("Investor Intelligence Ledger") +
      kv("Total Investors", investors.length) + kv("Leaderboard Entries", leaderboard.length) +
      `<h5 style="font-size:0.85rem;font-weight:600;margin:16px 0 6px">Top Investors by Score</h5>` + invTable;
  }
  if (type === "startup") {
    const achTable = `<table class="intel-rank-table" style="margin-top:10px"><thead><tr><th>#</th><th>Startup</th><th>Sector</th><th>Ach.</th></tr></thead><tbody>${leaders.slice(0, 15).map((l, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.sector || "—")}</td><td>${l.ach_count}</td></tr>`).join("")}</tbody></table>`;
    return hdr("Startup Growth & Achievement Report") +
      kv("Total Startups", startups.length) + kv("Achievement Leaders", leaders.length) +
      `<h5 style="font-size:0.85rem;font-weight:600;margin:16px 0 6px">Top Startups by Achievements</h5>` + achTable;
  }
  return `<p>Unknown report type.</p>`;
}

function _exportReportCSV() {
  if (!_lastReportData) { showToast("Compile a report first.", "warn"); return; }
  const r = _lastReportData;
  let headers, rows;
  if (r.type === "weekly" || r.type === "monthly") {
    headers = ["Sector", "Startups", "Total Ask"];
    rows = r.sectors.map(s => [s.sector, s.startup_count, s.total_funding_ask].join(","));
  } else if (r.type === "investor") {
    headers = ["Rank", "Investor", "Score"];
    rows = r.leaderboard.slice(0, 15).map((l, i) => { const n = r.nodes.find(x => x.id === l.investor_id); return [i + 1, n?.name || l.investor_id, l.score.toFixed(2)].join(","); });
  } else {
    headers = ["Rank", "Startup", "Sector", "Achievements"];
    rows = r.leaders.slice(0, 15).map((l, i) => [i + 1, l.name, l.sector || "", l.ach_count].join(","));
  }
  const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${r.type}_report.csv`; a.click();
  showToast("CSV exported.", "success");
}

function _exportReportExcel() {
  _exportReportCSV(); // CSV is Excel-compatible
  showToast("Excel-compatible CSV exported.", "success");
}

function _exportReportPDF() {
  if (!_lastReportData) { showToast("Compile a report first.", "warn"); return; }
  const preview = el("reportsPreviewArea");
  if (!preview) return;
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>Report</title><style>body{font-family:Inter,sans-serif;padding:40px;color:#1e293b}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #e2e8f0;padding:6px 10px;font-size:13px;text-align:left}th{background:#f1f5f9;font-weight:600}h4{margin:0}h5{margin:16px 0 6px}hr{border-color:#e2e8f0}</style></head><body>${preview.innerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 400);
}
