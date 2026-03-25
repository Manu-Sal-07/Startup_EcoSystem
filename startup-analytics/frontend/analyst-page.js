const analystState = {
  charts: {
    sector: null,
    distribution: null,
    opsTrend: null,
    opsStatus: null,
  },
  graphLoaded: false,
  graphObserver: null,
  opsHistory: [],
  raw: {
    network: { nodes: [], edges: [] },
    sectorTrends: [],
    leaderboard: [],
    hotSectors: [],
    achievementLeaders: [],
  },
};

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function trackedApiCall(label, path) {
  const startedAt = performance.now();
  try {
    const data = await apiCall("GET", path);
    const duration = Math.round(performance.now() - startedAt);
    analystState.opsHistory.push({ label, duration, status: "success", at: new Date().toLocaleTimeString() });
    return data;
  } catch (error) {
    const duration = Math.round(performance.now() - startedAt);
    analystState.opsHistory.push({ label, duration, status: "failure", detail: error.detail || String(error), at: new Date().toLocaleTimeString() });
    throw error;
  }
}

function currentFilters() {
  return {
    timeRange: Number($("#timeRangeFilter").value || 30),
    sector: $("#sectorFilter").value,
    query: $("#entitySearch").value.trim().toLowerCase(),
    limit: Number($("#detailLimitFilter").value || 10),
  };
}

function filteredSectorTrends() {
  const { sector, query } = currentFilters();
  return (analystState.raw.sectorTrends || []).filter((item) => {
    const sectorMatch = !sector || item.sector === sector;
    const queryMatch = !query || `${item.sector} ${item.startup_count}`.toLowerCase().includes(query);
    return sectorMatch && queryMatch;
  });
}

function filteredHotSectors() {
  const { sector, query, limit } = currentFilters();
  return (analystState.raw.hotSectors || [])
    .filter((item) => (!sector || item.sector === sector) && (!query || `${item.sector} ${item.interest_count}`.toLowerCase().includes(query)))
    .slice(0, limit);
}

function filteredAchievementLeaders() {
  const { sector, query, limit } = currentFilters();
  return (analystState.raw.achievementLeaders || [])
    .filter((item) => (!sector || item.sector === sector) && (!query || `${item.name} ${item.sector}`.toLowerCase().includes(query)))
    .slice(0, limit);
}

function filteredLeaderboard() {
  const { query, limit } = currentFilters();
  return (analystState.raw.leaderboard || [])
    .filter((item) => !query || String(item.investor_id).toLowerCase().includes(query))
    .slice(0, limit);
}

function filteredNetwork() {
  const { sector, query } = currentFilters();
  const nodes = (analystState.raw.network.nodes || []).filter((item) => {
    const sectorMatch = !sector || item.sector === sector || !item.sector;
    const queryMatch = !query || `${item.name} ${item.label} ${item.sector || ""}`.toLowerCase().includes(query);
    return sectorMatch && queryMatch;
  });
  const visibleIds = new Set(nodes.map((item) => item.id));
  const edges = (analystState.raw.network.edges || []).filter((item) => visibleIds.has(item.source) && visibleIds.has(item.target));
  return { nodes, edges };
}

function filteredStartupRows() {
  const trends = filteredSectorTrends();
  const hotLookup = new Map((analystState.raw.hotSectors || []).map((item) => [item.sector, item.interest_count]));
  return trends.map((item) => ({
    sector: item.sector,
    startups: Number(item.startup_count || 0),
    ask: Number(item.total_funding_ask || 0),
    attention: Number(hotLookup.get(item.sector) || 0),
  }));
}

function populateSectorFilter() {
  const select = $("#sectorFilter");
  const existing = new Set(Array.from(select.options).map((option) => option.value));
  const sectors = new Set([
    ...(analystState.raw.sectorTrends || []).map((item) => item.sector),
    ...(analystState.raw.hotSectors || []).map((item) => item.sector),
    ...(analystState.raw.achievementLeaders || []).map((item) => item.sector),
  ]);
  Array.from(sectors).sort().forEach((sector) => {
    if (!existing.has(sector)) {
      select.insertAdjacentHTML("beforeend", `<option value="${sector}">${sector}</option>`);
    }
  });
}

function updateFilterStatus() {
  const { timeRange, sector, query, limit } = currentFilters();
  const parts = [`${timeRange}d view`, sector || "all sectors", query ? `search: ${query}` : "no search", `top ${limit}`];
  $("#filterStatus").textContent = parts.join(" · ");
}

