// Global state for cached data
let startupProfileData = null;
let achievementsData = [];
let viewersData = {};
let connectionsData = [];
let matchesData = [];

// Theme helpers
function initTheme() {
  initThemeToggle();
  const updateThemeIcon = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const themeBtn = document.getElementById("themeToggleButton");
    if (themeBtn) {
      themeBtn.innerHTML = isDark 
        ? `<i data-feather="sun" style="width:14px;height:14px"></i>` 
        : `<i data-feather="moon" style="width:14px;height:14px"></i>`;
      feather.replace();
    }
  };
  updateThemeIcon();
  const themeBtn = document.getElementById("themeToggleButton");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      setTimeout(updateThemeIcon, 50);
    });
  }
}

// Router & Tab switching
function handleRoute() {
  const hash = window.location.hash || '#home';
  const pageMap = {
    '#home': 'home',
    '#profile': 'profile',
    '#milestones': 'milestones',
    '#matches': 'matches',
    '#viewers': 'viewers',
    '#connections': 'connections',
    '#analytics': 'analytics',
    '#settings': 'settings'
  };
  
  const pageId = pageMap[hash] || 'home';
  
  // Highlight active sidebar item
  document.querySelectorAll('.sp-sidebar__nav .sp-nav-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch visible page container
  document.querySelectorAll('.sp-page').forEach(view => {
    view.classList.remove('active');
  });
  const currentView = document.getElementById(`page-${pageId}`);
  if (currentView) {
    currentView.classList.add('active');
  }

  // Trigger appropriate page renderer
  if (pageId === 'home') {
    renderHome();
  } else if (pageId === 'profile') {
    renderProfile();
  } else if (pageId === 'milestones') {
    renderMilestonesPage();
  } else if (pageId === 'matches') {
    renderMatchesPage();
  } else if (pageId === 'viewers') {
    renderViewersPage();
  } else if (pageId === 'connections') {
    renderConnectionsPage();
  } else if (pageId === 'analytics') {
    renderAnalyticsPage();
  } else if (pageId === 'settings') {
    renderSettingsPage();
  }
}


// Helper to get initials
function getInitials(name) {
  return String(name || "SU")
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Profile strength calculator
function getProfileStrength(profile) {
  const checkFields = [
    { field: 'name', label: 'Company Name' },
    { field: 'sector', label: 'Industry Sector' },
    { field: 'stage', label: 'Funding Stage' },
    { field: 'funding_ask', label: 'Capital Ask Amount' },
    { field: 'equity_offered', label: 'Equity Allocation' },
    { field: 'team_size', label: 'Team Size' },
    { field: 'revenue', label: 'Annual ARR' },
    { field: 'founded', label: 'Founding Year' },
    { field: 'pitch', label: 'Elevator Pitch' }
  ];
  const missing = [];
  let filled = 0;
  checkFields.forEach(item => {
    const val = profile ? profile[item.field] : null;
    if (val !== undefined && val !== null && val !== '' && val !== 0) {
      filled++;
    } else {
      missing.push(item.label);
    }
  });
  const pct = Math.round((filled / checkFields.length) * 100);
  return { pct, missing };
}

// Funding readiness score
function getFundingReadiness(profile, achievementsCount, matchesCount) {
  const strength = getProfileStrength(profile);
  const profileScore = strength.pct * 0.3; // max 30
  const milestoneScore = Math.min(achievementsCount, 3) * 10; // max 30
  const matchScore = Math.min(matchesCount, 4) * 5; // max 20
  const askScore = (profile && profile.funding_ask > 0) ? 10 : 0; // max 10
  const equityScore = (profile && profile.equity_offered > 0) ? 10 : 0; // max 10
  return Math.round(profileScore + milestoneScore + matchScore + askScore + equityScore);
}

// Deterministic mock details for visual enhancement
function getDeterministicInvestorDetails(name, firm) {
  const nm = String(name || "").toLowerCase();
  const fm = String(firm || "").toLowerCase();
  
  let ticket = "₹50L - ₹2Cr";
  let loc = "Bengaluru, India";
  let type = "Venture Capital";
  
  if (nm.includes("apoorva") || fm.includes("anicut")) {
    ticket = "₹50L - ₹3Cr";
    loc = "Mumbai, India";
    type = "Venture Capital";
  } else if (nm.includes("rajesh") || fm.includes("kalaari")) {
    ticket = "₹1Cr - ₹5Cr";
    loc = "Bengaluru, India";
    type = "Venture Capital";
  } else if (nm.includes("sanjay") || fm.includes("100x")) {
    ticket = "₹25L - ₹1Cr";
    loc = "Mumbai, India";
    type = "Micro VC";
  } else if (nm.includes("kunal") || fm.includes("cred")) {
    ticket = "₹10L - ₹50L";
    loc = "Bengaluru, India";
    type = "Angel Investor";
  } else if (fm.includes("sequoia") || fm.includes("peak")) {
    ticket = "₹2Cr - ₹10Cr";
    loc = "Bengaluru, India";
    type = "Growth Equity";
  } else if (fm.includes("accel")) {
    ticket = "₹1.5Cr - ₹8Cr";
    loc = "Bengaluru, India";
    type = "Venture Capital";
  } else if (fm.includes("blume")) {
    ticket = "₹50L - ₹4Cr";
    loc = "Mumbai, India";
    type = "Venture Capital";
  }
  
  return { ticket, loc, type };
}

// Mobile sidebar toggler
function initSidebarMobileToggle() {
  const btn = document.getElementById("menuToggleBtn");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  
  const close = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("visible");
  };
  
  if (btn && sidebar && backdrop) {
    btn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("visible");
    });
    backdrop.addEventListener("click", close);
  }
}

// ----------------------------------------------------
// COMPONENTS AND HOME FEED RENDERERS
// ----------------------------------------------------

function renderStartupSummaryCard() {
  const profile = startupProfileData || {};
  const initials = getInitials(profile.name);
  const strength = getProfileStrength(profile);
  
  const container = document.getElementById("startupSummaryCard");
  if (!container) return;

  container.className = "sp-card sp-summary-card";
  container.innerHTML = `
    <div class="sp-summary-card__banner"></div>
    <div class="sp-summary-card__content">
      <div class="sp-summary-card__logo-wrap">${initials}</div>
      <h2 class="sp-summary-card__name">${esc(profile.name || "Startup Name")}</h2>
      <div class="sp-summary-card__meta">${esc(profile.sector || "Sector")} · ${esc(profile.stage || "Stage")}</div>
      
      <div class="sp-summary-card__ask" style="margin-bottom: 12px">
        <span class="sp-summary-card__ask-label">Funding Ask</span>
        <strong>${money(profile.funding_ask)}</strong>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 8px">
        <div style="display:flex; justify-content:space-between; font-size:.78rem; font-weight:600; margin-bottom:4px">
          <span>Profile Completion</span>
          <span style="color:var(--primary)">${strength.pct}%</span>
        </div>
        <div class="progress-bar-wrap" style="height:6px">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${strength.pct}%"></div>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px; display: flex; gap: 8px">
        <button class="sp-btn sp-btn--primary sp-btn--sm" style="flex:1" id="summaryCardEditBtn">Edit Profile</button>
        <button class="sp-btn sp-btn--ghost sp-btn--sm" style="flex:1" id="summaryCardAddMilestoneBtn">Add Milestone</button>
      </div>
    </div>
  `;

  // Attach event handlers to Summary Card buttons
  const editBtn = document.getElementById("summaryCardEditBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const modal = document.getElementById("editProfileModal");
      const form = document.getElementById("editProfileForm");
      if (modal && form) {
        form.elements['name'].value = profile.name || "";
        form.elements['website'].value = profile.website || "";
        form.elements['sector'].value = profile.sector || "FinTech";
        form.elements['stage'].value = profile.stage || "Seed";
        form.elements['location'].value = profile.location || "";
        form.elements['founded'].value = profile.founded || 2026;
        form.elements['team_size'].value = profile.team_size || 10;
        form.elements['revenue'].value = profile.revenue || 0;
        form.elements['received_funding'].value = profile.received_funding || 0;
        form.elements['funding_ask'].value = profile.funding_ask || 0;
        form.elements['equity_offered'].value = profile.equity_offered || 0;
        form.elements['pitch'].value = profile.pitch || "";
        modal.classList.add("open");
      }
    });
  }

  const addMilestoneBtn = document.getElementById("summaryCardAddMilestoneBtn");
  if (addMilestoneBtn) {
    addMilestoneBtn.addEventListener("click", () => {
      const modal = document.getElementById("milestoneModal");
      if (modal) modal.classList.add("open");
    });
  }
}

