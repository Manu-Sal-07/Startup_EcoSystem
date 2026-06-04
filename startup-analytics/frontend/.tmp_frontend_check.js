
    const API_BASE = "http://localhost:8000";
    const SECTORS = ["FinTech", "HealthTech", "EdTech", "CleanTech", "SaaS", "AI/ML", "E-commerce", "BioTech"];
    const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B"];
    const state = { role: null, userId: null, userName: null, sectorChart: null };
    const $ = (selector) => document.querySelector(selector);
    const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
    const graphEscapeHandler = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    function showToast(message, type = "success") {
      const toast = $("#toast");
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
    }

    function formatDate(value) {
      if (!value) return "Unknown";
      const timestamp = Number(value);
      if (!Number.isNaN(timestamp) && String(value).length >= 10) return new Date(timestamp * 1000).toLocaleString();
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    }

    function setSourceBadge(id, source, fallback = "Live") {
      const badge = document.getElementById(id);
      if (!badge) return;
      const value = String(source || "").toLowerCase();
      if (value.includes("cache") || value.includes("redis")) {
        badge.className = "badge good";
        badge.textContent = "Redis cache";
      } else if (value.includes("db") || value.includes("neo4j")) {
        badge.className = "badge";
        badge.textContent = "Neo4j live";
      } else {
        badge.className = "badge";
        badge.textContent = fallback;
      }
    }

    async function apiCall(method, path, body = null) {
      const token = localStorage.getItem("token");
      const options = { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
      if (body !== null) options.body = JSON.stringify(body);
      const response = await fetch(`${API_BASE}${path}`, options);
      if (response.status === 401) {
        logout(false);
        return null;
      }
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
      if (!response.ok) throw data;
      return data;
    }

    async function timedApiCall(method, path, body = null) {
      const start = performance.now();
      const data = await apiCall(method, path, body);
      return { data, duration: Math.round(performance.now() - start) };
    }

    function fillFilterSelects() {
      const sectorSelect = $('#feedFilterForm select[name="sector"]');
      const stageSelect = $('#feedFilterForm select[name="stage"]');
      SECTORS.forEach((sector) => sectorSelect.insertAdjacentHTML("beforeend", `<option value="${sector}">${sector}</option>`));
      STAGES.forEach((stage) => stageSelect.insertAdjacentHTML("beforeend", `<option value="${stage}">${stage}</option>`));
    }

    function updateWorkspaceHeader() {
      $("#signedInLine").textContent = `Signed in as ${state.userName} (${state.role})`;
      if (state.role === "STARTUP") {
        $("#workspaceTitle").textContent = "Startup Workspace";
        $("#workspaceSubtitle").textContent = "Profile, milestones, investor attention, and investor matches.";
        $("#workspaceHint").textContent = "The achievement posting form is on this page so startups can add new milestones right after login.";
      } else if (state.role === "INVESTOR") {
        $("#workspaceTitle").textContent = "Investor Workspace";
        $("#workspaceSubtitle").textContent = "Deal discovery, funding status, transfer engine, and startup matches.";
        $("#workspaceHint").textContent = "Each startup card includes lock status, funding progress, and a transfer widget.";
      } else {
        $("#workspaceTitle").textContent = "Analyst Workspace";
        $("#workspaceSubtitle").textContent = "Graph analytics, sector trends, hot sectors, and achievement leaders.";
        $("#workspaceHint").textContent = "Use this page to inspect ecosystem activity and benchmark startup momentum.";
      }
    }

    function switchWorkspace(role) {
      $("#startupWorkspace").hidden = role !== "STARTUP";
      $("#investorWorkspace").hidden = role !== "INVESTOR";
      $("#analystWorkspace").hidden = role !== "ANALYST";
    }

    function typeClass(type) {
      const safeType = ["revenue", "partnership", "product", "funding", "team", "award"].includes(type) ? type : "team";
      return `type-${safeType}`;
    }

    function renderStartupProfile(profile) {
      const target = $("#startupProfileView");
      if (!profile) {
        target.innerHTML = '<div class="empty">Startup profile not found.</div>';
        return;
      }
      target.innerHTML = `
        <div class="profile-grid">
          <div class="profile-cell"><strong>Name</strong>${graphEscapeHandler(profile.name)}</div>
          <div class="profile-cell"><strong>Sector</strong>${graphEscapeHandler(profile.sector)}</div>
          <div class="profile-cell"><strong>Stage</strong>${graphEscapeHandler(profile.stage)}</div>
          <div class="profile-cell"><strong>Funding Ask</strong>${money(profile.funding_ask)}</div>
          <div class="profile-cell"><strong>Received Funding</strong>${money(profile.received_funding)}</div>
          <div class="profile-cell"><strong>Equity Offered</strong>${Number(profile.equity_offered || 0)}%</div>
          <div class="profile-cell"><strong>Revenue</strong>${money(profile.revenue)}</div>
          <div class="profile-cell"><strong>Founded</strong>${graphEscapeHandler(profile.founded || "-")}</div>
          <div class="profile-cell" style="grid-column:1 / -1"><strong>Pitch</strong>${graphEscapeHandler(profile.pitch || "No pitch available.")}</div>
        </div>`;
    }

    function renderInvestorProfile(profile) {
      const target = $("#investorProfileView");
      if (!profile) {
        target.innerHTML = '<div class="empty">Investor profile not found.</div>';
        return;
      }
      target.innerHTML = `
        <div class="profile-grid">
          <div class="profile-cell"><strong>Name</strong>${graphEscapeHandler(profile.name)}</div>
          <div class="profile-cell"><strong>Firm</strong>${graphEscapeHandler(profile.firm || "Independent")}</div>
          <div class="profile-cell"><strong>Type</strong>${graphEscapeHandler(profile.type || "-")}</div>
          <div class="profile-cell"><strong>Wallet Balance</strong>${money(profile.wallet_balance)}</div>
          <div class="profile-cell"><strong>Ticket Min</strong>${money(profile.ticket_min)}</div>
          <div class="profile-cell"><strong>Ticket Max</strong>${money(profile.ticket_max)}</div>
          <div class="profile-cell"><strong>Preferred Sectors</strong>${graphEscapeHandler((profile.preferred_sectors || []).join(", ") || "-")}</div>
          <div class="profile-cell"><strong>Stage Focus</strong>${graphEscapeHandler((profile.stage_focus || []).join(", ") || "-")}</div>
          <div class="profile-cell" style="grid-column:1 / -1"><strong>Bio</strong>${graphEscapeHandler(profile.bio || "No bio available.")}</div>
        </div>`;
    }

    function renderAchievements(items) {
      const target = $("#achievementTimeline");
      if (!items || !items.length) {
        target.innerHTML = '<div class="empty">No achievements posted yet.</div>';
        return;
      }
      target.innerHTML = items.map((item) => `
        <div class="achievement-item">
          <div class="achievement-head">
            <div>
              <span class="type-tag ${typeClass(item.type)}">${graphEscapeHandler(item.type)}</span>
              <h3 style="margin-top:10px">${graphEscapeHandler(item.title)}</h3>
              <div class="meta">${formatDate(item.date)} ${item.verified ? '<span style="color:var(--good);font-weight:700">Verified</span>' : ""}</div>
            </div>
            ${item.value ? `<span class="badge">${money(item.value)}</span>` : ""}
          </div>
          <div>${graphEscapeHandler(item.description || "No description provided.")}</div>
          ${item.media_url ? `<div class="meta"><a href="${graphEscapeHandler(item.media_url)}" target="_blank" rel="noopener">Open supporting link</a></div>` : ""}
        </div>`).join("");
    }

    function renderViewers(viewers) {
      const target = $("#startupViewersList");
      const entries = Object.entries(viewers || {});
      target.innerHTML = !entries.length ? '<div class="empty">No startup viewers yet.</div>' : entries.map(([investorId, ts]) => `
        <div class="history-card">
          <strong>${graphEscapeHandler(investorId)}</strong>
          <div class="meta">Viewed at ${formatDate(ts)}</div>
        </div>`).join("");
    }

    function renderConnections(items) {
      const target = $("#startupConnectionsList");
      target.innerHTML = !items || !items.length ? '<div class="empty">No connection requests yet.</div>' : items.map((item) => `
        <div class="history-card">
          <div class="inline" style="justify-content:space-between">
            <strong>${graphEscapeHandler(item.investor_name || item.investor_id)}</strong>
            <span class="badge ${item.status === "accepted" ? "good" : item.status === "rejected" ? "warn" : ""}">${graphEscapeHandler(item.status)}</span>
          </div>
          <div class="meta">Investor ID: ${graphEscapeHandler(item.investor_id)}</div>
          <div class="meta">Proposed amount: ${money(item.proposed_amount)}</div>
          <div style="margin-top:8px">${graphEscapeHandler(item.message || "No message provided.")}</div>
        </div>`).join("");
    }

    function renderMatches(targetSelector, matches, mode) {
      const target = $(targetSelector);
      target.innerHTML = !matches || !matches.length ? '<div class="empty">No matches available right now.</div>' : matches.map((match) => `
        <div class="match-card">
          <div class="inline" style="justify-content:space-between">
            <div>
              <h3>${graphEscapeHandler(match.name)}</h3>
              <div class="meta">${mode === "investor" ? `${graphEscapeHandler(match.sector)} / ${graphEscapeHandler(match.stage)}` : `${graphEscapeHandler(match.firm || "Independent")} / ${graphEscapeHandler(match.type || "Investor")}`}</div>
            </div>
            <span class="badge good">${match.total_score}/110</span>
          </div>
          <div class="score-bar" style="margin-top:12px"><div class="score-fill" style="width:${Math.min(100, (Number(match.total_score || 0) / 110) * 100)}%"></div></div>
          <div class="meta" style="margin-top:10px">Sector ${match.sector_score} | Ticket ${match.ticket_score} | Stage ${match.stage_score} | Network ${match.network_score} | Achievement ${match.achievement_score || 0}</div>
        </div>`).join("");
    }

    function renderFundHistory(items) {
      const target = $("#fundHistoryList");
      target.innerHTML = !items || !items.length ? '<div class="empty">No fund transfers recorded yet.</div>' : items.map((item) => `
        <div class="history-card">
          <div class="inline" style="justify-content:space-between">
            <strong>${graphEscapeHandler(item.startup)}</strong>
            <span class="badge good">${money(item.amount)}</span>
          </div>
          <div class="meta">${graphEscapeHandler(item.sector)} | ${graphEscapeHandler(item.round || "direct-transfer")}</div>
          <div class="meta">${formatDate(item.transferred_at)} | ${graphEscapeHandler(item.status)}</div>
        </div>`).join("");
    }

    function renderLeaderboard(items) {
      $("#leaderboardList").innerHTML = !items || !items.length ? '<div class="empty">No leaderboard data available.</div>' : items.map((item, index) => `
        <div class="history-card">
          <div class="inline" style="justify-content:space-between">
            <strong>#${index + 1} ${graphEscapeHandler(item.investor_id)}</strong>
            <span class="badge good">${graphEscapeHandler(item.score)}</span>
          </div>
        </div>`).join("");
    }

    function renderHotSectors(items) {
      $("#hotSectorsList").innerHTML = !items || !items.length ? '<div class="empty">No hot sector activity found.</div>' : items.map((item) => `
        <div class="history-card">
          <strong>${graphEscapeHandler(item.sector)}</strong>
          <div class="meta">${graphEscapeHandler(item.interest_count)} recent interest events</div>
        </div>`).join("");
    }

    function renderAchievementLeaders(items) {
      const max = Math.max(...(items || []).map((item) => Number(item.ach_count || 0)), 1);
      $("#achievementLeaderList").innerHTML = !items || !items.length ? '<div class="empty">No achievement leader data available.</div>' : items.map((item, index) => `
        <div class="history-card">
          <div class="inline" style="justify-content:space-between">
            <strong>#${index + 1} ${graphEscapeHandler(item.name)}</strong>
            <span class="badge">${graphEscapeHandler(item.sector)}</span>
          </div>
          <div class="mini-track" style="margin-top:10px"><div class="mini-fill" style="width:${(Number(item.ach_count || 0) / max) * 100}%"></div></div>
          <div class="meta" style="margin-top:10px">${graphEscapeHandler(item.ach_count)} achievements in the last 90 days</div>
        </div>`).join("");
    }

    function fundingWidget(progress, lock, startupId) {
      const percentage = Math.max(0, Math.min(100, Number(progress.percentage || 0)));
      const fillClass = percentage >= 100 ? "progress-fill full" : percentage >= 75 ? "progress-fill warn" : "progress-fill";
      const lockBadge = lock.is_locked ? '<span class="badge warn">Round locked</span>' : '<span class="badge good">Round open</span>';
      return `
        <div class="stack" style="margin-top:14px">
          <div class="inline" style="justify-content:space-between">${lockBadge}<span class="meta">Funded ${money(progress.received_funding)} of ${money(progress.funding_ask)}</span></div>
          <div class="progress-track"><div class="${fillClass}" style="width:${percentage}%"></div></div>
          <div class="meta">${percentage >= 100 ? "Fully funded" : `${percentage}% of round filled`}</div>
          <div class="inline">
            <input id="transferAmount_${startupId}" type="number" min="1" step="1000" placeholder="Transfer amount">
            <button class="primary" type="button" data-action="transfer" data-startup-id="${startupId}">Transfer Funds</button>
          </div>
        </div>`;
    }

    function renderFeed(items) {
      const target = $("#startupFeedList");
      target.innerHTML = !items || !items.length ? '<div class="empty">No startups matched the current filters.</div>' : items.map((item) => `
        <div class="feed-card" id="feedCard_${item.id}">
          <div class="inline" style="justify-content:space-between">
            <div>
              <h3>${graphEscapeHandler(item.name)}</h3>
              <div class="meta">${graphEscapeHandler(item.sector)} / ${graphEscapeHandler(item.stage)}</div>
            </div>
            <span class="badge">${money(item.funding_ask)}</span>
          </div>
          <div style="margin-top:10px">${graphEscapeHandler(item.pitch || "No pitch provided.")}</div>
          <div class="inline" style="margin-top:14px">
            <button class="ghost" type="button" data-action="view" data-startup-id="${item.id}">View Profile</button>
            <button class="secondary" type="button" data-action="interest" data-startup-id="${item.id}">Express Interest</button>
          </div>
          <div id="fundingWidget_${item.id}" class="muted-box" style="margin-top:14px">Loading funding widget...</div>
        </div>`).join("");
      (items || []).forEach((item) => refreshFundingWidget(item.id));
    }

    function renderSectorChart(items) {
      const canvas = document.getElementById("sectorChart");
      if (state.sectorChart) state.sectorChart.destroy();
      state.sectorChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: items.map((item) => item.sector),
          datasets: [{
            label: "Funding Ask",
            data: items.map((item) => Number(item.total_funding_ask || 0)),
            borderRadius: 12,
            backgroundColor: ["#0f766e", "#14867d", "#1a8f7b", "#d97706", "#c76a0b", "#0f4c81", "#2b6cb0", "#5f8f3b"]
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (value) => `INR ${Number(value / 100000).toFixed(1)}L` } } } }
      });
    }

    function renderGraph(payload) {
      const svg = d3.select("#networkGraph");
      const tip = $("#graphTip");
      svg.selectAll("*").remove();
      const width = 960;
      const height = 470;
      const nodes = (payload.nodes || []).map((item) => ({ ...item }));
      const edges = (payload.edges || []).map((item) => ({ ...item }));
      const nodeColors = { Startup: "#0f4c81", Investor: "#d14343", Founder: "#15803d", Achievement: "#b45309", Analyst: "#7c3aed" };
      const edgeColors = { INTERESTED_IN: "#f59e0b", CONNECTED_TO: "#16a34a", INVESTED_IN: "#2563eb", FOUNDED: "#64748b", COMPETES_WITH: "#c084fc", HAS_ACHIEVEMENT: "#b45309", FUNDED: "#0f766e" };
      const simulation = d3.forceSimulation(nodes).force("link", d3.forceLink(edges).id((item) => item.id).distance(100)).force("charge", d3.forceManyBody().strength(-280)).force("center", d3.forceCenter(width / 2, height / 2)).force("collision", d3.forceCollide().radius(22));
      const link = svg.append("g").selectAll("line").data(edges).join("line").attr("stroke", (item) => edgeColors[item.type] || "#94a3b8").attr("stroke-opacity", .72).attr("stroke-width", (item) => item.type === "INVESTED_IN" || item.type === "FUNDED" ? 2.8 : 1.8);
      const node = svg.append("g").selectAll("circle").data(nodes).join("circle").attr("r", (item) => item.label === "Investor" ? 10 : item.label === "Achievement" ? 7 : 8).attr("fill", (item) => nodeColors[item.label] || "#334155").attr("stroke", "#fff").attr("stroke-width", 1.8).call(d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded)).on("mousemove", (event, item) => { tip.style.opacity = "1"; tip.style.left = `${event.offsetX}px`; tip.style.top = `${event.offsetY}px`; tip.innerHTML = `<strong>${graphEscapeHandler(item.name)}</strong><div>${graphEscapeHandler(item.label)}</div><div>${graphEscapeHandler(item.sector || "")}</div>`; }).on("mouseleave", () => { tip.style.opacity = "0"; });
      const labels = svg.append("g").selectAll("text").data(nodes.slice(0, 50)).join("text").text((item) => item.name).attr("font-size", 11).attr("fill", "#36454f").attr("dx", 12).attr("dy", 4);
      simulation.on("tick", () => { link.attr("x1", (item) => item.source.x).attr("y1", (item) => item.source.y).attr("x2", (item) => item.target.x).attr("y2", (item) => item.target.y); node.attr("cx", (item) => item.x).attr("cy", (item) => item.y); labels.attr("x", (item) => item.x).attr("y", (item) => item.y); });
      function dragStarted(event) { if (!event.active) simulation.alphaTarget(.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
      function dragged(event) { event.subject.fx = event.x; event.subject.fy = event.y; }
      function dragEnded(event) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; }
    }

    async function loadHealth() {
      try {
        const data = await apiCall("GET", "/health");
        if (!data) return;
        $("#apiHealthLine").textContent = `Neo4j: ${data.neo4j} | Redis: ${data.redis}`;
        $("#apiHealthBadge").className = data.neo4j === "ok" && data.redis === "ok" ? "badge good" : "badge warn";
        $("#apiHealthBadge").textContent = data.neo4j === "ok" && data.redis === "ok" ? "Backend healthy" : "Backend issue";
      } catch (error) {
        $("#apiHealthLine").textContent = `Backend unreachable: ${error.detail || error.message || error}`;
        $("#apiHealthBadge").className = "badge warn";
        $("#apiHealthBadge").textContent = "Backend issue";
      }
    }

    async function loadStartupWorkspace() {
      const profile = await apiCall("GET", `/startups/${state.userId}`);
      if (profile) {
        setSourceBadge("startupProfileSource", profile.source, "Profile");
        renderStartupProfile(profile.item);
      }
      const achievements = await apiCall("GET", `/startups/${state.userId}/achievements`);
      if (achievements) {
        setSourceBadge("achievementSource", achievements.source, "Timeline");
        renderAchievements(achievements.items || []);
      }
      const viewers = await apiCall("GET", `/startups/${state.userId}/viewers`);
      if (viewers) renderViewers(viewers.viewers || {});
      const connections = await apiCall("GET", `/connections/${state.userId}`);
      if (connections) renderConnections(connections.items || []);
      const matches = await apiCall("GET", `/startups/${state.userId}/matches`);
      if (matches) {
        setSourceBadge("startupMatchSource", "db", "Matches");
        renderMatches("#startupMatchesList", matches.matches || [], "startup");
      }
    }

    async function loadStartupFeed() {
      const form = $("#feedFilterForm");
      const params = new URLSearchParams();
      ["sector", "stage", "min_ask", "max_ask"].forEach((name) => {
        const value = form.elements[name].value;
        if (value !== "") params.append(name, value);
      });
      const { data, duration } = await timedApiCall("GET", `/startups/feed${params.toString() ? `?${params}` : ""}`);
      if (!data) return;
      setSourceBadge("investorFeedSource", data.source, `${duration} ms`);
      renderFeed(data.items || []);
    }

    async function loadInvestorWorkspace() {
      const profile = await apiCall("GET", `/investors/${state.userId}`);
      if (profile) {
        setSourceBadge("investorProfileSource", profile.source, "Profile");
        renderInvestorProfile(profile.item);
      }
      const matches = await apiCall("GET", `/investors/${state.userId}/matches`);
      if (matches) {
        setSourceBadge("investorMatchesSource", "db", "Matches");
        renderMatches("#investorMatchesList", matches.matches || [], "investor");
      }
      const history = await apiCall("GET", `/funds/history/${state.userId}`);
      if (history) {
        setSourceBadge("fundHistorySource", "db", "History");
        renderFundHistory(history.items || []);
      }
      await loadStartupFeed();
    }

    async function loadAnalystWorkspace() {
      const [network, sectorTrends, leaderboard, hotSectors, achievementLeaders] = await Promise.all([
        apiCall("GET", "/analytics/network"),
        apiCall("GET", "/analytics/sector-trends"),
        apiCall("GET", "/analytics/leaderboard"),
        apiCall("GET", "/analytics/hot-sectors"),
        apiCall("GET", "/analytics/achievement-leaders")
      ]);
      if (network) {
        const payload = network.items || { nodes: [], edges: [] };
        setSourceBadge("networkSource", network.source, "Network");
        $("#statStartups").textContent = payload.nodes.filter((item) => item.label === "Startup").length;
        $("#statInvestors").textContent = payload.nodes.filter((item) => item.label === "Investor").length;
        $("#statEdges").textContent = payload.edges.length;
        renderGraph(payload);
      }
      if (sectorTrends) {
        setSourceBadge("sectorTrendSource", sectorTrends.source, "Trends");
        renderSectorChart(sectorTrends.items || []);
      }
      if (leaderboard) {
        setSourceBadge("leaderboardSource", "db", "Leaderboard");
        renderLeaderboard(leaderboard.items || []);
      }
      if (hotSectors) {
        setSourceBadge("hotSectorSource", hotSectors.source, "Hot sectors");
        renderHotSectors(hotSectors.items || []);
        $("#statHotSector").textContent = hotSectors.items?.[0]?.sector || "-";
      }
      if (achievementLeaders) {
        setSourceBadge("achievementLeaderSource", "db", "Leaders");
        renderAchievementLeaders(achievementLeaders.items || []);
      }
    }

    async function refreshFundingWidget(startupId) {
      const shell = document.getElementById(`fundingWidget_${startupId}`);
      if (!shell) return;
      try {
        const [lock, progress] = await Promise.all([apiCall("GET", `/funds/lock-status/${startupId}`), apiCall("GET", `/startups/${startupId}/funding-progress`)]);
        if (!lock || !progress) return;
        shell.innerHTML = fundingWidget(progress, lock, startupId);
      } catch (error) {
        shell.innerHTML = `<div class="empty">${graphEscapeHandler(error.detail || error.message || error)}</div>`;
      }
    }

    async function refreshWorkspace() {
      await loadHealth();
      if (state.role === "STARTUP") await loadStartupWorkspace();
      if (state.role === "INVESTOR") await loadInvestorWorkspace();
      if (state.role === "ANALYST") await loadAnalystWorkspace();
    }

    async function performLogin() {
      const email = $("#loginEmail").value.trim();
      const password = $("#loginPassword").value;
      const selectedRole = $("#loginRole").value;
      const errorBox = $("#loginError");
      errorBox.classList.add("hidden");
      try {
        const response = await apiCall("POST", "/auth/login", { email, password });
        if (!response) return;
        if (response.role !== selectedRole) {
          errorBox.textContent = `This account belongs to ${response.role}. Select the matching role and try again.`;
          errorBox.classList.remove("hidden");
          return;
        }
        localStorage.setItem("token", response.token);
        localStorage.setItem("userRole", response.role);
        localStorage.setItem("userName", response.name);
        localStorage.setItem("userId", response.id);
        state.role = response.role;
        state.userName = response.name;
        state.userId = response.id;
        $("#authScreen").classList.add("hidden");
        $("#appShell").classList.remove("hidden");
        updateWorkspaceHeader();
        switchWorkspace(state.role);
        await refreshWorkspace();
        showToast("Login successful.");
      } catch (error) {
        errorBox.textContent = error.detail || "Invalid email or password";
        errorBox.classList.remove("hidden");
      }
    }

    function logout(showMessage = true) {
      localStorage.clear();
      state.role = null;
      state.userName = null;
      state.userId = null;
      $("#appShell").classList.add("hidden");
      $("#authScreen").classList.remove("hidden");
      if (showMessage) showToast("Logged out.", "warn");
    }

    async function handleLogout() {
      try { await apiCall("POST", "/auth/logout"); } catch {}
      logout();
    }

    async function submitAchievement(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        type: form.type.value.toLowerCase(),
        title: form.title.value,
        description: form.description.value,
        value: form.value.value ? Number(form.value.value) : null,
        date: form.date.value,
        media_url: form.media_url.value || null
      };
      try {
        const data = await apiCall("POST", "/achievements/post", payload);
        if (!data) return;
        form.reset();
        showToast("Achievement posted.");
        await loadStartupWorkspace();
      } catch (error) {
        showToast(error.detail || "Could not post achievement.", "error");
      }
    }

    async function expressInterest(startupId) {
      const message = window.prompt("Message to the startup:", "Interested in learning more.");
      if (message === null) return;
      const proposed = window.prompt("Proposed amount (INR):", "250000");
      if (proposed === null) return;
      try {
        await apiCall("POST", "/connect/interest", { investor_id: state.userId, startup_id: startupId, message, proposed_amount: Number(proposed) });
        showToast("Interest sent.");
        await loadInvestorWorkspace();
      } catch (error) {
        showToast(error.detail || "Could not send interest.", "error");
      }
    }

    async function openStartupProfile(startupId) {
      try {
        const data = await apiCall("POST", `/investors/${state.userId}/view/${startupId}`);
        if (!data) return;
        showToast("Startup view recorded.");
        await refreshFundingWidget(startupId);
      } catch (error) {
        showToast(error.detail || "Could not record startup view.", "error");
      }
    }

    async function transferFunds(startupId, button) {
      const input = document.getElementById(`transferAmount_${startupId}`);
      const amount = Number(input?.value);
      if (!amount || amount <= 0) {
        showToast("Enter a valid transfer amount.", "warn");
        return;
      }
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Transferring...";
      try {
        await apiCall("POST", "/funds/transfer", { startup_id: startupId, amount });
        showToast(`Transfer of ${money(amount)} complete.`);
        await loadInvestorWorkspace();
      } catch (error) {
        const detail = String(error.detail || error.message || error);
        if (detail.toLowerCase().includes("locked")) showToast("Round locked. Retry shortly.", "warn");
        else if (detail.toLowerCase().includes("oversubscribe")) showToast("Transfer would oversubscribe the round.", "error");
        else if (detail.toLowerCase().includes("insufficient")) showToast("Insufficient wallet balance.", "error");
        else showToast(detail, "error");
        await refreshFundingWidget(startupId);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function restoreSession() {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("userRole");
      const name = localStorage.getItem("userName");
      const userId = localStorage.getItem("userId");
      if (!token || !role || !name || !userId) return false;
      state.role = role;
      state.userName = name;
      state.userId = userId;
      $("#authScreen").classList.add("hidden");
      $("#appShell").classList.remove("hidden");
      updateWorkspaceHeader();
      switchWorkspace(role);
      refreshWorkspace();
      return true;
    }

    function wireEvents() {
      $("#loginButton").addEventListener("click", performLogin);
      $("#loginPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") performLogin(); });
      $("#logoutButton").addEventListener("click", handleLogout);
      $("#refreshWorkspaceButton").addEventListener("click", refreshWorkspace);
      $("#achievementForm").addEventListener("submit", submitAchievement);
      $("#feedFilterForm").addEventListener("submit", async (event) => { event.preventDefault(); await loadStartupFeed(); });
      $("#resetFeedButton").addEventListener("click", async () => { $("#feedFilterForm").reset(); await loadStartupFeed(); });
      $("#startupFeedList").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const startupId = button.dataset.startupId;
        if (button.dataset.action === "view") await openStartupProfile(startupId);
        if (button.dataset.action === "interest") await expressInterest(startupId);
        if (button.dataset.action === "transfer") await transferFunds(startupId, button);
      });
    }

    function init() {
      fillFilterSelects();
      wireEvents();
      restoreSession();
    }

    init();
  