function renderOverviewMetrics() {
  const network = filteredNetwork();
  const sectorRows = filteredStartupRows();
  const hot = filteredHotSectors();
  const achievements = filteredAchievementLeaders();
  const totalAsk = sectorRows.reduce((sum, row) => sum + row.ask, 0);
  const startupCount = network.nodes.filter((item) => item.label === "Startup").length;
  const investorCount = network.nodes.filter((item) => item.label === "Investor").length;
  const edgeCount = network.edges.length;
  const interestEvents = hot.reduce((sum, item) => sum + Number(item.interest_count || 0), 0);
  const engagementRatio = startupCount ? `${(interestEvents / startupCount).toFixed(1)}x` : "0x";
  const avgAsk = sectorRows.length ? totalAsk / sectorRows.length : 0;
  const topSector = hot[0]?.sector || sectorRows[0]?.sector || "-";
  const achievementBurst = achievements[0]?.ach_count || 0;
  const failures = analystState.opsHistory.filter((item) => item.status === "failure").length;
  const avgLatency = analystState.opsHistory.length ? Math.round(analystState.opsHistory.reduce((sum, item) => sum + item.duration, 0) / analystState.opsHistory.length) : 0;

  $("#statStartups").textContent = startupCount;
  $("#statInvestors").textContent = investorCount;
  $("#statCapital").textContent = money(totalAsk);
  $("#statHotSector").textContent = topSector;
  $("#statEdges").textContent = edgeCount;
  $("#statEngagement").textContent = engagementRatio;

  $("#growthSignal").textContent = achievementBurst >= 3 ? "High momentum" : achievementBurst >= 1 ? "Measured growth" : "Early signal";
  $("#growthSignalSub").textContent = `${achievementBurst} recent achievements from the leading startup cohort.`;
  $("#conversionSignal").textContent = interestEvents ? `${interestEvents} intent events` : "Low intent";
  $("#conversionSignalSub").textContent = `${startupCount || 0} startups are drawing ${interestEvents || 0} tracked investor actions.`;
  $("#systemPulse").textContent = avgLatency ? `${avgLatency} ms avg` : "Waiting";
  $("#systemPulseSub").textContent = failures ? `${failures} failed requests detected in this session.` : "No analyst-dashboard request failures detected.";
  $("#riskWatch").textContent = avgAsk > 0 && interestEvents === 0 ? "Demand without pull" : failures ? "Monitor stack health" : "Stable";
  $("#riskWatchSub").textContent = avgAsk > 0 && interestEvents === 0
    ? "Funding demand exists but investor intent is muted in the current view."
    : failures
      ? "Some API calls failed and should be reviewed."
      : "No immediate anomaly spikes in the filtered dataset.";

  $("#overviewBadge").textContent = `${startupCount} startups in view`;
  $("#businessBadge").textContent = `${sectorRows.length} sectors visible`;
  $("#detailBadge").textContent = `${currentFilters().limit} row focus`;
  $("#lastUpdatedLine").textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
}

function renderLeaderboard(items) {
  $("#leaderboardList").innerHTML = !items.length ? '<div class="empty">No leaderboard data available.</div>' : items.map((item, index) => `
    <div class="history-card">
      <div class="inline" style="justify-content:space-between">
        <strong>#${index + 1} ${esc(item.investor_id)}</strong>
        <span class="badge">${Number(item.score || 0).toFixed(1)}</span>
      </div>
    </div>`).join("");
}

function renderHotSectors(items) {
  $("#hotSectorsList").innerHTML = !items.length ? '<div class="empty">No hot sector activity found.</div>' : items.map((item) => `
    <div class="history-card">
      <div class="inline" style="justify-content:space-between">
        <strong>${esc(item.sector)}</strong>
        <span class="badge good">${esc(item.interest_count)} intents</span>
      </div>
      <div class="meta" style="margin-top:8px">Recent investor activity concentrated here.</div>
    </div>`).join("");
}

function renderAchievementLeaders(items) {
  const max = Math.max(...items.map((item) => Number(item.ach_count || 0)), 1);
  $("#achievementLeaderList").innerHTML = !items.length ? '<div class="empty">No achievement leader data available.</div>' : items.map((item, index) => `
    <div class="history-card">
      <div class="inline" style="justify-content:space-between">
        <strong>#${index + 1} ${esc(item.name)}</strong>
        <span class="badge">${esc(item.sector)}</span>
      </div>
      <div class="mini-track" style="margin-top:10px"><div class="mini-fill" style="width:${(Number(item.ach_count || 0) / max) * 100}%"></div></div>
      <div class="meta" style="margin-top:10px">${esc(item.ach_count)} achievements in the selected window</div>
    </div>`).join("");
}

