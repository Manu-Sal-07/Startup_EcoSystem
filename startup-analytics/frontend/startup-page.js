function profileGrid(items) {
  return `<div class="profile-grid">${items.map((item) => `
    <div class="profile-cell">
      <div class="meta">${esc(item.label)}</div>
      <strong>${esc(item.value)}</strong>
    </div>`).join("")}</div>`;
}

function renderStartupProfile(item) {
  $("#startupProfileView").innerHTML = profileGrid([
    { label: "Name", value: item.name },
    { label: "Sector", value: item.sector },
    { label: "Stage", value: item.stage },
    { label: "Funding Ask", value: money(item.funding_ask) },
    { label: "Received Funding", value: money(item.received_funding || 0) },
    { label: "Equity Offered", value: `${item.equity_offered}%` },
    { label: "Team Size", value: item.team_size ?? "-" },
    { label: "Revenue", value: money(item.revenue || 0) },
    { label: "Founded", value: item.founded ?? "-" },
    { label: "Pitch", value: item.pitch || "No pitch provided" },
  ]);
}

function renderAchievements(items) {
  const safeItems = items || [];
  const achievementCount = document.getElementById("startupAchievementCount");
  if (achievementCount) achievementCount.textContent = safeItems.length;
  $("#achievementTimeline").innerHTML = !items || !items.length ? '<div class="empty">No achievements posted yet.</div>' : items.map((item) => `
    <div class="achievement-item">
      <div class="inline" style="justify-content:space-between">
        <span class="badge">${esc(item.type)}</span>
        <div class="inline">
          <span class="meta">${esc(formatDate(item.date))}</span>
          ${item.verified ? '<span class="badge good">Verified</span>' : ''}
        </div>
      </div>
      <h3 style="margin-top:10px">${esc(item.title)}</h3>
      <div class="sub" style="margin-top:8px">${esc(item.description || "No description")}</div>
      ${item.media_url ? `<a class="meta" href="${esc(item.media_url)}" target="_blank" rel="noreferrer">View supporting link</a>` : ""}
    </div>`).join("");
}

function renderViewers(viewers) {
  const entries = Object.entries(viewers || {});
  const viewerCount = document.getElementById("startupViewerCount");
  if (viewerCount) viewerCount.textContent = entries.length;
  $("#startupViewersList").innerHTML = !entries.length ? '<div class="empty">No investors have viewed this startup yet.</div>' : entries.map(([investorId, timestamp]) => `
    <div class="history-card">
      <strong>${esc(investorId)}</strong>
      <div class="meta">${esc(formatDate(timestamp))}</div>
    </div>`).join("");
}

function renderConnections(items) {
  $("#startupConnectionsList").innerHTML = !items || !items.length ? '<div class="empty">No connection requests yet.</div>' : items.map((item) => `
    <div class="history-card">
      <div class="inline" style="justify-content:space-between">
        <strong>${esc(item.investor_name || item.investor_id)}</strong>
        <span class="badge">${esc(item.status)}</span>
      </div>
      <div class="meta" style="margin-top:8px">${esc(item.message || "No message")}</div>
      <div class="meta">Proposed amount: ${money(item.proposed_amount || 0)}</div>
      ${item.status === "pending" ? `
        <div class="inline" style="margin-top:10px">
          <button class="primary" type="button" data-action="accept" data-investor-id="${item.investor_id}">Accept</button>
          <button class="ghost" type="button" data-action="reject" data-investor-id="${item.investor_id}">Reject</button>
        </div>` : ""}
    </div>`).join("");
}

function renderStartupMatches(items) {
  const safeItems = items || [];
  const matchCount = document.getElementById("startupMatchCount");
  if (matchCount) matchCount.textContent = safeItems.length;
  $("#startupMatchesList").innerHTML = !items || !items.length ? '<div class="empty">No matches available yet.</div>' : items.map((item) => `
    <div class="match-card">
      <div class="inline" style="justify-content:space-between">
        <strong>${esc(item.investor_name)}</strong>
        <span class="badge">${Number(item.total_score || 0)}/110</span>
      </div>
      <div class="meta" style="margin-top:8px">${esc(item.firm || "Investor")} · ${money(item.ticket_min || 0)} to ${money(item.ticket_max || 0)}</div>
      <div class="meta" style="margin-top:10px">Sector ${item.sector_score || 0} · Ticket ${item.ticket_score || 0} · Stage ${item.stage_score || 0} · Network ${item.network_score || 0} · Achievement ${item.achievement_score || 0}</div>
    </div>`).join("");
}

async function initStartupPage() {
  const current = requireAuth("STARTUP");
  if (!current) return;
  initThemeToggle();
  renderHeader("Startup Workspace", "Profile, achievements, viewers, connections, and investor matches.");
  $("#logoutButton").addEventListener("click", logout);
  $("#refreshWorkspaceButton").addEventListener("click", () => window.location.reload());
  $("#achievementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await apiCall("POST", "/achievements/post", {
        type: form.type.value.toLowerCase(),
        title: form.title.value,
        description: form.description.value,
        value: form.value.value ? Number(form.value.value) : null,
        date: form.date.value,
        media_url: form.media_url.value || null,
      });
      form.reset();
      showToast("Achievement posted.");
      window.location.reload();
    } catch (error) {
      showToast(error.detail || "Could not post achievement.", "error");
    }
  });
  $("#startupConnectionsList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const payload = { investor_id: button.dataset.investorId, startup_id: current.userId };
    try {
      if (button.dataset.action === "accept") await apiCall("POST", "/connect/accept", payload);
      if (button.dataset.action === "reject") await apiCall("POST", "/connect/reject", payload);
      showToast("Connection updated.");
      window.location.reload();
    } catch (error) {
      showToast(error.detail || "Could not update connection.", "error");
    }
  });

  await loadHealth();
  const profile = await apiCall("GET", `/startups/${current.userId}`);
  if (profile) {
    setSourceBadge("startupProfileSource", profile.source, "Profile");
    renderStartupProfile(profile.item);
  }
  const achievements = await apiCall("GET", `/startups/${current.userId}/achievements`);
  if (achievements) {
    setSourceBadge("achievementSource", achievements.source, "Timeline");
    renderAchievements(achievements.items || []);
  }
  const viewers = await apiCall("GET", `/startups/${current.userId}/viewers`);
  if (viewers) renderViewers(viewers.viewers || {});
  const connections = await apiCall("GET", `/connections/${current.userId}`);
  if (connections) renderConnections(connections.items || []);
  const matches = await apiCall("GET", `/startups/${current.userId}/matches`);
  if (matches) renderStartupMatches(matches.matches || []);
}