function renderQuickStatsCard() {
  const viewsCount = Object.keys(viewersData || {}).length;
  const matchesCount = matchesData ? matchesData.length : 0;
  const connectionsCount = connectionsData ? connectionsData.length : 0;
  const achievementsCount = achievementsData ? achievementsData.length : 0;

  const container = document.getElementById("quickStatsCard");
  if (!container) return;

  container.className = "sp-card sp-stats-card";
  container.innerHTML = `
    <h3 class="sp-stats-card__title">Ecosystem metrics</h3>
    <div class="sp-stats-card__grid">
      <div class="sp-stats-card__item">
        <span class="sp-stats-card__label">Profile Views</span>
        <span class="sp-stats-card__value">${viewsCount}</span>
      </div>
      <div class="sp-stats-card__item">
        <span class="sp-stats-card__label">Investor Matches</span>
        <span class="sp-stats-card__value">${matchesCount}</span>
      </div>
      <div class="sp-stats-card__item">
        <span class="sp-stats-card__label">Connection Requests</span>
        <span class="sp-stats-card__value">${connectionsCount}</span>
      </div>
      <div class="sp-stats-card__item">
        <span class="sp-stats-card__label">Milestones Posted</span>
        <span class="sp-stats-card__value">${achievementsCount}</span>
      </div>
    </div>
  `;
}

// Suggested investors
function renderSuggestedInvestorCard() {
  const container = document.getElementById("suggestedInvestorsCard");
  if (!container) return;

  container.className = "sp-card";
  
  if (!matchesData || matchesData.length === 0) {
    container.innerHTML = `
      <h3 class="sp-h3" style="margin-bottom:12px">Suggested Investors</h3>
      <p class="sp-sub">No matching investors found yet.</p>
    `;
    return;
  }

  const topMatches = [...matchesData]
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, 3);

  const itemsHtml = topMatches.map(match => `
    <div class="suggested-item">
      <div class="suggested-item__avatar">${getInitials(match.name)}</div>
      <div class="suggested-item__info">
        <span class="suggested-item__name" title="${esc(match.name)}">${esc(match.name)}</span>
        <span class="suggested-item__firm">${esc(match.firm || "Ecosystem VC")}</span>
        <span class="suggested-item__score">AI Fit: ${match.total_score}/110</span>
      </div>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" style="padding:4px 8px;font-size:.75rem" onclick="quickConnect('${match.id}', this)">Connect</button>
    </div>
  `).join("");

  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:12px">Suggested Investors</h3>
    <div class="suggested-list">
      ${itemsHtml}
    </div>
  `;
}

window.quickConnect = function(investorId, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = "Requested";
  btnEl.className = "sp-btn sp-btn--ghost sp-btn--sm active";
  showToast("Connection interest request dispatched to investor.");
};

// Trending sectors widget
function renderTrendingSectorsCard() {
  const container = document.getElementById("trendingSectorsCard");
  if (!container) return;

  container.className = "sp-card";
  
  const sectors = [
    { name: "AI/ML", growth: "+24.8%" },
    { name: "SaaS", growth: "+18.2%" },
    { name: "FinTech", growth: "+15.6%" },
    { name: "HealthTech", growth: "+12.1%" }
  ];

  const itemsHtml = sectors.map(sec => `
    <div class="trending-item">
      <span class="trending-item__sector">${sec.name}</span>
      <span class="trending-item__growth">${sec.growth}</span>
    </div>
  `).join("");

  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:12px">Trending Sectors</h3>
    <div class="trending-list">
      ${itemsHtml}
    </div>
  `;
}

// Funding readiness score
function renderFundingReadinessCard() {
  const container = document.getElementById("fundingReadinessCard");
  if (!container) return;

  container.className = "sp-card";
  
  const achievementsCount = achievementsData ? achievementsData.length : 0;
  const matchesCount = matchesData ? matchesData.length : 0;
  const readiness = getFundingReadiness(startupProfileData, achievementsCount, matchesCount);

  container.innerHTML = `
    <h3 class="sp-h3">Funding Readiness</h3>
    <p class="sp-sub" style="margin-top:2px">Platform investment index</p>
    <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end">
      <span style="font-size:1.5rem;font-weight:800;color:var(--primary)">${readiness}<span style="font-size:.85rem;font-weight:500;color:var(--text-sec)">/100</span></span>
      <span style="font-size:.75rem;color:var(--text-sec);font-weight:600">Readiness Score</span>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${readiness}%"></div>
      </div>
    </div>
  `;
}

// Profile strength card
function renderProfileStrengthCard() {
  const container = document.getElementById("profileStrengthCard");
  if (!container) return;

  container.className = "sp-card";

  const strength = getProfileStrength(startupProfileData);
  
  let listHtml = "";
  if (strength.missing.length === 0) {
    listHtml = `<p style="font-size:.78rem;color:var(--success);margin-top:12px;font-weight:600">✓ Profile complete! Ready for analyst evaluation.</p>`;
  } else {
    const items = strength.missing.slice(0, 3).map(sect => `<li class="missing-item">${sect}</li>`).join("");
    listHtml = `
      <p style="font-size:.78rem;font-weight:600;margin-top:12px;color:var(--text-sec)">Missing Sections:</p>
      <ul class="missing-list" style="margin-top:0">
        ${items}
        ${strength.missing.length > 3 ? `<li class="missing-item" style="color:var(--text-sec);list-style:none">and ${strength.missing.length - 3} more...</li>` : ''}
      </ul>
    `;
  }

  container.innerHTML = `
    <h3 class="sp-h3">Profile Strength</h3>
    <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end">
      <span style="font-size:1.5rem;font-weight:800;color:var(--success)">${strength.pct}%</span>
      <span style="font-size:.75rem;color:var(--text-sec);font-weight:600">Completion</span>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${strength.pct}%; background-color: var(--success)"></div>
      </div>
    </div>
    ${listHtml}
  `;
}