function renderStartupTable(rows) {
  $("#startupTable").innerHTML = !rows.length ? '<div class="empty" style="padding:16px">No sectors match the current filters.</div>' : `
    <table class="data-table">
      <thead>
        <tr>
          <th>Sector</th>
          <th>Startups</th>
          <th>Funding Ask</th>
          <th>Attention</th>
        </tr>
      </thead>
      <tbody>
        ${rows.slice(0, currentFilters().limit).map((row) => `
          <tr>
            <td>${esc(row.sector)}</td>
            <td>${esc(row.startups)}</td>
            <td>${money(row.ask)}</td>
            <td>${esc(row.attention)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderInsightAlerts(rows, hot, achievements) {
  const alerts = [];
  const highestAttention = hot[0];
  const highestAsk = [...rows].sort((a, b) => b.ask - a.ask)[0];
  const strongestMomentum = achievements[0];
  if (highestAsk && highestAttention && highestAsk.sector !== highestAttention.sector) {
    alerts.push({
      title: "Demand-attention mismatch",
      body: `${highestAsk.sector} holds the largest funding demand while ${highestAttention.sector} is drawing the most investor attention.`,
    });
  }
  if (strongestMomentum && Number(strongestMomentum.ach_count || 0) >= 3) {
    alerts.push({
      title: "Momentum leader",
      body: `${strongestMomentum.name} is setting the pace with ${strongestMomentum.ach_count} recent achievements.`,
    });
  }
  if (!alerts.length) {
    alerts.push({
      title: "No major anomaly detected",
      body: "Current filters show a relatively balanced system state.",
    });
  }
  $("#insightAlerts").innerHTML = alerts.map((alert) => `
    <div class="history-card">
      <strong>${esc(alert.title)}</strong>
      <div class="sub" style="margin-top:8px">${esc(alert.body)}</div>
    </div>`).join("");
}

function renderSearchResults(network) {
  const { query, limit } = currentFilters();
  const results = query
    ? network.nodes.slice(0, limit)
    : [];
  $("#searchResults").innerHTML = !results.length
    ? '<div class="empty">Use the search field above to inspect specific startups, investors, or sectors.</div>'
    : results.map((item) => `
      <div class="insight-pill">
        <strong>${esc(item.name)}</strong>
        <span class="meta">${esc(item.label)}</span>
        ${item.sector ? `<span class="meta">${esc(item.sector)}</span>` : ""}
      </div>`).join("");
}

function debounce(fn, wait = 180) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

function exportSummary() {
  const summary = {
    exported_at: new Date().toISOString(),
    filters: currentFilters(),
    kpis: {
      startups: $("#statStartups").textContent,
      investors: $("#statInvestors").textContent,
      capital: $("#statCapital").textContent,
      hot_sector: $("#statHotSector").textContent,
      edges: $("#statEdges").textContent,
      engagement_ratio: $("#statEngagement").textContent,
    },
    overview: {
      growth_signal: $("#growthSignal").textContent,
      conversion_signal: $("#conversionSignal").textContent,
      system_pulse: $("#systemPulse").textContent,
      risk_watch: $("#riskWatch").textContent,
    },
  };
  downloadBlob("analyst-summary.json", JSON.stringify(summary, null, 2), "application/json");
  showToast("Summary exported.");
}

function exportTable() {
  const rows = filteredStartupRows().slice(0, currentFilters().limit);
  const csv = [
    "sector,startups,funding_ask,attention",
    ...rows.map((row) => [row.sector, row.startups, row.ask, row.attention].join(",")),
  ].join("\n");
  downloadBlob("analyst-startup-table.csv", csv, "text/csv;charset=utf-8");
  showToast("Filtered table exported.");
}

function destroyChart(ref) {
  if (ref) ref.destroy();
}

function renderSectorChart(items) {
  if (typeof Chart === "undefined") return;
  destroyChart(analystState.charts.sector);
  analystState.charts.sector = new Chart(document.getElementById("sectorChart"), {
    type: "bar",
    data: {
      labels: items.map((item) => item.sector),
      datasets: [{
        label: "Funding Ask",
        data: items.map((item) => Number(item.total_funding_ask || 0)),
        borderRadius: 12,
        backgroundColor: ["#0f766e", "#127c87", "#1e5f96", "#d97706", "#ca8a04", "#334155"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (value) => `INR ${(Number(value) / 100000).toFixed(1)}L` } } },
    },
  });
}

function renderDistributionChart(items) {
  if (typeof Chart === "undefined") return;
  destroyChart(analystState.charts.distribution);
  analystState.charts.distribution = new Chart(document.getElementById("distributionChart"), {
    type: "doughnut",
    data: {
      labels: items.map((item) => item.sector),
      datasets: [{
        data: items.map((item) => Number(item.interest_count || 0)),
        backgroundColor: ["#0f766e", "#14b8a6", "#0f4c81", "#d97706", "#7c3aed", "#475569"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      plugins: { legend: { position: "bottom" } },
    },
  });
}

function renderOpsCharts() {
  if (typeof Chart === "undefined") return;
  const recent = analystState.opsHistory.slice(-8);
  const labels = recent.map((item, index) => `${index + 1}`);
  destroyChart(analystState.charts.opsTrend);
  analystState.charts.opsTrend = new Chart(document.getElementById("opsTrendChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Latency (ms)",
          data: recent.map((item) => item.duration),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15,118,110,.16)",
          tension: 0.35,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Requests",
          data: recent.map((_, index) => index + 1),
          borderColor: "#0f4c81",
          backgroundColor: "rgba(15,76,129,.12)",
          tension: 0.35,
          fill: false,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true, position: "left" },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false } },
      },
    },
  });

  const successCount = analystState.opsHistory.filter((item) => item.status === "success").length;
  const failureCount = analystState.opsHistory.filter((item) => item.status === "failure").length;
  destroyChart(analystState.charts.opsStatus);
  analystState.charts.opsStatus = new Chart(document.getElementById("opsStatusChart"), {
    type: "doughnut",
    data: {
      labels: ["Success", "Failure"],
      datasets: [{
        data: [successCount, failureCount],
        backgroundColor: ["#15803d", "#b91c1c"],
        borderWidth: 0,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom" } } },
  });

  const avgLatency = analystState.opsHistory.length
    ? Math.round(analystState.opsHistory.reduce((sum, item) => sum + item.duration, 0) / analystState.opsHistory.length)
    : 0;
  $("#opsRequests").textContent = analystState.opsHistory.length;
  $("#opsLatency").textContent = avgLatency ? `${avgLatency} ms` : "-";
  $("#opsFailureRate").textContent = analystState.opsHistory.length ? `${Math.round((failureCount / analystState.opsHistory.length) * 100)}%` : "0%";
  const errorItems = analystState.opsHistory.filter((item) => item.status === "failure").slice(-5);
  $("#opsErrors").innerHTML = !errorItems.length
    ? '<div class="empty">No recent dashboard request failures.</div>'
    : errorItems.map((item) => `<div class="history-card"><strong>${esc(item.label)}</strong><div class="sub" style="margin-top:8px">${esc(item.detail || "Unknown error")}</div></div>`).join("");
}

function renderGraph(payload) {
  if (typeof d3 === "undefined") return;
  const svg = d3.select("#networkGraph");
  const tip = $("#graphTip");
  svg.selectAll("*").remove();
  const width = 960;
  const height = 470;
  const nodes = (payload.nodes || []).slice(0, 120).map((item) => ({ ...item }));
  const nodeIds = new Set(nodes.map((item) => item.id));
  const edges = (payload.edges || []).filter((item) => nodeIds.has(item.source) && nodeIds.has(item.target)).slice(0, 180).map((item) => ({ ...item }));
  const nodeColors = { Startup: "#0f4c81", Investor: "#d14343", Founder: "#15803d", Achievement: "#d97706", Analyst: "#7c3aed" };
  const edgeColors = { INTERESTED_IN: "#f59e0b", CONNECTED_TO: "#16a34a", INVESTED_IN: "#2563eb", FOUNDED: "#64748b", COMPETES_WITH: "#a855f7", HAS_ACHIEVEMENT: "#d97706", FUNDED: "#0f766e" };
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id((item) => item.id).distance(88))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(20));
  const link = svg.append("g")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("stroke", (item) => edgeColors[item.type] || "#94a3b8")
    .attr("stroke-opacity", 0.45)
    .attr("stroke-width", 1.6);
  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", (item) => item.label === "Investor" ? 9 : item.label === "Achievement" ? 6 : 7)
    .attr("fill", (item) => nodeColors[item.label] || "#334155")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.6)
    .on("mousemove", (event, item) => {
      tip.style.opacity = "1";
      tip.style.left = `${event.offsetX}px`;
      tip.style.top = `${event.offsetY}px`;
      tip.innerHTML = `<strong>${esc(item.name)}</strong><div>${esc(item.label)}</div>${item.sector ? `<div>${esc(item.sector)}</div>` : ""}`;
    })
    .on("mouseleave", () => { tip.style.opacity = "0"; });
  simulation.on("tick", () => {
    link.attr("x1", (item) => item.source.x).attr("y1", (item) => item.source.y).attr("x2", (item) => item.target.x).attr("y2", (item) => item.target.y);
    node.attr("cx", (item) => item.x).attr("cy", (item) => item.y);
  });
}

