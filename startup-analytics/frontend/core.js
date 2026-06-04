const API_BASE = "";
const SECTORS = ["FinTech", "HealthTech", "EdTech", "CleanTech", "SaaS", "AI/ML", "E-commerce", "BioTech"];
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B"];
const appState = { sectorChart: null };
const THEME_KEY = "workspaceTheme";

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function showToast(message, type = "success") {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function session() {
  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("userRole"),
    name: localStorage.getItem("userName"),
    userId: localStorage.getItem("userId"),
  };
}

function storeSession(response) {
  localStorage.setItem("token", response.token);
  localStorage.setItem("userRole", response.role);
  localStorage.setItem("userName", response.name);
  localStorage.setItem("userId", response.id);
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  localStorage.removeItem("userId");
}

function currentTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function applyTheme(theme = "light") {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem(THEME_KEY, resolved);
  const button = document.getElementById("themeToggleButton");
  if (button) {
    button.textContent = resolved === "dark" ? "Switch to Light" : "Switch to Dark";
    button.setAttribute("aria-label", resolved === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
}

function initThemeToggle() {
  applyTheme(currentTheme());
  const button = document.getElementById("themeToggleButton");
  if (!button) return;
  button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });
}

function workspacePath(role) {
  if (role === "STARTUP") return "/startup";
  if (role === "INVESTOR") return "/investor";
  return "/analyst";
}

function redirectToWorkspace(role) {
  window.location.href = workspacePath(role);
}

function requireAuth(expectedRole) {
  const current = session();
  if (!current.token || !current.role || !current.userId) {
    window.location.href = "/login";
    return null;
  }
  if (expectedRole && current.role !== expectedRole) {
    window.location.href = workspacePath(current.role);
    return null;
  }
  return current;
}

async function apiCall(method, path, body = null) {
  const current = session();
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
    },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE}${path}`, options);
  if (response.status === 401) {
    clearSession();
    window.location.href = "/login";
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw typeof payload === "string" ? { detail: payload } : payload;
  return payload;
}

async function timedApiCall(method, path, body = null) {
  const startedAt = performance.now();
  const data = await apiCall(method, path, body);
  return { data, duration: Math.round(performance.now() - startedAt) };
}

async function logout() {
  try {
    await apiCall("POST", "/auth/logout");
  } catch {}
  clearSession();
  window.location.href = "/login";
}

function parseCsv(value, fallback = []) {
  const items = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const timestamp = Number(value);
  if (!Number.isNaN(timestamp) && String(value).length >= 10) return new Date(timestamp * 1000).toLocaleString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

async function loadHealth() {
  const line = $("#apiHealthLine");
  const badge = $("#apiHealthBadge");
  if (!line || !badge) return;
  try {
    const data = await apiCall("GET", "/health");
    if (!data) return;
    line.textContent = `Neo4j: ${data.neo4j} | Redis: ${data.redis}`;
    badge.className = data.neo4j === "ok" && data.redis === "ok" ? "badge good" : "badge warn";
    badge.textContent = data.neo4j === "ok" && data.redis === "ok" ? "Backend healthy" : "Backend issue";
  } catch (error) {
    line.textContent = `Backend unreachable: ${error.detail || error.message || error}`;
    badge.className = "badge warn";
    badge.textContent = "Backend issue";
  }
}

function renderHeader(title, hint) {
  const current = session();
  $("#workspaceTitle").textContent = title;
  $("#workspaceHint").textContent = hint;
  $("#signedInLine").textContent = `Signed in as ${current.name} (${current.role})`;
}

function setSourceBadge(id, text, type = "") {
  const target = document.getElementById(id);
  if (!target) return;
  target.textContent = type ? `${type} · ${text}` : text;
}

function fillFilterSelects() {
  const sectorSelect = $('#feedFilterForm select[name="sector"]');
  const stageSelect = $('#feedFilterForm select[name="stage"]');
  if (!sectorSelect || !stageSelect) return;
  if (sectorSelect.options.length === 1) SECTORS.forEach((sector) => sectorSelect.insertAdjacentHTML("beforeend", `<option value="${sector}">${sector}</option>`));
  if (stageSelect.options.length === 1) STAGES.forEach((stage) => stageSelect.insertAdjacentHTML("beforeend", `<option value="${stage}">${stage}</option>`));
}