// Render ActivityFeed list
function renderActivityFeed(feedItems) {
  const container = document.getElementById("activityFeed");
  if (!container) return;

  if (!feedItems || feedItems.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="rss"></i>
        <h3>No activity records found</h3>
        <p>Post achievements or connect with investors to view social activity feed signals.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  container.innerHTML = feedItems.map(item => {
    let badgeClass = "sp-badge--blue";
    let icon = "bell";

    if (item.type === 'AI Match') {
      badgeClass = "sp-badge--green";
      icon = "target";
    } else if (item.type === 'Viewer Alert') {
      badgeClass = "sp-badge--yellow";
      icon = "eye";
    } else if (item.type === 'Proposal') {
      badgeClass = "sp-badge--red";
      icon = "send";
    } else if (item.type === 'Milestone') {
      badgeClass = "sp-badge--blue";
      icon = "award";
    }

    let actionBtnHtml = "";
    if (item.type === 'Milestone') {
      actionBtnHtml = `
        <button class="activity-card__btn" onclick="showToast('Milestone update liked')">
          <i data-feather="thumbs-up"></i><span>Like</span>
        </button>
        <button class="activity-card__btn" onclick="showToast('Milestone update shared')">
          <i data-feather="share-2"></i><span>Share</span>
        </button>
      `;
    } else if (item.type === 'AI Match') {
      actionBtnHtml = `
        <button class="activity-card__btn" onclick="window.location.hash='#matches'">
          <i data-feather="arrow-right"></i><span>View Matches</span>
        </button>
      `;
    } else if (item.type === 'Viewer Alert') {
      actionBtnHtml = `
        <button class="activity-card__btn" onclick="window.location.hash='#viewers'">
          <i data-feather="arrow-right"></i><span>View Traffic</span>
        </button>
      `;
    } else if (item.type === 'Proposal') {
      actionBtnHtml = `
        <button class="activity-card__btn" onclick="window.location.hash='#connections'">
          <i data-feather="arrow-right"></i><span>Evaluate terms</span>
        </button>
      `;
    } else {
      actionBtnHtml = `
        <button class="activity-card__btn" onclick="showToast('Post liked')">
          <i data-feather="thumbs-up"></i><span>Like</span>
        </button>
      `;
    }

    return `
      <div class="activity-card">
        <div class="activity-card__header">
          <div class="activity-card__actor">
            <div class="activity-card__actor-avatar">${getInitials(item.actorName)}</div>
            <div class="activity-card__actor-info">
              <span class="activity-card__actor-name">${esc(item.actorName)}</span>
              <span class="activity-card__time">${esc(item.timeStr)}</span>
            </div>
          </div>
          <div class="activity-card__badge-wrap">
            <span class="sp-badge ${badgeClass}">
              <i data-feather="${icon}" style="width:10px;height:10px;margin-right:2px;vertical-align:middle"></i>${esc(item.type)}
            </span>
          </div>
        </div>
        <div class="activity-card__body">
          <h4 class="activity-card__title">${esc(item.title)}</h4>
          <p class="activity-card__description">${esc(item.description)}</p>
        </div>
        <div class="activity-card__actions">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join("");

  feather.replace();
}

function renderLoadingFeed() {
  const container = document.getElementById("activityFeed");
  if (!container) return;

  container.innerHTML = `
    <div class="activity-card">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="sp-skeleton" style="width:38px;height:38px;border-radius:50%"></div>
        <div style="flex:1">
          <div class="sp-skeleton" style="width:120px;height:12px;margin-bottom:6px"></div>
          <div class="sp-skeleton" style="width:80px;height:10px"></div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="sp-skeleton" style="width:70%;height:14px;margin-bottom:8px"></div>
        <div class="sp-skeleton" style="width:100%;height:12px;margin-bottom:6px"></div>
        <div class="sp-skeleton" style="width:90%;height:12px"></div>
      </div>
    </div>
    <div class="activity-card">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="sp-skeleton" style="width:38px;height:38px;border-radius:50%"></div>
        <div style="flex:1">
          <div class="sp-skeleton" style="width:140px;height:12px;margin-bottom:6px"></div>
          <div class="sp-skeleton" style="width:60px;height:10px"></div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="sp-skeleton" style="width:40%;height:14px;margin-bottom:8px"></div>
        <div class="sp-skeleton" style="width:95%;height:12px"></div>
      </div>
    </div>
  `;
}

function renderErrorFeed(msg) {
  const container = document.getElementById("activityFeed");
  if (!container) return;

  container.innerHTML = `
    <div class="sp-empty" style="border-color:var(--danger)">
      <i data-feather="alert-triangle" style="color:var(--danger)"></i>
      <h3 style="color:var(--danger)">Feed loading failure</h3>
      <p>${esc(msg || "Could not retrieve activity signal feed.")}</p>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" style="margin-top:12px" onclick="renderHome()">Retry</button>
    </div>
  `;
  feather.replace();
}

async function renderHome() {
  const profile = startupProfileData || {};
  const initials = getInitials(profile.name);
  const userDisp = document.getElementById("sidebarUserName");
  if (userDisp) userDisp.textContent = profile.name || "Startup User";
  const avatarDisp = document.getElementById("sidebarAvatar");
  if (avatarDisp) avatarDisp.textContent = initials;
  const feedAvatarDisp = document.getElementById("feedAvatar");
  if (feedAvatarDisp) feedAvatarDisp.textContent = initials;

  renderStartupSummaryCard();
  renderQuickStatsCard();
  renderSuggestedInvestorCard();
  renderTrendingSectorsCard();
  renderFundingReadinessCard();
  renderProfileStrengthCard();
  renderLoadingFeed();

  try {
    const feedItems = [];

    // 1. Achievements (Milestones)
    if (achievementsData) {
      achievementsData.forEach(ach => {
        feedItems.push({
          actorName: profile.name || "Startup Name",
          timeStr: formatDate(ach.date),
          type: "Milestone",
          title: ach.title,
          description: ach.description || `Custom milestone update published under ${ach.type}.`,
          timestamp: new Date(ach.date).getTime()
        });
      });
    }

    // 2. Profile Viewers
    if (viewersData) {
      Object.entries(viewersData).forEach(([investorId, timestamp]) => {
        const investorMatch = matchesData ? matchesData.find(m => m.id === investorId) : null;
        const name = investorMatch ? investorMatch.name : investorId;
        feedItems.push({
          actorName: name,
          timeStr: formatDate(timestamp),
          type: "Viewer Alert",
          title: "Evaluated profile and metrics",
          description: `Investor viewed key metrics and team sizing datasets.`,
          timestamp: Number(timestamp) * 1000
        });
      });
    }

    // 3. Match Engine discovery signals
    if (matchesData) {
      matchesData.slice(0, 5).forEach((match, index) => {
        const delayMs = index * 12 * 3600 * 1000;
        const timestamp = Date.now() - delayMs;
        feedItems.push({
          actorName: "Matching Engine",
          timeStr: "Automatic Match",
          type: "AI Match",
          title: `Compatibility identified with ${match.name}`,
          description: `Calculated high affinity compatibility: total score fit ${match.total_score}/110.`,
          timestamp: timestamp
        });
      });
    }

    // 4. Inbound proposals/connections
    if (connectionsData) {
      connectionsData.forEach((conn, index) => {
        const delayMs = (index + 1) * 24 * 3600 * 1000;
        const timestamp = Date.now() - delayMs;
        feedItems.push({
          actorName: conn.investor_name || "Capital Allocator",
          timeStr: "Request Sent",
          type: "Proposal",
          title: `Capital investment request: ${money(conn.proposed_amount)}`,
          description: `Proposed note: "${conn.message || 'No note attached.'}" · Status: ${conn.status}`,
          timestamp: timestamp
        });
      });
    }

    // Sort by timestamp newest first
    feedItems.sort((a, b) => b.timestamp - a.timestamp);
    renderActivityFeed(feedItems);
  } catch (err) {
    console.error(err);
    renderErrorFeed("Ecosystem API fetch failed.");
  }
}

// ----------------------------------------------------
// COMPONENTS AND PROFILE PAGE RENDERERS
// ----------------------------------------------------

function renderProfileHeader() {
  const container = document.getElementById("profileHeaderContainer");
  if (!container) return;

  const profile = startupProfileData || {};
  const initials = getInitials(profile.name);
  const location = profile.location || "Bengaluru, India";
  const website = profile.website || "https://novalabs.io";
  const stage = profile.stage || "Seed";

  container.className = "sp-profile-hdr";
  container.innerHTML = `
    <div class="sp-profile-hdr__banner"></div>
    <div class="sp-profile-hdr__content">
      <div class="sp-profile-hdr__logo-wrap">${initials}</div>
      <div class="sp-profile-hdr__details">
        <div class="sp-profile-hdr__name-row">
          <h2 class="sp-profile-hdr__name">${esc(profile.name || "Startup Name")}</h2>
          <span class="sp-badge sp-badge--blue">${esc(stage)} Stage</span>
        </div>
        <div class="sp-profile-hdr__sub">
          <span>${esc(profile.sector || "Industry Sector")}</span>
          <div class="sp-profile-hdr__dot"></div>
          <span>${esc(location)}</span>
          <div class="sp-profile-hdr__dot"></div>
          <a href="${esc(website)}" target="_blank" rel="noopener noreferrer" class="sp-profile-hdr__link">
            <i data-feather="link" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px"></i>${esc(website.replace(/^https?:\/\//, ""))}
          </a>
        </div>
      </div>
      <button class="sp-btn sp-btn--primary" id="editProfileBtn">
        <i data-feather="edit-3"></i>Edit Profile
      </button>
    </div>
  `;

  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const modal = document.getElementById("editProfileModal");
      const form = document.getElementById("editProfileForm");
      if (modal && form) {
        form.elements['name'].value = profile.name || "";
        form.elements['website'].value = profile.website || "";
        form.elements['sector'].value = profile.sector || "FinTech";
        form.elements['stage'].value = profile.stage || "Seed";
        form.elements['location'].value = profile.location || "";
        form.elements['founded'].value = profile.founded || 2026;
        form.elements['team_size'].value = profile.team_size || 10;
        form.elements['revenue'].value = profile.revenue || 0;
        form.elements['received_funding'].value = profile.received_funding || 0;
        form.elements['funding_ask'].value = profile.funding_ask || 0;
        form.elements['equity_offered'].value = profile.equity_offered || 0;
        form.elements['pitch'].value = profile.pitch || "";
        modal.classList.add("open");
      }
    });
  }

  feather.replace();
}

function renderAboutSection() {
  const container = document.getElementById("aboutSectionContainer");
  if (!container) return;

  const profile = startupProfileData || {};
  const pitch = profile.pitch || "Provide an elevator pitch detailing the core product scope and execution values.";
  
  const mission = "To accelerate sector progress through innovative data pipelines and scalable infrastructure operations.";
  const problem = "Inefficient discovery pipelines and siloed execution structures within our target sectors.";
  const product = "A high-performance SaaS core engine designed to streamline transaction processing and metric analytics.";

  container.className = "sp-card";
  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:18px">Company Overview</h3>
    
    <div class="sp-about-block">
      <h4 class="sp-about-block__title">About Startup</h4>
      <p class="sp-about-block__text">${esc(pitch)}</p>
    </div>
    
    <div class="sp-about-block">
      <h4 class="sp-about-block__title">Mission</h4>
      <p class="sp-about-block__text">${esc(mission)}</p>
    </div>
    
    <div class="sp-about-block">
      <h4 class="sp-about-block__title">Problem Being Solved</h4>
      <p class="sp-about-block__text">${esc(problem)}</p>
    </div>
    
    <div class="sp-about-block">
      <h4 class="sp-about-block__title">Product Overview</h4>
      <p class="sp-about-block__text">${esc(product)}</p>
    </div>
  `;
}

function renderMetricsSection() {
  const container = document.getElementById("metricsSectionContainer");
  if (!container) return;

  const profile = startupProfileData || {};

  container.className = "sp-card";
  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:16px">Traction & Funding Details</h3>
    <div class="sp-metrics-grid">
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">ARR Revenue</span>
        <span class="sp-metric-box__value">${money(profile.revenue)}</span>
      </div>
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">Funding Ask</span>
        <span class="sp-metric-box__value">${money(profile.funding_ask)}</span>
      </div>
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">Capital Raised</span>
        <span class="sp-metric-box__value">${money(profile.received_funding)}</span>
      </div>
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">Equity Offered</span>
        <span class="sp-metric-box__value">${profile.equity_offered || 0}%</span>
      </div>
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">Team Size</span>
        <span class="sp-metric-box__value">${profile.team_size || 0} Members</span>
      </div>
      <div class="sp-metric-box">
        <span class="sp-metric-box__label">Founded</span>
        <span class="sp-metric-box__value">${profile.founded || "N/A"}</span>
      </div>
    </div>
  `;
}

function renderAchievementPreview() {
  const container = document.getElementById("achievementPreviewContainer");
  if (!container) return;

  container.className = "sp-card";
  
  if (!achievementsData || achievementsData.length === 0) {
    container.innerHTML = `
      <h3 class="sp-h3" style="margin-bottom:14px">Recent Achievements</h3>
      <div class="sp-empty" style="padding:24px">
        <i data-feather="award"></i>
        <h3>No achievements recorded</h3>
        <p>Post milestones to showcase traction timeline previews.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  const topAchievements = [...achievementsData]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const listHtml = topAchievements.map(ach => {
    let icon = "award";
    if (ach.type === "revenue") icon = "trending-up";
    if (ach.type === "funding") icon = "dollar-sign";
    if (ach.type === "partnership") icon = "briefcase";
    if (ach.type === "product" || ach.type === "launch") icon = "cpu";
    if (ach.type === "users") icon = "users";
    if (ach.type === "hiring") icon = "user-plus";

    return `
      <div class="sp-timeline-preview__item">
        <div class="sp-timeline-preview__icon"><i data-feather="${icon}"></i></div>
        <div class="sp-timeline-preview__info">
          <h4 class="sp-timeline-preview__title">${esc(ach.title)}</h4>
          <p class="sp-timeline-preview__desc">${esc(ach.description)}</p>
          <div class="sp-timeline-preview__date">${formatDate(ach.date)} · <span style="text-transform: capitalize; font-weight:600">${ach.type}</span></div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 class="sp-h3">Recent Achievements</h3>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" onclick="window.location.hash='#milestones'">View All</button>
    </div>
    <div class="sp-timeline-preview">
      ${listHtml}
    </div>
  `;
  feather.replace();
}

function renderInvestorInterestCard() {
  const container = document.getElementById("investorInterestCardContainer");
  if (!container) return;

  container.className = "sp-card";
  
  const viewsCount = Object.keys(viewersData || {}).length;
  const achievementsCount = achievementsData ? achievementsData.length : 0;
  const matchesCount = matchesData ? matchesData.length : 0;
  const score = Math.min(50 + (viewsCount * 5) + (achievementsCount * 8) + (matchesCount * 3), 99);

  container.innerHTML = `
    <h3 class="sp-h3">Investor Interest</h3>
    <p class="sp-sub" style="margin-top:2px">Platform affinity gauge</p>
    <div style="text-align:center;padding:16px 0 8px">
      <div style="font-size:3.2rem;font-weight:900;color:var(--primary);line-height:1">${score}</div>
      <div class="sp-badge sp-badge--green" style="margin-top:8px">High Ecosystem Traction</div>
      <p style="font-size:.78rem;color:var(--text-sec);line-height:1.4;margin-top:14px;padding:0 8px">
        Calculated dynamically based on viewer telemetry, sector matching compatibility, and milestone execution rate.
      </p>
    </div>
  `;
}

function renderProfileCompletionCard() {
  const container = document.getElementById("profileCompletionCardContainer");
  if (!container) return;

  const strength = getProfileStrength(startupProfileData);

  container.className = "sp-card";
  
  let checklistHtml = "";
  if (strength.missing.length === 0) {
    checklistHtml = `<div style="font-size:.78rem;color:var(--success);font-weight:600;margin-top:14px">✓ Profile details complete!</div>`;
  } else {
    const listItems = strength.missing.slice(0, 3).map(f => `<li class="missing-item">${f}</li>`).join("");
    checklistHtml = `
      <div style="font-size:.78rem;font-weight:600;color:var(--text-sec);margin-top:14px;margin-bottom:6px">Missing Areas:</div>
      <ul class="missing-list" style="margin-top:0">
        ${listItems}
        ${strength.missing.length > 3 ? `<li class="missing-item" style="color:var(--text-sec);list-style:none">and ${strength.missing.length - 3} more...</li>` : ""}
      </ul>
    `;
  }

  container.innerHTML = `
    <h3 class="sp-h3">Profile Strength</h3>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px">
      <span style="font-size:1.4rem;font-weight:800;color:var(--success)">${strength.pct}%</span>
      <span style="font-size:.75rem;color:var(--text-sec);font-weight:500">Completion Index</span>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${strength.pct}%;background-color:var(--success)"></div>
      </div>
    </div>
    ${checklistHtml}
  `;
}

function renderRecentViewers() {
  const container = document.getElementById("recentViewersContainer");
  if (!container) return;

  container.className = "sp-card";

  const viewersArr = Object.entries(viewersData || {});
  if (viewersArr.length === 0) {
    container.innerHTML = `
      <h3 class="sp-h3" style="margin-bottom:12px">Recent Viewers</h3>
      <p class="sp-sub">No recent profile views registered.</p>
    `;
    return;
  }

  const sortedViewers = viewersArr
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3);

  const itemsHtml = sortedViewers.map(([investorId, timestamp]) => {
    const matchObj = matchesData ? matchesData.find(m => m.id === investorId) : null;
    const name = matchObj ? matchObj.name : investorId;
    const firm = matchObj ? matchObj.firm : "Ecosystem Allocator";

    return `
      <div class="suggested-item">
        <div class="suggested-item__avatar">${getInitials(name)}</div>
        <div class="suggested-item__info">
          <span class="suggested-item__name" title="${esc(name)}">${esc(name)}</span>
          <span class="suggested-item__firm">${esc(firm)}</span>
          <span class="sp-sub" style="font-size:.68rem;margin-top:1px">${formatDate(timestamp)}</span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:12px">Recent Viewers</h3>
    <div class="suggested-list">
      ${itemsHtml}
    </div>
  `;
}

function renderQuickActions() {
  const container = document.getElementById("quickActionsContainer");
  if (!container) return;

  container.className = "sp-card";
  container.innerHTML = `
    <h3 class="sp-h3" style="margin-bottom:14px">Quick Actions</h3>
    <div class="sp-actions-list">
      <button class="sp-btn sp-btn--primary sp-btn--sm" style="width:100%" id="quickActionsAddMilestoneBtn">
        <i data-feather="plus"></i>Add Milestone
      </button>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" style="width:100%" onclick="window.location.hash='#matches'">
        <i data-feather="target"></i>View Match Engine
      </button>
      <button class="sp-btn sp-btn--ghost sp-btn--sm" style="width:100%" onclick="showToast('Profile link copied to clipboard')">
        <i data-feather="share-2"></i>Share Profile
      </button>
    </div>
  `;

  const addBtn = document.getElementById("quickActionsAddMilestoneBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const modal = document.getElementById("milestoneModal");
      if (modal) modal.classList.add("open");
    });
  }

  feather.replace();
}

function renderProfile() {
  renderProfileHeader();
  renderAboutSection();
  renderMetricsSection();
  renderAchievementPreview();
  renderInvestorInterestCard();
  renderProfileCompletionCard();
  renderRecentViewers();
  renderQuickActions();
}

// ----------------------------------------------------
// MILESTONE TIMELINE & MODALS HANDLERS
// ----------------------------------------------------

function initModals() {
  const milestoneModal = document.getElementById("milestoneModal");
  const postBtn = document.getElementById("feedPostBtn");
  const closeBtn = document.getElementById("closeMilestoneModal");
  const cancelBtn = document.getElementById("cancelMilestoneModal");

  const openMilestone = () => {
    if (milestoneModal) milestoneModal.classList.add("open");
  };
  const closeMilestone = () => {
    if (milestoneModal) milestoneModal.classList.remove("open");
  };

  if (postBtn) postBtn.addEventListener("click", openMilestone);
  if (closeBtn) closeBtn.addEventListener("click", closeMilestone);
  if (cancelBtn) cancelBtn.addEventListener("click", closeMilestone);

  const editModal = document.getElementById("editProfileModal");
  const closeEditBtn = document.getElementById("closeEditProfileModal");
  const cancelEditBtn = document.getElementById("cancelEditProfileModal");
  
  const closeEdit = () => {
    if (editModal) editModal.classList.remove("open");
  };

  if (closeEditBtn) closeEditBtn.addEventListener("click", closeEdit);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEdit);
}

// Initialize startup page payload
async function initStartupPage() {
  const current = requireAuth("STARTUP");
  if (!current) return;

  initTheme();
  initSidebarMobileToggle();
  initModals();

  const logoutBtn = document.getElementById("logoutButton");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const refreshBtn = document.getElementById("refreshWorkspaceButton");
  if (refreshBtn) refreshBtn.addEventListener("click", () => window.location.reload());

  // Form submits handlers
  const form = document.getElementById("achievementForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
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
        const milestoneModal = document.getElementById("milestoneModal");
        if (milestoneModal) milestoneModal.classList.remove("open");
        showToast("Milestone successfully posted to workspace!");

        // Refetch achievements and refresh Home Feed
        try {
          const achievements = await apiCall("GET", `/startups/${current.userId}/achievements`);
          if (achievements) achievementsData = achievements.items || [];
        } catch (err) {
          console.error("Failed to reload achievements:", err);
        }
        
        renderHome();
        renderMilestonesPage();
        renderProfile();
      } catch (err) {
        showToast(err.detail || "Could not publish milestone to platform.", "error");
      }
    });
  }

  const editProfileForm = document.getElementById("editProfileForm");
  if (editProfileForm) {
    editProfileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const updatedData = {
        name: editProfileForm.elements['name'].value,
        website: editProfileForm.elements['website'].value,
        sector: editProfileForm.elements['sector'].value,
        stage: editProfileForm.elements['stage'].value,
        location: editProfileForm.elements['location'].value,
        founded: Number(editProfileForm.elements['founded'].value),
        team_size: Number(editProfileForm.elements['team_size'].value),
        revenue: Number(editProfileForm.elements['revenue'].value),
        received_funding: Number(editProfileForm.elements['received_funding'].value),
        funding_ask: Number(editProfileForm.elements['funding_ask'].value),
        equity_offered: Number(editProfileForm.elements['equity_offered'].value),
        pitch: editProfileForm.elements['pitch'].value
      };

      localStorage.setItem(`profile_override:${current.userId}`, JSON.stringify(updatedData));
      startupProfileData = { ...startupProfileData, ...updatedData };
      
      const editModal = document.getElementById("editProfileModal");
      if (editModal) editModal.classList.remove("open");
      showToast("Company profile successfully updated.");

      renderHome();
      renderProfile();
    });
  }

  await loadHealth();

  // Load profile with absolute fail safety (logout & redirect to login on 404 or bad ID)
  try {
    const profile = await apiCall("GET", `/startups/${current.userId}`);
    if (profile && profile.item) {
      startupProfileData = profile.item;
      const override = localStorage.getItem(`profile_override:${current.userId}`);
      if (override) {
        startupProfileData = { ...startupProfileData, ...JSON.parse(override) };
      }
    } else {
      throw new Error("Startup profile not found or empty");
    }
  } catch (err) {
    console.error("Initial startup profile load failed, logging out stale session:", err);
    clearSession();
    window.location.href = "/login";
    return;
  }

  // Load secondary indicators with individual fallback handlers
  try {
    const achievements = await apiCall("GET", `/startups/${current.userId}/achievements`);
    achievementsData = achievements ? (achievements.items || []) : [];
  } catch (err) {
    console.error("Failed to load achievements:", err);
    achievementsData = [];
  }

  try {
    const viewers = await apiCall("GET", `/startups/${current.userId}/viewers`);
    viewersData = viewers ? (viewers.viewers || {}) : {};
  } catch (err) {
    console.error("Failed to load viewers:", err);
    viewersData = {};
  }

  try {
    const connections = await apiCall("GET", `/connections/${current.userId}`);
    connectionsData = connections ? (connections.items || []) : [];
  } catch (err) {
    console.error("Failed to load connections:", err);
    connectionsData = [];
  }

  try {
    const matches = await apiCall("GET", `/startups/${current.userId}/matches`);
    matchesData = matches ? (matches.matches || []) : [];
  } catch (err) {
    console.error("Failed to load matches:", err);
    matchesData = [];
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

let selectedMilestoneCategory = "all";
let activeCrmTab = "inbound";

function renderMilestonesPage() {
  // 1. Render Category Filter buttons
  const filtersContainer = document.getElementById("milestoneFiltersContainer");
  if (filtersContainer) {
    const categories = ["all", "revenue", "funding", "users", "launch", "award", "partnership", "hiring"];
    filtersContainer.innerHTML = categories.map(cat => {
      const active = selectedMilestoneCategory === cat;
      const label = cat === "all" ? "All Milestones" : cat.charAt(0).toUpperCase() + cat.slice(1);
      return `<button class="sp-btn ${active ? 'sp-btn--primary' : 'sp-btn--ghost'} sp-btn--sm" data-category="${cat}">${label}</button>`;
    }).join("");

    // Attach click handlers to filters
    filtersContainer.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedMilestoneCategory = btn.getAttribute("data-category");
        renderMilestonesPage();
      });
    });
  }

  // 2. Render Timeline Container
  const timelineContainer = document.getElementById("milestonesTimelineContainer");
  if (!timelineContainer) return;

  // Filter achievements
  let items = achievementsData || [];
  if (selectedMilestoneCategory !== "all") {
    items = items.filter(a => (a.type || "").toLowerCase() === selectedMilestoneCategory);
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (items.length === 0) {
    timelineContainer.innerHTML = `
      <div class="sp-empty">
        <i data-feather="award" style="width:48px;height:48px;color:var(--border);margin-bottom:14px"></i>
        <h3>No Milestones Found</h3>
        <p class="sp-sub" style="margin-bottom:16px">Share your company's progress (funding, hires, launches) with investors.</p>
        <button class="sp-btn sp-btn--primary sp-btn--sm" id="emptyStateAddMilestoneBtn">Post First Milestone</button>
      </div>
    `;
    const addBtn = document.getElementById("emptyStateAddMilestoneBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const modal = document.getElementById("milestoneModal");
        if (modal) modal.classList.add("open");
      });
    }
    feather.replace();
    return;
  }

  timelineContainer.innerHTML = `
    <div class="timeline-container">
      ${items.map(item => {
        const categoryLabel = (item.type || "Milestone").toUpperCase();
        const dateStr = item.date ? new Date(item.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A";
        const valStr = item.value ? `<div class="timeline-card__value-badge">${money(item.value)}</div>` : "";
        
        return `
          <div class="timeline-card-wrapper">
            <div class="timeline-dot"></div>
            <div class="timeline-card">
              <div class="timeline-card__header">
                <div>
                  <span class="sp-badge sp-badge--blue" style="margin-bottom:6px">${esc(categoryLabel)}</span>
                  <h3 class="timeline-card__title">${esc(item.title)}</h3>
                  <div class="timeline-card__meta">
                    <i data-feather="calendar" style="width:13px;height:13px"></i>
                    <span>${esc(dateStr)}</span>
                  </div>
                </div>
                ${valStr}
              </div>
              <p class="timeline-card__desc" style="margin-top:10px">${esc(item.description)}</p>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  const milestonePageAddBtn = document.getElementById("milestonePageAddBtn");
  if (milestonePageAddBtn) {
    milestonePageAddBtn.onclick = () => {
      const modal = document.getElementById("milestoneModal");
      if (modal) modal.classList.add("open");
    };
  }

  feather.replace();
}