function maybeRenderGraph(network) {
  const graphShell = document.querySelector(".graph-shell");
  if (!graphShell) return;
  if (analystState.graphLoaded) {
    renderGraph(network);
    $("#networkBadge").textContent = `${network.nodes.length} nodes in view`;
    return;
  }
  if (analystState.graphObserver) {
    analystState.graphObserver.disconnect();
  }
  analystState.graphObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      analystState.graphLoaded = true;
      renderGraph(network);
      $("#networkBadge").textContent = `${network.nodes.length} nodes in view`;
      analystState.graphObserver.disconnect();
    }
  }, { rootMargin: "120px" });
  analystState.graphObserver.observe(graphShell);
}

function renderAll() {
  updateFilterStatus();
  const sectorRows = filteredSectorTrends();
  const hot = filteredHotSectors();
  const achievements = filteredAchievementLeaders();
  const leaderboard = filteredLeaderboard();
  const network = filteredNetwork();
  renderOverviewMetrics();
  renderSectorChart(sectorRows);
  renderDistributionChart(hot.length ? hot : sectorRows.map((row) => ({ sector: row.sector, interest_count: row.startup_count })));
  renderHotSectors(hot);
  renderAchievementLeaders(achievements);
  renderLeaderboard(leaderboard);
  renderStartupTable(filteredStartupRows());
  renderInsightAlerts(filteredStartupRows(), hot, achievements);
  renderSearchResults(network);
  renderOpsCharts();
  maybeRenderGraph(network);
  if (!analystState.graphLoaded) {
    $("#networkBadge").textContent = "Render on scroll";
  }
  $("#opsBadge").textContent = `${analystState.opsHistory.length} calls tracked`;
}

