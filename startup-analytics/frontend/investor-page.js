function renderInvestorProfile(item) {
  const walletSummary = document.getElementById("investorWalletSummary");
  if (walletSummary) walletSummary.textContent = money(item.wallet_balance || 0);
  $("#investorProfileView").innerHTML = `
    <div class="profile-grid">
      <div class="profile-cell"><div class="meta">Name</div><strong>${esc(item.name)}</strong></div>
      <div class="profile-cell"><div class="meta">Firm</div><strong>${esc(item.firm || "-")}</strong></div>
      <div class="profile-cell"><div class="meta">Type</div><strong>${esc(item.type || "-")}</strong></div>
      <div class="profile-cell"><div class="meta">Wallet Balance</div><strong>${money(item.wallet_balance || 0)}</strong></div>
      <div class="profile-cell"><div class="meta">Ticket Range</div><strong>${money(item.ticket_min)} to ${money(item.ticket_max)}</strong></div>
      <div class="profile-cell"><div class="meta">Preferred Sectors</div><strong>${esc((item.preferred_sectors || []).join(", ") || "-")}</strong></div>
      <div class="profile-cell"><div class="meta">Stage Focus</div><strong>${esc((item.stage_focus || []).join(", ") || "-")}</strong></div>
      <div class="profile-cell"><div class="meta">Bio</div><strong>${esc(item.bio || "No bio added")}</strong></div>
    </div>`;
}

function renderInvestorMatches(items) {
  const safeItems = items || [];
  const matchCount = document.getElementById("investorMatchCount");
  if (matchCount) matchCount.textContent = safeItems.length;
  $("#investorMatchesList").innerHTML = !items || !items.length ? '<div class="empty">No matches available yet.</div>' : items.map((item) => `
    <div class="match-card">
      <div class="inline" style="justify-content:space-between">
        <strong>${esc(item.startup_name)}</strong>
        <span class="badge">${Number(item.total_score || 0)}/110</span>
      </div>
      <div class="meta" style="margin-top:8px">${esc(item.sector)} / ${esc(item.stage)}</div>
      <div class="meta" style="margin-top:10px">Sector ${item.sector_score || 0} · Ticket ${item.ticket_score || 0} · Stage ${item.stage_score || 0} · Network ${item.network_score || 0} · Achievement ${item.achievement_score || 0}</div>
    </div>`).join("");
}

function fundingWidget(progress, lock, startupId) {
  const percentage = Math.max(0, Math.min(100, Number(progress.percentage || 0)));
  const fillClass = percentage >= 100 ? "progress-fill full" : percentage >= 75 ? "progress-fill warn" : "progress-fill";
  return `
    <div class="stack" style="margin-top:14px">
      <div class="inline" style="justify-content:space-between">
        <span class="${lock.is_locked ? "badge warn" : "badge good"}">${lock.is_locked ? "Round locked" : "Round open"}</span>
        <span class="meta">Funded ${money(progress.received_funding)} of ${money(progress.funding_ask)}</span>
      </div>
      <div class="progress-track"><div class="${fillClass}" style="width:${percentage}%"></div></div>
      <div class="meta">${percentage >= 100 ? "Fully funded" : `${percentage}% of round filled`}</div>
      <div class="inline">
        <input id="transferAmount_${startupId}" type="number" min="1" step="1000" placeholder="Transfer amount">
        <button class="primary" type="button" data-action="transfer" data-startup-id="${startupId}">Transfer Funds</button>
      </div>
    </div>`;
}

async function refreshFundingWidget(startupId) {
  const shell = document.getElementById(`fundingWidget_${startupId}`);
  if (!shell) return;
  try {
    const [lock, progress] = await Promise.all([apiCall("GET", `/funds/lock-status/${startupId}`), apiCall("GET", `/startups/${startupId}/funding-progress`)]);
    if (!lock || !progress) return;
    shell.innerHTML = fundingWidget(progress, lock, startupId);
  } catch (error) {
    shell.innerHTML = `<div class="empty">${esc(error.detail || error.message || error)}</div>`;
  }
}