async function renderMatchesPage() {
  const container = document.getElementById("matchesListContainer");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px">
      <div class="sp-card sp-skeleton" style="height:120px"></div>
      <div class="sp-card sp-skeleton" style="height:120px"></div>
    </div>
  `;

  try {
    const current = session();
    const res = await apiCall("GET", `/startups/${current.userId}/matches`);
    const rawMatches = res ? (res.matches || []) : [];
    matchesData = rawMatches;
    
    applyMatchesFiltersAndRender();
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="alert-circle" style="width:48px;height:48px;color:var(--danger);margin-bottom:14px"></i>
        <h3>Failed to load investor matches</h3>
        <p class="sp-sub">Please refresh or check your API connection.</p>
      </div>
    `;
    feather.replace();
  }
}

function applyMatchesFiltersAndRender() {
  const container = document.getElementById("matchesListContainer");
  if (!container) return;

  const searchInput = document.getElementById("matchesSearchInput");
  const sectorFilter = document.getElementById("matchesSectorFilter");
  const minScoreInput = document.getElementById("matchesMinScore");
  const minScoreVal = document.getElementById("matchesMinScoreVal");
  const sortSelect = document.getElementById("matchesSort");

  const query = (searchInput ? searchInput.value : "").toLowerCase();
  const sector = sectorFilter ? sectorFilter.value : "all";
  const minScore = minScoreInput ? Number(minScoreInput.value) : 50;
  const sortBy = sortSelect ? sortSelect.value : "score";

  if (minScoreVal && minScoreInput) {
    minScoreVal.textContent = minScoreInput.value;
  }

  // Set up filter input event listeners once
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", applyMatchesFiltersAndRender);
  }
  if (sectorFilter && !sectorFilter.dataset.bound) {
    sectorFilter.dataset.bound = "true";
    sectorFilter.addEventListener("change", applyMatchesFiltersAndRender);
  }
  if (minScoreInput && !minScoreInput.dataset.bound) {
    minScoreInput.dataset.bound = "true";
    minScoreInput.addEventListener("input", applyMatchesFiltersAndRender);
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.dataset.bound = "true";
    sortSelect.addEventListener("change", applyMatchesFiltersAndRender);
  }

  // Filter matches
  let items = matchesData || [];
  items = items.filter(m => {
    const nameMatch = (m.name || "").toLowerCase().includes(query) || (m.firm || "").toLowerCase().includes(query);
    const sectorMatch = sector === "all" || (m.preferred_sectors || []).includes(sector) || (m.preferred_sectors || []).some(s => s.toLowerCase() === sector.toLowerCase());
    const scoreMatch = (m.total_score || 0) >= minScore;
    return nameMatch && sectorMatch && scoreMatch;
  });

  // Sort matches
  if (sortBy === "score") {
    items.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
  } else if (sortBy === "name") {
    items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sortBy === "ticket") {
    items.sort((a, b) => (b.ticket_score || 0) - (a.ticket_score || 0));
  }

  const countText = document.getElementById("matchesCountText");
  if (countText) {
    countText.textContent = `${items.length} compatible matches found`;
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="target" style="width:48px;height:48px;color:var(--border);margin-bottom:14px"></i>
        <h3>No matches match filters</h3>
        <p class="sp-sub">Try loosening your search query or minimum score threshold.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  container.innerHTML = items.map(item => {
    const score = item.total_score || 0;
    
    // Breakdown calculations
    const sectorPercent = Math.round(((item.sector_score || 0) / 40) * 100);
    const ticketPercent = Math.round(((item.ticket_score || 0) / 30) * 100);
    const stagePercent = Math.round(((item.stage_score || 0) / 20) * 100);
    const networkPercent = Math.round(((item.network_score || 0) / 10) * 100);

    // Connect status check
    const existingConn = (connectionsData || []).find(c => c.investor_id === item.id);
    let connectBtnHtml = "";
    if (existingConn) {
      if (existingConn.status === "accepted") {
        connectBtnHtml = `<button class="sp-btn sp-btn--ghost sp-btn--sm crm-message-btn" data-investor-id="${item.id}" data-investor-name="${esc(item.name)}"><i data-feather="message-square" style="width:14px;height:14px;margin-right:4px"></i>Message</button>`;
      } else if (existingConn.status === "pending") {
        connectBtnHtml = `<button class="sp-btn sp-btn--ghost sp-btn--sm" disabled>Pending Inbound</button>`;
      } else {
        connectBtnHtml = `<button class="sp-btn sp-btn--primary sp-btn--sm" disabled>${existingConn.status.toUpperCase()}</button>`;
      }
    } else {
      const localSent = localStorage.getItem(`connect_sent:${item.id}`);
      if (localSent) {
        connectBtnHtml = `<button class="sp-btn sp-btn--ghost sp-btn--sm" disabled>Pending Outbound</button>`;
      } else {
        connectBtnHtml = `<button class="sp-btn sp-btn--primary sp-btn--sm connect-action-btn" data-investor-id="${item.id}" data-investor-name="${esc(item.name)}">Connect</button>`;
      }
    }

    const isSaved = localStorage.getItem(`saved_investor:${item.id}`) === "true";
    const saveBtnHtml = `<button class="sp-btn sp-btn--ghost sp-btn--sm save-action-btn" data-investor-id="${item.id}">${isSaved ? "Saved" : "Save"}</button>`;

    return `
      <div class="match-card">
        <div class="match-card__score-section">
          <div class="match-score-badge">
            ${score}
            <span>Fit Score</span>
          </div>
          <div style="font-size:.7rem; color:var(--text-sec); font-weight:600; margin-top:8px; text-align:center">
            Target Fit: ${score}/110
          </div>
        </div>
        <div class="match-card__main">
          <div class="match-card__info">
            <div>
              <h3 class="match-card__title">${esc(item.name)}</h3>
              <div class="match-card__subtitle">${esc(item.firm || "Ecosystem Fund")} · ${esc(item.type || "Angel")}</div>
              <div class="match-card__tags">
                <span class="sp-badge sp-badge--blue">${esc((item.preferred_sectors || ["AI/ML"]).join(", "))}</span>
              </div>
            </div>
          </div>

          <div class="match-breakdown">
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Sector Compatibility</span>
                <span>${sectorPercent}%</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width: ${sectorPercent}%; background: var(--primary)"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Funding Ticket Fit</span>
                <span>${ticketPercent}%</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width: ${ticketPercent}%; background: #10b981"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Stage Match</span>
                <span>${stagePercent}%</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width: ${stagePercent}%; background: #f59e0b"></div>
              </div>
            </div>
            <div class="match-breakdown__item">
              <div class="match-breakdown__label-row">
                <span>Network Overlap</span>
                <span>${networkPercent}%</span>
              </div>
              <div class="match-breakdown__bar">
                <div class="match-breakdown__fill" style="width: ${networkPercent}%; background: #8b5cf6"></div>
              </div>
            </div>
          </div>

          <div class="match-card__actions">
            ${connectBtnHtml}
            ${saveBtnHtml}
            <button class="sp-btn sp-btn--ghost sp-btn--sm view-profile-action" data-investor-id="${item.id}" data-investor-name="${esc(item.name)}" data-firm="${esc(item.firm)}" data-bio="${esc(item.bio || 'Backs applied AI founders')}">View Profile</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".connect-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const invId = btn.getAttribute("data-investor-id");
      const invName = btn.getAttribute("data-investor-name");
      localStorage.setItem(`connect_sent:${invId}`, "true");
      showToast(`Connection request sent to ${invName}!`);
      applyMatchesFiltersAndRender();
    });
  });

  container.querySelectorAll(".save-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const invId = btn.getAttribute("data-investor-id");
      const wasSaved = localStorage.getItem(`saved_investor:${invId}`) === "true";
      localStorage.setItem(`saved_investor:${invId}`, wasSaved ? "false" : "true");
      showToast(wasSaved ? "Investor removed from saved shortlist." : "Investor added to saved shortlist!");
      applyMatchesFiltersAndRender();
    });
  });

  container.querySelectorAll(".view-profile-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-investor-name");
      const firm = btn.getAttribute("data-firm");
      const bio = btn.getAttribute("data-bio");
      alert(`Investor Profile:\n\nName: ${name}\nFirm: ${firm}\nBio: ${bio}`);
    });
  });

  container.querySelectorAll(".crm-message-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-investor-name");
      const msg = prompt(`Send a secure workspace message to ${name}:`);
      if (msg) {
        showToast(`Message securely sent to ${name}!`);
      }
    });
  });

  feather.replace();
}

function renderViewersPage() {
  const container = document.getElementById("profileViewersListContainer");
  if (!container) return;

  const viewersArr = Object.entries(viewersData || {});
  if (viewersArr.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <i data-feather="eye" style="width:48px;height:48px;color:var(--border);margin-bottom:14px"></i>
        <h3>No Profile Views Yet</h3>
        <p class="sp-sub">Your profile activity will appear here when allocators inspect your listing.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  const sortedViewers = viewersArr.sort((a, b) => Number(b[1]) - Number(a[1]));

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px">
      ${sortedViewers.map(([investorId, timestamp]) => {
        const matchObj = matchesData ? matchesData.find(m => m.id === investorId) : null;
        const name = matchObj ? matchObj.name : "Ecosystem Allocator";
        const firm = matchObj ? matchObj.firm : "Venture Capital / Angel";
        const type = matchObj ? matchObj.type : "Investor";
        const matchScore = matchObj ? matchObj.total_score : null;
        
        const dateStr = formatDate(timestamp);
        
        let scoreBadge = "";
        if (matchScore !== null) {
          scoreBadge = `<span class="sp-badge sp-badge--green" style="margin-left:auto">${matchScore}/110 Match Score</span>`;
        }

        return `
          <div class="sp-card" style="display:flex; align-items:center; gap:16px; padding:16px 20px">
            <div class="suggested-item__avatar" style="width:48px; height:48px; border-radius:50%; font-size:1.1rem">${getInitials(name)}</div>
            <div style="flex:1">
              <h4 class="sp-h3" style="margin:0">${esc(name)}</h4>
              <p class="sp-sub" style="margin-top:2px">${esc(firm)} · ${esc(type)}</p>
              <div style="display:flex; align-items:center; gap:8px; margin-top:6px; font-size:.78rem; color:var(--text-sec)">
                <i data-feather="clock" style="width:12px; height:12px"></i>
                <span>Viewed ${esc(dateStr)}</span>
              </div>
            </div>
            ${scoreBadge}
            <button class="sp-btn sp-btn--ghost sp-btn--sm view-viewer-profile" data-investor-id="${investorId}">View Fit</button>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.querySelectorAll(".view-viewer-profile").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.hash = "#matches";
    });
  });

  feather.replace();
}