async function loadAnalystData() {
  const requests = [
    trackedApiCall("network", "/analytics/network"),
    trackedApiCall("sector-trends", "/analytics/sector-trends"),
    trackedApiCall("leaderboard", "/analytics/leaderboard"),
    trackedApiCall("hot-sectors", "/analytics/hot-sectors"),
    trackedApiCall("achievement-leaders", "/analytics/achievement-leaders"),
  ];
  const results = await Promise.allSettled(requests);
  const [network, sectorTrends, leaderboard, hotSectors, achievementLeaders] = results.map((result) => result.status === "fulfilled" ? result.value : null);
  analystState.raw.network = network?.items || { nodes: [], edges: [] };
  analystState.raw.sectorTrends = sectorTrends?.items || [];
  analystState.raw.leaderboard = leaderboard?.items || [];
  analystState.raw.hotSectors = hotSectors?.items || [];
  analystState.raw.achievementLeaders = achievementLeaders?.items || [];
  populateSectorFilter();
}

async function initAnalystPage() {
  const current = requireAuth("ANALYST");
  if (!current) return;
  renderHeader("Ecosystem Intelligence Dashboard", "Premium analytics view for investors, founders, and technical reviewers.");
  $("#logoutButton").addEventListener("click", logout);
  $("#exportSummaryButton").addEventListener("click", exportSummary);
  $("#exportTableButton").addEventListener("click", exportTable);
  $("#refreshWorkspaceButton").addEventListener("click", () => window.location.reload());
  ["timeRangeFilter", "sectorFilter", "detailLimitFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderAll);
  });
  $("#entitySearch").addEventListener("input", debounce(renderAll));
  await loadHealth();
  await loadAnalystData();
  renderAll();
}
