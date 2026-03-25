async function initLoginPage() {
  if (session().token && session().role) {
    redirectToWorkspace(session().role);
    return;
  }
  initThemeToggle();
  $("#goToRegister").addEventListener("click", () => { window.location.href = "/register"; });
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = $("#loginError");
    errorBox.classList.add("hidden");
    try {
      const response = await apiCall("POST", "/auth/login", {
        email: $("#loginEmail").value.trim(),
        password: $("#loginPassword").value,
      });
      if (!response) return;
      const selectedRole = $("#loginRole").value;
      if (selectedRole !== response.role) {
        errorBox.textContent = `This account belongs to ${response.role}. Select the matching role and try again.`;
        errorBox.classList.remove("hidden");
        return;
      }
      storeSession(response);
      redirectToWorkspace(response.role);
    } catch (error) {
      errorBox.textContent = error.detail || "Invalid email or password";
      errorBox.classList.remove("hidden");
    }
  });
}

async function initRegisterPage() {
  if (session().token && session().role) {
    redirectToWorkspace(session().role);
    return;
  }
  initThemeToggle();
  const roleSelect = $("#registerRole");
  const startupFields = $("#startupRegisterFields");
  const investorFields = $("#investorRegisterFields");
  const syncRole = () => {
    const isStartup = roleSelect.value === "STARTUP";
    startupFields.classList.toggle("hidden", !isStartup);
    investorFields.classList.toggle("hidden", isStartup);
  };
  syncRole();
  roleSelect.addEventListener("change", syncRole);
  $("#goToLogin").addEventListener("click", () => { window.location.href = "/login"; });
  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = $("#registerError");
    errorBox.classList.add("hidden");
    try {
      let response;
      if (roleSelect.value === "STARTUP") {
        response = await apiCall("POST", "/auth/signup/startup", {
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
          sector: form.elements.startup_sector.value,
          stage: form.elements.startup_stage.value,
          funding_ask: Number(form.elements.startup_funding_ask.value || 0),
          equity_offered: Number(form.elements.startup_equity_offered.value || 0),
          pitch: form.elements.startup_pitch.value,
          team_size: Number(form.elements.startup_team_size.value || 1),
          revenue: Number(form.elements.startup_revenue.value || 0),
          founded: Number(form.elements.startup_founded.value || new Date().getFullYear()),
        });
      } else {
        response = await apiCall("POST", "/auth/signup/investor", {
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
          firm: form.elements.investor_firm.value.trim() || null,
          type: form.elements.investor_type.value.trim() || null,
          ticket_min: Number(form.elements.investor_ticket_min.value || 0),
          ticket_max: Number(form.elements.investor_ticket_max.value || 0),
          preferred_sectors: parseCsv(form.elements.investor_sectors.value, ["AI/ML"]),
          stage_focus: parseCsv(form.elements.investor_stages.value, ["Seed"]),
          bio: form.elements.investor_bio.value.trim() || null,
        });
      }
      if (!response) return;
      storeSession(response);
      redirectToWorkspace(response.role);
    } catch (error) {
      errorBox.textContent = error.detail || "Could not create account";
      errorBox.classList.remove("hidden");
    }
  });
}