function renderFeed(items) {
  $("#startupFeedList").innerHTML = !items || !items.length ? '<div class="empty">No startups matched the current filters.</div>' : items.map((item) => `
    <div class="feed-card">
      <div class="inline" style="justify-content:space-between">
        <div>
          <h3>${esc(item.name)}</h3>
          <div class="meta">${esc(item.sector)} / ${esc(item.stage)}</div>
        </div>
        <span class="badge">${money(item.funding_ask)}</span>
      </div>
      <div style="margin-top:10px">${esc(item.pitch || "No pitch provided.")}</div>
      <div class="inline" style="margin-top:14px">
        <button class="ghost" type="button" data-action="view" data-startup-id="${item.id}">View Profile</button>
        <button class="secondary" type="button" data-action="interest" data-startup-id="${item.id}">Express Interest</button>
      </div>
      <div id="fundingWidget_${item.id}" class="muted-box" style="margin-top:14px">Loading funding widget...</div>
    </div>`).join("");
  (items || []).forEach((item) => refreshFundingWidget(item.id));
}

function renderFundHistory(items) {
  const safeItems = items || [];
  const transferCount = document.getElementById("investorTransferCount");
  if (transferCount) transferCount.textContent = safeItems.length;
  $("#fundHistoryList").innerHTML = !items || !items.length ? '<div class="empty">No transfers completed yet.</div>' : items.map((item) => `
    <div class="history-card">
      <strong>${esc(item.startup)}</strong>
      <div class="meta">${esc(item.sector)} · ${money(item.amount)}</div>
      <div class="meta">${esc(formatDate(item.transferred_at))}</div>
    </div>`).join("");
}

async function loadInvestorFeed() {
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

async function openStartupProfile(startupId) {
  try {
    await apiCall("POST", `/investors/${session().userId}/view/${startupId}`);
    showToast("Startup view recorded.");
    await refreshFundingWidget(startupId);
  } catch (error) {
    showToast(error.detail || "Could not record startup view.", "error");
  }
}

async function expressInterest(startupId) {
  const message = window.prompt("Message to the startup:", "Interested in learning more.");
  if (message === null) return;
  const proposed = window.prompt("Proposed amount (INR):", "250000");
  if (proposed === null) return;
  try {
    await apiCall("POST", "/connect/interest", { investor_id: session().userId, startup_id: startupId, message, proposed_amount: Number(proposed) });
    showToast("Interest sent.");
    window.location.reload();
  } catch (error) {
    showToast(error.detail || "Could not send interest.", "error");
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
    window.location.reload();
  } catch (error) {
    showToast(error.detail || "Could not transfer funds.", "error");
    await refreshFundingWidget(startupId);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function initInvestorPage() {
  const current = requireAuth("INVESTOR");
  if (!current) return;
  initThemeToggle();
  renderHeader("Investor Workspace", "Deal discovery, wallet tracking, funding transfers, and startup matches.");
  fillFilterSelects();
  $("#logoutButton").addEventListener("click", logout);
  $("#refreshWorkspaceButton").addEventListener("click", () => window.location.reload());
  $("#feedFilterForm").addEventListener("submit", async (event) => { event.preventDefault(); await loadInvestorFeed(); });
  $("#resetFeedButton").addEventListener("click", async () => { $("#feedFilterForm").reset(); await loadInvestorFeed(); });
  $("#startupFeedList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const startupId = button.dataset.startupId;
    if (button.dataset.action === "view") await openStartupProfile(startupId);
    if (button.dataset.action === "interest") await expressInterest(startupId);
    if (button.dataset.action === "transfer") await transferFunds(startupId, button);
  });
  await loadHealth();
  const profile = await apiCall("GET", `/investors/${current.userId}`);
  if (profile) renderInvestorProfile(profile.item);
  const matches = await apiCall("GET", `/investors/${current.userId}/matches`);
  if (matches) renderInvestorMatches(matches.matches || []);
  const history = await apiCall("GET", `/funds/history/${current.userId}`);
  if (history) renderFundHistory(history.items || []);
  await loadInvestorFeed();
}
