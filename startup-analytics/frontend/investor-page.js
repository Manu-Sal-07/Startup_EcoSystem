// Global State Store
let currentInvestor = null;
let matchesData = [];
let fundingHistory = [];
let startupsFeed = [];
let activeTab = "home";
let activeCrmTab = "pending";
let activeChatId = null;

// Local storage key helper
function getStoreKey(prefix) {
  return `${prefix}_${currentInvestor?.id || "anon"}`;
}

// Helper: load local items
function loadLocal(key, defaults = []) {
  try {
    const val = localStorage.getItem(getStoreKey(key));
    return val ? JSON.parse(val) : defaults;
  } catch (e) {
    return defaults;
  }
}

// Helper: save local items
function saveLocal(key, data) {
  try {
    localStorage.setItem(getStoreKey(key), JSON.stringify(data));
  } catch (e) {}
}

// ── SPA Routing ──
function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "home";
  activeTab = hash;

  // Toggle active class on sidebar buttons
  document.querySelectorAll(".sp-nav-item").forEach(btn => {
    if (btn.dataset.page === activeTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Toggle active page section
  document.querySelectorAll(".sp-page").forEach(page => {
    if (page.id === `page-${activeTab}`) {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  });

  // Render respective page
  switch (activeTab) {
    case "home":
      renderHome();
      break;
    case "discovery":
      renderDiscovery();
      break;
    case "recommended":
      renderRecommended();
      break;
    case "portfolio":
      renderPortfolio();
      break;
    case "connections":
      renderConnections();
      break;
    case "messages":
      renderMessages();
      break;
    case "analytics":
      renderAnalytics();
      break;
    case "settings":
      renderSettings();
      break;
  }

  // Refresh Feather Icons
  if (typeof feather !== "undefined") {
    feather.replace();
  }
}

// ── Render Page 1: Home Command Center ──
function renderHome() {
  // Update metric counters
  const walletBal = currentInvestor?.wallet_balance || 0;
  document.getElementById("investorWalletSummary").textContent = money(walletBal);
  document.getElementById("metricPortfolioCount").textContent = fundingHistory.length;
  
  // Calculate pending outgoing proposals
  const pendingInterests = loadLocal("interests", []).filter(p => p.status === "pending");
  document.getElementById("metricPendingCount").textContent = pendingInterests.length;
  
  document.getElementById("metricMatchesCount").textContent = matchesData.length;

  // Capital Deployed
  const deployed = fundingHistory.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  document.getElementById("metricDeployedAmount").textContent = money(deployed);

  // Home Portfolio Summary View
  const portSummary = document.getElementById("homePortfolioSummary");
  if (fundingHistory.length === 0) {
    portSummary.innerHTML = `
      <div class="sp-empty">
        <i data-feather="briefcase" style="width:24px;height:24px;color:var(--text-sec);margin-bottom:8px"></i>
        <p style="font-size:0.85rem">No investments logged yet.</p>
      </div>`;
  } else {
    portSummary.innerHTML = fundingHistory.slice(0, 4).map(item => `
      <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:var(--r-inner);background:var(--bg)">
        <div>
          <strong style="font-size:0.9rem">${esc(item.startup)}</strong>
          <div style="font-size:0.75rem;color:var(--text-sec);margin-top:2px">${esc(item.sector)}</div>
        </div>
        <div style="text-align:right">
          <strong style="color:var(--primary);font-size:0.9rem">${money(item.amount)}</strong>
          <div style="font-size:0.72rem;color:var(--text-sec);margin-top:2px">${esc(formatDate(item.transferred_at))}</div>
        </div>
      </div>
    `).join("");
  }

  // Home Matches Preview
  const matchesSummary = document.getElementById("homeMatchesWidget");
  if (matchesData.length === 0) {
    matchesSummary.innerHTML = `
      <div class="sp-empty">
        <i data-feather="star" style="width:24px;height:24px;color:var(--text-sec);margin-bottom:8px"></i>
        <p style="font-size:0.85rem">No startup matches computed.</p>
      </div>`;
  } else {
    matchesSummary.innerHTML = matchesData.slice(0, 4).map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border);border-radius:var(--r-inner)">
        <div>
          <strong style="font-size:0.9rem">${esc(item.name)}</strong>
          <div style="font-size:0.75rem;color:var(--text-sec);margin-top:2px">${esc(item.sector)} · Ask ${money(item.funding_ask)}</div>
        </div>
        <span class="sp-badge sp-badge--blue">${item.total_score} pts</span>
      </div>
    `).join("");
  }
}

// ── Render Page 2: Startup Discovery ──
function renderDiscovery() {
  applyDiscoveryFilters();
}

function applyDiscoveryFilters() {
  const search = document.getElementById("discoverySearch").value.toLowerCase();
  const sector = document.getElementById("discoverySector").value;
  const stage = document.getElementById("discoveryStage").value;
  const minAsk = parseFloat(document.getElementById("discoveryMinAsk").value) || 0;
  const maxAsk = parseFloat(document.getElementById("discoveryMaxAsk").value) || Infinity;

  const filtered = startupsFeed.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search);
    const matchSector = !sector || item.sector === sector;
    const matchStage = !stage || item.stage === stage;
    const matchAsk = (item.funding_ask >= minAsk) && (item.funding_ask <= maxAsk);
    return matchSearch && matchSector && matchStage && matchAsk;
  });

  const listContainer = document.getElementById("discoveryFeedList");
  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="sp-empty">
        <i data-feather="search" style="width:32px;height:32px;color:var(--text-sec);margin-bottom:8px"></i>
        <h4 class="sp-h3">No startups found</h4>
        <p class="sp-sub">Try expanding your filter parameters</p>
      </div>`;
    return;
  }

  listContainer.innerHTML = filtered.map(item => {
    // Check if investor has expressed interest
    const interests = loadLocal("interests", []);
    const isInterested = interests.some(i => i.startup_id === item.id);
    const isSaved = loadLocal("saved_startups", []).includes(item.id);

    return `
      <article class="startup-card" id="startupCard_${item.id}">
        <div class="startup-card__header">
          <div class="startup-card__logo">${esc(item.name.substring(0, 2).toUpperCase())}</div>
          <div class="startup-card__info">
            <h3 class="startup-card__title">${esc(item.name)}</h3>
            <span class="startup-card__sector">${esc(item.sector)} · ${esc(item.stage)}</span>
          </div>
          <div>
            <button class="sp-btn sp-btn--ghost sp-btn--sm" data-action="save" data-id="${item.id}" title="${isSaved ? 'Unsave Startup' : 'Save Startup'}">
              <i data-feather="bookmark" style="${isSaved ? 'fill:var(--primary);color:var(--primary)' : ''}"></i>
            </button>
          </div>
        </div>

        <div class="startup-card__pitch">${esc(item.pitch || "No pitch details recorded.")}</div>

        <div class="startup-card__meta-grid">
          <div class="startup-card__meta-item">
            <span class="startup-card__meta-label">Funding Ask</span>
            <span class="startup-card__meta-value">${money(item.funding_ask)}</span>
          </div>
          <div class="startup-card__meta-item">
            <span class="startup-card__meta-label">ARR Revenue</span>
            <span class="startup-card__meta-value">${money(item.revenue || 0)}</span>
          </div>
          <div class="startup-card__meta-item">
            <span class="startup-card__meta-label">Equity Offered</span>
            <span class="startup-card__meta-value">${item.equity_offered || 0}%</span>
          </div>
        </div>

        <!-- Dynamic Funding Transfer Widget inside Discovery Card -->
        <div id="fundingWidget_${item.id}" class="funding-widget-box">
          <div style="font-size:0.8rem;color:var(--text-sec)">Loading funding details...</div>
        </div>

        <div class="startup-card__actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" data-action="view" data-id="${item.id}">
            <i data-feather="eye"></i>
            <span>View Profile</span>
          </button>
          <button class="sp-btn ${isInterested ? 'sp-btn--secondary' : 'sp-btn--primary'} sp-btn--sm" data-action="interest" data-id="${item.id}" data-name="${esc(item.name)}" ${isInterested ? 'disabled' : ''}>
            <i data-feather="send"></i>
            <span>${isInterested ? 'Interest Expressed' : 'Express Interest'}</span>
          </button>
        </div>
      </article>
    `;
  }).join("");

  filtered.forEach(item => refreshFundingWidget(item.id));
  if (typeof feather !== "undefined") {
    feather.replace();
  }
}

// Dynamic widget updater
async function refreshFundingWidget(startupId) {
  const container = document.getElementById(`fundingWidget_${startupId}`);
  if (!container) return;
  try {
    const [lock, progress] = await Promise.all([
      apiCall("GET", `/funds/lock-status/${startupId}`),
      apiCall("GET", `/startups/${startupId}/funding-progress`)
    ]);
    if (!lock || !progress) return;

    const percentage = Math.max(0, Math.min(100, Number(progress.percentage || 0)));
    const fillStyle = percentage >= 100 ? "background:var(--success)" : percentage >= 75 ? "background:var(--warning)" : "background:var(--primary)";

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem">
        <span class="sp-badge ${lock.is_locked ? 'sp-badge--red' : 'sp-badge--green'}">${lock.is_locked ? 'Round Locked' : 'Round Open'}</span>
        <span style="font-weight:600">${money(progress.received_funding)} / ${money(progress.funding_ask)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${percentage}%; ${fillStyle}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <input type="number" class="sp-input sp-btn--sm" id="transferInput_${startupId}" min="1000" step="5000" placeholder="Transfer size (INR)" style="flex:1;padding:6px 10px;font-size:0.8rem">
        <button class="sp-btn sp-btn--primary sp-btn--sm" data-action="transfer" data-id="${startupId}">Transfer</button>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<span style="font-size:0.75rem;color:var(--danger)">Offline: ${esc(err.message)}</span>`;
  }
}

// ── Render Page 3: Recommended Startups ──
function renderRecommended() {
  const container = document.getElementById("recommendedMatchesList");
  if (matchesData.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="award" style="width:32px;height:32px;color:var(--text-sec);margin-bottom:8px"></i>
        <h4 class="sp-h3">No recommendations computed</h4>
        <p class="sp-sub">Database is generating matching profiles</p>
      </div>`;
    return;
  }

  container.innerHTML = matchesData.map(item => {
    const interests = loadLocal("interests", []);
    const isInterested = interests.some(i => i.startup_id === item.id);
    const isSaved = loadLocal("saved_startups", []).includes(item.id);

    return `
      <article class="match-card">
        <div class="match-card__score-section">
          <div class="match-score-badge">
            ${item.total_score}
            <span>score</span>
          </div>
          <div class="sp-badge sp-badge--blue" style="margin-top:10px">Neo4j Match</div>
        </div>

        <div class="match-card__main">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <h3 class="sp-h2">${esc(item.name)}</h3>
              <div class="sp-sub">${esc(item.sector)} · ${esc(item.stage)}</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="sp-btn sp-btn--secondary sp-btn--sm" data-action="save" data-id="${item.id}">
                <i data-feather="bookmark" style="${isSaved ? 'fill:var(--primary);color:var(--primary)' : ''}"></i>
              </button>
              <button class="sp-btn ${isInterested ? 'sp-btn--secondary' : 'sp-btn--primary'} sp-btn--sm" data-action="interest" data-id="${item.id}" data-name="${esc(item.name)}" ${isInterested ? 'disabled' : ''}>
                <span>${isInterested ? 'Interest Expressed' : 'Express Interest'}</span>
              </button>
            </div>
          </div>

          <div class="match-breakdown">
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Sector Fit</span>
                <span>${item.sector_score}/40</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width:${(item.sector_score/40)*100}%;background:var(--primary)"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Ticket Fit</span>
                <span>${item.ticket_score}/30</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width:${(item.ticket_score/30)*100}%;background:var(--success)"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Stage Focus</span>
                <span>${item.stage_score}/20</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width:${(item.stage_score/20)*100}%;background:var(--warning)"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Network Score</span>
                <span>${item.network_score}/10</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width:${(item.network_score/10)*100}%;background:var(--primary)"></div>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (typeof feather !== "undefined") {
    feather.replace();
  }
}

// ── Render Page 4: Portfolio Tracker ──
function renderPortfolio() {
  const container = document.getElementById("portfolioList");
  if (fundingHistory.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="briefcase" style="width:36px;height:36px;color:var(--text-sec);margin-bottom:8px"></i>
        <h4 class="sp-h3">Your portfolio is empty</h4>
        <p class="sp-sub">Discover startups and invest capital in their rounds</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border);text-align:left;color:var(--text-sec)">
          <th style="padding:12px">Startup</th>
          <th style="padding:12px">Sector</th>
          <th style="padding:12px">Commitment</th>
          <th style="padding:12px">Status</th>
          <th style="padding:12px">Transaction Date</th>
        </tr>
      </thead>
      <tbody>
        ${fundingHistory.map(item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px;font-weight:700">${esc(item.startup)}</td>
            <td style="padding:12px">${esc(item.sector)}</td>
            <td style="padding:12px;font-weight:600;color:var(--primary)">${money(item.amount)}</td>
            <td style="padding:12px"><span class="sp-badge sp-badge--green">${esc(item.status || "completed")}</span></td>
            <td style="padding:12px;color:var(--text-sec)">${esc(formatDate(item.transferred_at))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ── Render Page 5: Outbound Connection Proposals CRM ──
function renderConnections() {
  // Synchronize database funding history with connections storage
  let localInterests = loadLocal("interests", []);
  
  // If startup is in fundingHistory, it's accepted
  localInterests = localInterests.map(item => {
    const isFunded = fundingHistory.some(h => h.startup.toLowerCase() === item.startup_name.toLowerCase());
    if (isFunded) {
      item.status = "accepted";
    }
    return item;
  });
  saveLocal("interests", localInterests);

  const container = document.getElementById("connectionsCRMList");
  const filtered = localInterests.filter(item => item.status === activeCrmTab);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="inbox" style="width:32px;height:32px;color:var(--text-sec);margin-bottom:8px"></i>
        <p>No proposals currently in this stage.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div style="border:1px solid var(--border);padding:18px;border-radius:var(--r-inner);background:var(--card-bg);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <strong style="font-size:1rem">${esc(item.startup_name)}</strong>
          <span class="sp-badge ${item.status === 'accepted' ? 'sp-badge--green' : item.status === 'rejected' ? 'sp-badge--red' : 'sp-badge--yellow'}">${item.status}</span>
        </div>
        <p style="font-size:0.82rem;color:var(--text-sec);margin-top:6px">Proposed capital: <strong style="color:var(--text)">${money(item.proposed_amount)}</strong></p>
        <blockquote style="font-size:0.8rem;color:var(--text-sec);margin-top:6px;border-left:2px solid var(--border);padding-left:8px;font-style:italic">"${esc(item.message)}"</blockquote>
      </div>
      <div style="text-align:right;font-size:0.75rem;color:var(--text-sec)">
        <div>${esc(formatDate(item.date))}</div>
      </div>
    </div>
  `).join("");
}

// ── Render Page 6: Messaging deal rooms ──
function renderMessages() {
  const localInterests = loadLocal("interests", []);
  const listContainer = document.getElementById("conversationList");
  
  if (localInterests.length === 0) {
    listContainer.innerHTML = `<div style="padding:16px;text-align:center;font-size:0.8rem;color:var(--text-sec)">No deal rooms available. Express interest first.</div>`;
    document.getElementById("chatMessagesList").innerHTML = `
      <div class="sp-empty">
        <p>No active conversations. Submit interest in a startup to open a channel.</p>
      </div>`;
    document.getElementById("chatInputArea").style.display = "none";
    return;
  }

  // Load chat logs
  const chats = loadLocal("chats", {});

  listContainer.innerHTML = localInterests.map(item => {
    const isActive = activeChatId === item.startup_id;
    return `
      <button class="conversation-item ${isActive ? 'active' : ''}" data-id="${item.startup_id}">
        <div style="font-weight:600;font-size:0.9rem">${esc(item.startup_name)}</div>
        <div style="font-size:0.7rem;color:var(--text-sec);margin-top:2px">Deal room opened</div>
      </button>
    `;
  }).join("");

  // Bind click events on list buttons
  listContainer.querySelectorAll(".conversation-item").forEach(btn => {
    btn.addEventListener("click", () => {
      activeChatId = btn.dataset.id;
      renderMessages();
    });
  });

  const activeInterest = localInterests.find(i => i.startup_id === activeChatId);
  if (!activeInterest) {
    document.getElementById("chatInputArea").style.display = "none";
    return;
  }

  document.getElementById("chatHeaderName").textContent = activeInterest.startup_name;
  document.getElementById("chatHeaderSector").textContent = "Deal Room Room Channel";
  document.getElementById("chatInputArea").style.display = "block";

  const conversationHistory = chats[activeChatId] || [
    {
      sender: "founder",
      text: `Hello, thank you for expressing interest in ${activeInterest.startup_name}! We would love to share our investor deck and explain our ARR trajectory.`,
      ts: new Date(activeInterest.date).getTime() + 1000
    }
  ];

  // Save if not already saved to trigger mock answers
  if (!chats[activeChatId]) {
    chats[activeChatId] = conversationHistory;
    saveLocal("chats", chats);
  }

  const msgList = document.getElementById("chatMessagesList");
  msgList.innerHTML = conversationHistory.map(m => `
    <div class="chat-bubble ${m.sender === 'investor' ? 'chat-bubble--outbound' : 'chat-bubble--inbound'}">
      <div>${esc(m.text)}</div>
      <div style="font-size:0.6rem;opacity:0.8;margin-top:4px;text-align:right">${new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    </div>
  `).join("");

  msgList.scrollTop = msgList.scrollHeight;
}

// Send Message
function sendMessage() {
  const input = document.getElementById("chatMessageInput");
  const text = input.value.trim();
  if (!text || !activeChatId) return;

  const chats = loadLocal("chats", {});
  const conversation = chats[activeChatId] || [];

  // Outbound
  conversation.push({
    sender: "investor",
    text: text,
    ts: Date.now()
  });
  chats[activeChatId] = conversation;
  saveLocal("chats", chats);
  input.value = "";
  renderMessages();

  // Founder Auto Reply Simulation
  setTimeout(() => {
    const replies = [
      "Let's schedule a call to review the cap table and milestones.",
      "Yes, we have completed the pilot and are scaling our ARR. Let me send over the term sheet.",
      "I appreciate your question. Our tech lead can detail the Redis deployment on our next call.",
      "Sounds great! Looking forward to working together."
    ];
    const replyText = replies[Math.floor(Math.random() * replies.length)];
    conversation.push({
      sender: "founder",
      text: replyText,
      ts: Date.now()
    });
    chats[activeChatId] = conversation;
    saveLocal("chats", chats);
    renderMessages();
  }, 1500);
}

// ── Render Page 7: Portfolio Analytics ──
function renderAnalytics() {
  // Aggregate sector allocation
  const sectors = {};
  fundingHistory.forEach(item => {
    sectors[item.sector] = (sectors[item.sector] || 0) + (item.amount || 0);
  });

  const totalCap = fundingHistory.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  
  // Render Sector Allocations
  const sectorContainer = document.getElementById("analyticsSectorAllocation");
  if (Object.keys(sectors).length === 0) {
    sectorContainer.innerHTML = `<div style="text-align:center;font-size:0.85rem;color:var(--text-sec);padding:14px">Deploy capital to inspect allocation statistics.</div>`;
  } else {
    sectorContainer.innerHTML = Object.entries(sectors).map(([sec, amount]) => {
      const pct = totalCap > 0 ? Math.round((amount / totalCap) * 100) : 0;
      return `
        <div class="sp-field">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:600">
            <span>${esc(sec)}</span>
            <span>${pct}% (${money(amount)})</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Wallet Usage Percentage
  const maxCap = 10000000; // Simulated total fund capacity (10 Million INR)
  const deployedPct = Math.min(100, Math.round((totalCap / maxCap) * 100));
  document.getElementById("analyticsWalletUsage").textContent = `${deployedPct}%`;
  document.getElementById("analyticsWalletUsageBar").style.width = `${deployedPct}%`;

  // Avg Ticket
  const avg = fundingHistory.length > 0 ? Math.round(totalCap / fundingHistory.length) : 0;
  document.getElementById("analyticsAvgTicket").textContent = money(avg);
}

// ── Render Page 8: Preferences / Settings Settings ──
function renderSettings() {
  if (!currentInvestor) return;
  document.getElementById("settingsName").value = currentInvestor.name || "";
  document.getElementById("settingsFirm").value = currentInvestor.firm || "";
  document.getElementById("settingsTicketMin").value = currentInvestor.ticket_min || 0;
  document.getElementById("settingsTicketMax").value = currentInvestor.ticket_max || 0;
  document.getElementById("settingsBio").value = currentInvestor.bio || "";
}

async function saveSettings(e) {
  e.preventDefault();
  const name = document.getElementById("settingsName").value;
  const firm = document.getElementById("settingsFirm").value;
  const ticketMin = Number(document.getElementById("settingsTicketMin").value);
  const ticketMax = Number(document.getElementById("settingsTicketMax").value);
  const bio = document.getElementById("settingsBio").value;

  const originalText = document.getElementById("settingsSaveBtn").innerHTML;
  document.getElementById("settingsSaveBtn").disabled = true;
  document.getElementById("settingsSaveBtn").innerHTML = "Saving Settings...";

  try {
    // Local override
    currentInvestor.name = name;
    currentInvestor.firm = firm;
    currentInvestor.ticket_min = ticketMin;
    currentInvestor.ticket_max = ticketMax;
    currentInvestor.bio = bio;

    // Persist profile changes in local storage override to merge with backend payload
    localStorage.setItem(`investor_profile_override_${currentInvestor.id}`, JSON.stringify(currentInvestor));

    // Update topbar display details
    document.getElementById("topBarUserName").textContent = name;
    document.getElementById("topBarUserFirm").textContent = firm || "Venture Capitalist";

    showToast("Investment settings updated.");
  } catch (err) {
    showToast(err.message || "Failed saving settings.", "error");
  } finally {
    document.getElementById("settingsSaveBtn").disabled = false;
    document.getElementById("settingsSaveBtn").innerHTML = originalText;
  }
}

// Express Interest Function
async function expressInterest(startupId, startupName) {
  const message = window.prompt(`Submit brief message to ${startupName}:`, "Interested in evaluating your round pitch.");
  if (message === null) return;
  const proposed = window.prompt("Proposed investment size (INR):", "500000");
  if (proposed === null) return;

  try {
    await apiCall("POST", "/connect/interest", {
      investor_id: currentInvestor.id,
      startup_id: startupId,
      message,
      proposed_amount: Number(proposed)
    });

    // Save interest proposal in local tracker
    const interests = loadLocal("interests", []);
    interests.push({
      startup_id: startupId,
      startup_name: startupName,
      message,
      proposed_amount: Number(proposed),
      status: "pending",
      date: new Date().toISOString()
    });
    saveLocal("interests", interests);

    showToast(`Interest submitted successfully to ${startupName}.`);
    
    // Auto-reload to reflect interest status
    setTimeout(() => handleRoute(), 800);
  } catch (err) {
    showToast(err.detail || "Could not record proposal.", "error");
  }
}

// Transfer Funds Round commit
async function transferFunds(startupId, button) {
  const input = document.getElementById(`transferInput_${startupId}`);
  const amount = Number(input?.value);
  if (!amount || amount <= 0) {
    showToast("Enter a positive fund amount.", "warn");
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Transferring...";

  try {
    await apiCall("POST", "/funds/transfer", { startup_id: startupId, amount });
    
    showToast(`Transfer of ${money(amount)} completed.`);
    
    // Deduct locally to show immediate balance update
    currentInvestor.wallet_balance = (currentInvestor.wallet_balance || 0) - amount;
    document.getElementById("investorWalletSummary").textContent = money(currentInvestor.wallet_balance);

    // Refresh history immediately
    const history = await apiCall("GET", `/funds/history/${currentInvestor.id}`);
    if (history) {
      fundingHistory = history.items || [];
    }

    // Refresh matching and discovery
    await refreshFundingWidget(startupId);
    handleRoute();
  } catch (err) {
    showToast(err.detail || "Transfer operation failed.", "error");
    await refreshFundingWidget(startupId);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// Bookmark / Save Startup Toggle
function toggleSaveStartup(startupId) {
  const saved = loadLocal("saved_startups", []);
  const index = saved.indexOf(startupId);
  if (index > -1) {
    saved.splice(index, 1);
    showToast("Removed from bookmarks.");
  } else {
    saved.push(startupId);
    showToast("Startup bookmarked successfully.");
  }
  saveLocal("saved_startups", saved);
  handleRoute();
}

// Initialize Workspace Page
async function initInvestorPage() {
  const sessionUser = requireAuth("INVESTOR");
  if (!sessionUser) return;

  // Initialize theme mode
  initThemeToggle();

  // Load backend profile
  try {
    const profile = await apiCall("GET", `/investors/${sessionUser.userId}`);
    if (profile && profile.item) {
      currentInvestor = profile.item;

      // Merge local settings overrides
      const override = localStorage.getItem(`investor_profile_override_${currentInvestor.id}`);
      if (override) {
        currentInvestor = { ...currentInvestor, ...JSON.parse(override) };
      }

      // Populate Topbar Details
      document.getElementById("topBarUserName").textContent = currentInvestor.name;
      document.getElementById("topBarUserFirm").textContent = currentInvestor.firm || "Venture Capitalist";
      document.getElementById("topBarUser").style.display = "flex";
      document.getElementById("userAvatar").textContent = currentInvestor.name.substring(0, 1).toUpperCase();
      document.getElementById("investorWalletSummary").textContent = money(currentInvestor.wallet_balance || 0);
    }
  } catch (e) {
    showToast("Could not load investor profile.", "error");
  }

  // Load other essential workspace datasets
  try {
    const [matches, history, feed] = await Promise.all([
      apiCall("GET", `/investors/${sessionUser.userId}/matches`),
      apiCall("GET", `/funds/history/${sessionUser.userId}`),
      apiCall("GET", "/startups/feed")
    ]);

    if (matches) matchesData = matches.matches || [];
    if (history) fundingHistory = history.items || [];
    if (feed) startupsFeed = feed.items || [];
  } catch (err) {
    showToast("Network synchronization failed. Using offline assets.", "warn");
  }

  // Bind Sidebar Navigation click handlers
  document.querySelectorAll(".sp-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      window.location.hash = `#${item.dataset.page}`;
    });
  });

  // Handle direct hash routes and default routes
  window.addEventListener("hashchange", handleRoute);
  
  // Refresh and Actions Binding
  document.getElementById("refreshWorkspaceButton").addEventListener("click", () => window.location.reload());
  document.getElementById("logoutButton").addEventListener("click", logout);
  
  // Discovery Filter Events
  document.getElementById("discoveryApplyBtn").addEventListener("click", applyDiscoveryFilters);
  document.getElementById("discoveryResetBtn").addEventListener("click", () => {
    document.getElementById("discoverySearch").value = "";
    document.getElementById("discoverySector").value = "";
    document.getElementById("discoveryStage").value = "";
    document.getElementById("discoveryMinAsk").value = "";
    document.getElementById("discoveryMaxAsk").value = "";
    applyDiscoveryFilters();
  });

  // Connection CRM Tab toggles
  document.getElementById("connectionsTabs").addEventListener("click", (e) => {
    const tab = e.target.closest("button[data-tab]");
    if (!tab) return;
    
    document.querySelectorAll(".crm-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeCrmTab = tab.dataset.tab;
    renderConnections();
  });

  // Settings Save
  document.getElementById("investorSettingsForm").addEventListener("submit", saveSettings);

  // Chat message send
  document.getElementById("chatSendMessageBtn").addEventListener("click", sendMessage);
  document.getElementById("chatMessageInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Global Cards event delegator for dynamic elements
  document.addEventListener("click", async (e) => {
    const actionElement = e.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const targetId = actionElement.dataset.id;
    const targetName = actionElement.dataset.name;

    if (action === "save") {
      toggleSaveStartup(targetId);
    } else if (action === "interest") {
      await expressInterest(targetId, targetName);
    } else if (action === "transfer") {
      await transferFunds(targetId, actionElement);
    } else if (action === "view") {
      // Record startup view
      try {
        await apiCall("POST", `/investors/${currentInvestor.id}/view/${targetId}`);
        showToast("Profile view logged in feed.");
        await refreshFundingWidget(targetId);
      } catch (err) {
        showToast("View tracker offline.", "warn");
      }
    }
  });

  // Mobile sidebar menu toggle
  const menuBtn = document.getElementById("menuToggleButton");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  
  if (menuBtn && sidebar && backdrop) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("visible");
    });
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("visible");
    });
  }

  // Load health indicators
  await loadHealth();

  // Load first route
  handleRoute();
}

// Health status indicator loading
async function loadHealth() {
  const badge = document.getElementById("apiHealthBadge");
  try {
    const res = await apiCall("GET", "/health");
    if (res && res.status === "healthy") {
      badge.textContent = "API Sync Online";
      badge.className = "sp-badge sp-badge--green";
    }
  } catch (err) {
    badge.textContent = "Offline Mode";
    badge.className = "sp-badge sp-badge--red";
  }
}