function renderConnectionsPage() {
  const container = document.getElementById("connectionsCrmContainer");
  if (!container) return;

  const tabsContainer = document.getElementById("crmTabsContainer");
  if (tabsContainer && !tabsContainer.dataset.bound) {
    tabsContainer.dataset.bound = "true";
    tabsContainer.querySelectorAll(".crm-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        activeCrmTab = tab.getAttribute("data-tab");
        renderConnectionsPage();
      });
    });
  }

  const inboundList = (connectionsData || []).filter(c => c.status === "pending" || c.status === "rejected");
  const acceptedList = (connectionsData || []).filter(c => c.status === "accepted");

  const outboundList = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("connect_sent:")) {
      const investorId = key.substring(13);
      if (localStorage.getItem(key) === "true") {
        const matchObj = matchesData ? matchesData.find(m => m.id === investorId) : null;
        outboundList.push({
          investor_id: investorId,
          investor_name: matchObj ? matchObj.name : "Ecosystem Allocator",
          firm: matchObj ? matchObj.firm : "Venture Capital",
          status: "pending"
        });
      }
    }
  }

  let listToRender = [];
  if (activeCrmTab === "inbound") {
    listToRender = inboundList;
  } else if (activeCrmTab === "outbound") {
    listToRender = outboundList;
  } else {
    listToRender = acceptedList;
  }

  if (listToRender.length === 0) {
    container.innerHTML = `
      <div class="sp-empty" style="border:none; padding:36px 0">
        <i data-feather="users" style="width:48px;height:48px;color:var(--border);margin-bottom:14px"></i>
        <h3>No ${activeCrmTab.charAt(0).toUpperCase() + activeCrmTab.slice(1)} Proposals</h3>
        <p class="sp-sub">Manage your active investor connections and deal proposals.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  if (activeCrmTab === "inbound") {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px">
        ${listToRender.map(item => {
          const isPending = item.status === "pending";
          const statusBadge = isPending 
            ? `<span class="sp-badge sp-badge--yellow">PENDING INBOUND</span>`
            : `<span class="sp-badge sp-badge--red">REJECTED</span>`;
          
          const actionButtons = isPending 
            ? `
              <div style="display:flex; gap:8px">
                <button class="sp-btn sp-btn--primary sp-btn--sm crm-accept-btn" data-investor-id="${item.investor_id}">Accept</button>
                <button class="sp-btn sp-btn--danger sp-btn--sm crm-reject-btn" data-investor-id="${item.investor_id}">Decline</button>
              </div>
            `
            : ``;

          return `
            <div class="sp-card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
              <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                  <h4 class="sp-h3" style="margin:0">${esc(item.investor_name)}</h4>
                  <div style="margin-top:4px">${statusBadge}</div>
                </div>
                ${actionButtons}
              </div>
              <div style="background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:12px 14px; font-size:.88rem">
                <div style="font-weight:700; color:var(--text-sec); margin-bottom:4px; font-size:.75rem; text-transform:uppercase">Proposal Message:</div>
                <div class="sp-about-block__text">"${esc(item.message || "No pitch message attached.")}"</div>
                ${item.proposed_amount ? `<div style="font-weight:700; margin-top:8px; color:var(--primary)">Proposed Ticket: ${money(item.proposed_amount)}</div>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (activeCrmTab === "outbound") {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px">
        ${listToRender.map(item => {
          return `
            <div class="sp-card" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <h4 class="sp-h3" style="margin:0">${esc(item.investor_name)}</h4>
                <p class="sp-sub" style="margin-top:2px">${esc(item.firm)}</p>
              </div>
              <div style="display:flex; align-items:center; gap:12px">
                <span class="sp-badge sp-badge--yellow">PENDING OUTBOUND</span>
                <button class="sp-btn sp-btn--ghost sp-btn--sm crm-cancel-outbound" data-investor-id="${item.investor_id}">Cancel</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px">
        ${listToRender.map(item => {
          return `
            <div class="sp-card" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <h4 class="sp-h3" style="margin:0">${esc(item.investor_name)}</h4>
                <p class="sp-sub" style="margin-top:2px">Directly connected to startup ecosystem</p>
              </div>
              <div style="display:flex; gap:8px">
                <span class="sp-badge sp-badge--green" style="align-self:center; margin-right:8px">CONNECTED</span>
                <button class="sp-btn sp-btn--primary sp-btn--sm crm-direct-message-btn" data-investor-name="${esc(item.investor_name)}">Send Message</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  container.querySelectorAll(".crm-accept-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const invId = btn.getAttribute("data-investor-id");
      try {
        const current = session();
        await apiCall("POST", "/connect/accept", {
          startup_id: current.userId,
          investor_id: invId
        });
        showToast("Connection accepted! You are now connected.");
        const connections = await apiCall("GET", `/connections/${current.userId}`);
        connectionsData = connections ? (connections.items || []) : [];
        renderConnectionsPage();
      } catch (err) {
        showToast("Failed to accept connection.", "error");
      }
    });
  });

  container.querySelectorAll(".crm-reject-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const invId = btn.getAttribute("data-investor-id");
      try {
        const current = session();
        await apiCall("POST", "/connect/reject", {
          startup_id: current.userId,
          investor_id: invId
        });
        showToast("Connection rejected.");
        const connections = await apiCall("GET", `/connections/${current.userId}`);
        connectionsData = connections ? (connections.items || []) : [];
        renderConnectionsPage();
      } catch (err) {
        showToast("Failed to reject connection.", "error");
      }
    });
  });

  container.querySelectorAll(".crm-cancel-outbound").forEach(btn => {
    btn.addEventListener("click", () => {
      const invId = btn.getAttribute("data-investor-id");
      localStorage.removeItem(`connect_sent:${invId}`);
      showToast("Outbound connection request cancelled.");
      renderConnectionsPage();
    });
  });

  container.querySelectorAll(".crm-direct-message-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-investor-name");
      const msg = prompt(`Send a secure message to ${name}:`);
      if (msg) {
        showToast(`Message sent to ${name}!`);
      }
    });
  });

  feather.replace();
}

function renderAnalyticsPage() {
  const tractionContainer = document.getElementById("analyticsTractionContainer");
  const visitorsContainer = document.getElementById("analyticsVisitorsContainer");
  if (!tractionContainer || !visitorsContainer) return;

  const profile = startupProfileData || {};
  const revenue = profile.revenue || 0;
  const fundingAsk = profile.funding_ask || 0;
  const receivedFunding = profile.received_funding || 0;

  const maxVal = Math.max(revenue, fundingAsk, receivedFunding, 100000);
  const revPct = Math.round((revenue / maxVal) * 100);
  const askPct = Math.round((fundingAsk / maxVal) * 100);
  const recPct = Math.round((receivedFunding / maxVal) * 100);

  tractionContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px; padding:10px 0">
      <div>
        <div style="display:flex; justify-content:space-between; font-size:.82rem; font-weight:700; margin-bottom:6px">
          <span>ARR Revenue</span>
          <span>${money(revenue)}</span>
        </div>
        <div class="progress-bar-wrap" style="height:12px; background:var(--bg)">
          <div class="progress-bar-fill" style="width:${revPct}%; background:var(--primary)"></div>
        </div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; font-size:.82rem; font-weight:700; margin-bottom:6px">
          <span>Funding Ask</span>
          <span>${money(fundingAsk)}</span>
        </div>
        <div class="progress-bar-wrap" style="height:12px; background:var(--bg)">
          <div class="progress-bar-fill" style="width:${askPct}%; background:#f59e0b"></div>
        </div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; font-size:.82rem; font-weight:700; margin-bottom:6px">
          <span>Capital Raised</span>
          <span>${money(receivedFunding)}</span>
        </div>
        <div class="progress-bar-wrap" style="height:12px; background:var(--bg)">
          <div class="progress-bar-fill" style="width:${recPct}%; background:#10b981"></div>
        </div>
      </div>
    </div>
  `;

  const viewsCount = Object.keys(viewersData || {}).length;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const baseline = Math.max(viewsCount, 2);
  const mockVisits = [
    Math.round(baseline * 0.4),
    Math.round(baseline * 0.7),
    Math.round(baseline * 1.2),
    Math.round(baseline * 0.9),
    baseline,
    Math.round(baseline * 0.3),
    Math.round(baseline * 0.5)
  ];
  const maxVisits = Math.max(...mockVisits, 1);

  visitorsContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; height:160px; padding:20px 10px 10px; border-bottom:1px solid var(--border)">
      ${days.map((day, idx) => {
        const heightPct = Math.round((mockVisits[idx] / maxVisits) * 100);
        return `
          <div style="display:flex; flex-direction:column; align-items:center; flex:1">
            <div style="font-size:.7rem; font-weight:700; color:var(--text-sec); margin-bottom:4px">${mockVisits[idx]}</div>
            <div style="width:24px; height:${heightPct}px; background:var(--primary-lt); border-radius:4px; border-bottom-left-radius:0; border-bottom-right-radius:0; transition:height .3s"></div>
            <div style="font-size:.72rem; font-weight:600; color:var(--text-sec); margin-top:8px">${day}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderSettingsPage() {
  const form = document.getElementById("settingsForm");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast("Workspace configuration successfully saved!");
    });
  }
}

