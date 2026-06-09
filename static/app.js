let schema = null;
let activeTemplate = "fur";
let activeView = "form";
let currentUser = null;
let authMode = "login";
let setupRequired = false;
let divipolaItems = [];
let divipolaCodes = new Set();
const activeDraftId = {
  fur: null,
  ser: null
};
let errors = [];

const STORAGE_KEY = "adres-fur-assistant";
const INVOICE_PREFIX = "FVEE";
const ICONS = {
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  copy: '<rect x="8" y="8" width="10" height="10" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  drafts: '<path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sync: '<path d="M21 12a9 9 0 0 0-15.3-6.4L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.3 6.4L21 16"/><path d="M16 16h5v5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'
};
const DIVIPOLA_FIELD_NAMES = new Set([
  "Codigo_municipio_residencia_victima",
  "Codigo_municipio_ocurrencia_evento",
  "Codigo_del_municipio_de_residencia_del_propietario",
  "Codigo_del_municipio_de_residencia_del_conductor"
]);
const FREQUENT_FIELD_NAMES = new Set([
  "NIT_PRESTADOR",
  "Codigo_municipio_residencia_victima",
  "Codigo_municipio_ocurrencia_evento",
  "Codigo_del_municipio_de_residencia_del_propietario",
  "Codigo_del_municipio_de_residencia_del_conductor",
  "Codigo_de_la_aseguradora",
  "Codigo_de_habilitacion_del_prestador_que_remite",
  "Codigo_de_habilitacion_del_prestador_que_recibe",
  "Codigo_de_habilitacion_del_prestador_que_recibe_transporte_primario",
  "Direccion_residencia_victima",
  "Direccion_de_ocurrencia_evento",
  "Direccion_de_residencia_del_propietario",
  "Direccion_de_residencia_del_conductor"
]);
const state = {
  fur: {},
  ser: [{}]
};

const content = document.querySelector("#content");
const title = document.querySelector("#screen-title");
const eyebrow = document.querySelector("#eyebrow");
const message = document.querySelector("#message");
const sectionList = document.querySelector("#section-list");
const globalStatus = document.querySelector("#global-status");
const appShell = document.querySelector("#app-shell");
const authScreen = document.querySelector("#auth-screen");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const displayNameField = document.querySelector("#display-name-field");
const currentUserLabel = document.querySelector("#current-user");
const currentRoleLabel = document.querySelector("#current-role");
const profileMenuButton = document.querySelector("#profile-menu-button");
const profileMenu = document.querySelector("#profile-menu");
const authSubtitle = document.querySelector("#auth-subtitle");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  restoreState();
  const [schemaResponse, sessionResponse, divipolaResponse] = await Promise.all([
    fetch("/api/schema"),
    fetch("/api/session"),
    fetch("/api/divipola")
  ]);
  schema = await readJsonResponse(schemaResponse);
  const session = await readJsonResponse(sessionResponse);
  const divipola = await readJsonResponse(divipolaResponse);
  divipolaItems = (divipola.items || []).map((item) => ({
    ...item,
    searchText: normalizeSearch(`${item.code} ${item.municipality} ${item.department} ${item.departmentCode} ${item.label}`)
  }));
  divipolaCodes = new Set(divipolaItems.map((item) => item.code));
  currentUser = session.user;
  setupRequired = Boolean(session.setupRequired);
  authMode = setupRequired ? "setup" : "login";
  bindAuth();
  bindChrome();
  applyStaticIcons();
  normalizeAll();
  if (currentUser) {
    showApp();
    render();
  } else {
    showAuth();
  }
}

function iconMarkup(name) {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

function setButtonContent(button, icon, text) {
  if (!button) return;
  button.dataset.icon = icon;
  button.innerHTML = `${iconMarkup(icon)}<span>${escapeHtml(text)}</span>`;
}

function applyStaticIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((button) => {
    setButtonContent(button, button.dataset.icon, clean(button.textContent));
  });
}

function bindChrome() {
  profileMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });
  document.addEventListener("click", (event) => {
    if (!profileMenu.hidden && !profileMenu.contains(event.target) && event.target !== profileMenuButton) {
      closeProfileMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfileMenu();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeTemplate = button.dataset.template;
      activeView = "form";
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      hideMessage();
      render();
    });
  });

  document.querySelector("#clear-form").addEventListener("click", () => {
    const label = schema.templates[activeTemplate].title;
    if (!window.confirm(`Limpiar datos de ${label}?`)) return;
    if (activeTemplate === "fur") state.fur = {};
    if (activeTemplate === "ser") state.ser = [{}];
    activeDraftId[activeTemplate] = null;
    saveState();
    hideMessage();
    render();
  });

  document.querySelector("#sync-ser").addEventListener("click", () => {
    const nit = state.fur.NIT_PRESTADOR || "";
    const factura = state.fur.NUM_FACTURA || "";
    state.ser = state.ser.map((row) => ({
      ...row,
      NIT_PRESTADOR: nit || row.NIT_PRESTADOR || "",
      NUM_FACTURA: factura || row.NUM_FACTURA || ""
    }));
    activeTemplate = "ser";
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.template === "ser"));
    normalizeAll();
    saveState();
    showMessage("Factura y NIT copiados a los servicios.", "ok");
    render();
  });

  document.querySelector("#history-button").addEventListener("click", () => {
    hideMessage();
    if (activeView === "history") {
      activeView = "form";
      render();
    } else {
      activeView = "history";
      renderHistory();
    }
  });

  document.querySelector("#drafts-button").addEventListener("click", () => {
    hideMessage();
    if (activeView === "drafts") {
      activeView = "form";
      render();
    } else {
      activeView = "drafts";
      renderDrafts();
    }
  });

  document.querySelector("#logout-button").addEventListener("click", logout);
  document.querySelector("#admin-button").addEventListener("click", () => {
    hideMessage();
    if (activeView === "admin") {
      activeView = "form";
      render();
    } else {
      activeView = "admin";
      renderAdmin();
    }
  });
  document.querySelector("#save-draft-button").addEventListener("click", saveCurrentDraft);
  document.querySelector("#export-form").addEventListener("click", exportActive);
}

function toggleProfileMenu() {
  const open = profileMenu.hidden;
  profileMenu.hidden = !open;
  profileMenuButton.setAttribute("aria-expanded", String(open));
}

function closeProfileMenu() {
  profileMenu.hidden = true;
  profileMenuButton.setAttribute("aria-expanded", "false");
}

function bindAuth() {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuth();
  });

  renderAuthMode();
}

function renderAuthMode() {
  const submit = document.querySelector("#auth-submit");
  const toggle = document.querySelector("#auth-toggle");
  const setup = authMode === "setup";
  displayNameField.hidden = !setup;
  toggle.hidden = true;
  submit.textContent = setup ? "Crear super admin" : "Ingresar";
  authSubtitle.textContent = setup ? "Configuracion inicial del super admin" : "Ingreso de facturadores";
  document.querySelector("#auth-password").autocomplete = setup ? "new-password" : "current-password";
  authMessage.hidden = true;
}

function showAuth() {
  appShell.hidden = true;
  authScreen.hidden = false;
  document.querySelector("#auth-username").focus();
}

function showApp() {
  authScreen.hidden = true;
  appShell.hidden = false;
  currentUserLabel.textContent = currentUser ? currentUser.displayName : "Sin usuario";
  currentRoleLabel.textContent = currentUser ? roleLabel(currentUser.role) : "Perfil activo";
  profileMenuButton.textContent = currentUser?.displayName ? currentUser.displayName.slice(0, 1).toUpperCase() : "A";
  document.querySelector("#admin-button").hidden = !currentUser?.isSuperAdmin;
}

async function submitAuth() {
  const payload = {
    username: document.querySelector("#auth-username").value,
    password: document.querySelector("#auth-password").value,
    displayName: document.querySelector("#auth-display-name").value,
    role: "super_admin"
  };
  const endpoint = authMode === "login" ? "/api/login" : "/api/register";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    authMessage.textContent = data.errors?.[0]?.message || "No se pudo ingresar.";
    authMessage.hidden = false;
    return;
  }
  currentUser = data.user;
  setupRequired = false;
  document.querySelector("#auth-password").value = "";
  showApp();
  render();
}

async function logout() {
  closeProfileMenu();
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  authMode = setupRequired ? "setup" : "login";
  renderAuthMode();
  showAuth();
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.fur && typeof saved.fur === "object") state.fur = saved.fur;
    if (Array.isArray(saved.ser) && saved.ser.length) state.ser = saved.ser;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  if (!schema) return;
  if (activeView === "history") {
    renderHistory();
    return;
  }
  if (activeView === "drafts") {
    renderDrafts();
    return;
  }
  if (activeView === "admin") {
    renderAdmin();
    return;
  }
  normalizeAll();
  errors = validateActive();

  const template = schema.templates[activeTemplate];
  title.textContent = template.title;
  eyebrow.textContent = template.mode === "single" ? "Reclamacion" : "Servicios reclamados";
  setFormActions("form");

  content.replaceChildren();
  if (activeTemplate === "fur") renderFur();
  if (activeTemplate === "ser") renderSer();
  renderStatus();
}

function setFormActions(mode) {
  const inForm = mode === "form";
  document.querySelector("#sync-ser").hidden = !inForm;
  document.querySelector("#save-draft-button").hidden = !inForm;
  document.querySelector("#clear-form").hidden = !inForm;
  document.querySelector("#export-form").hidden = !inForm;
  setButtonContent(document.querySelector("#history-button"), "history", mode === "history" ? "Volver" : "Historial");
  setButtonContent(document.querySelector("#drafts-button"), "drafts", mode === "drafts" ? "Volver" : "Borradores");
  const adminButton = document.querySelector("#admin-button");
  adminButton.hidden = !currentUser?.isSuperAdmin;
  setButtonContent(adminButton, "users", mode === "admin" ? "Volver" : "Usuarios");
}

async function renderHistory() {
  activeView = "history";
  setFormActions("history");
  title.textContent = "Historial de facturas";
  eyebrow.textContent = "Registro local";
  globalStatus.textContent = "Historial";
  sectionList.replaceChildren();
  content.replaceChildren();

  const filters = document.createElement("section");
  filters.className = "filter-card";
  filters.innerHTML = `
    <form id="history-filter-form" class="filter-form">
      <label class="auth-field">
        <span>Buscar</span>
        <input id="history-q" placeholder="Factura, facturador o archivo">
      </label>
      <label class="auth-field">
        <span>Plantilla</span>
        <select id="history-template">
          <option value="">Todas</option>
          <option value="fur">Plantilla_FUR_Primera_Vez.xlsx</option>
          <option value="ser">Plantilla_SER.xlsx</option>
        </select>
      </label>
      <label class="auth-field">
        <span>Desde</span>
        <input id="history-from" type="date">
      </label>
      <label class="auth-field">
        <span>Hasta</span>
        <input id="history-to" type="date">
      </label>
      <button class="primary" data-icon="search" type="submit">Buscar</button>
    </form>
  `;
  const results = document.createElement("div");
  results.className = "content";
  content.append(filters, results);
  applyStaticIcons(filters);

  const form = filters.querySelector("#history-filter-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadHistoryResults(results);
  });
  await loadHistoryResults(results);
}

async function loadHistoryResults(target) {
  target.replaceChildren(loadingBlock("Cargando historial..."));
  const params = new URLSearchParams();
  const q = document.querySelector("#history-q")?.value || "";
  const templateId = document.querySelector("#history-template")?.value || "";
  const dateFrom = document.querySelector("#history-from")?.value || "";
  const dateTo = document.querySelector("#history-to")?.value || "";
  if (q) params.set("q", q);
  if (templateId) params.set("templateId", templateId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  try {
    const response = await fetch(`/api/history?${params.toString()}`);
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo cargar el historial.");
    target.replaceChildren(buildHistoryTable(data.records || []));
  } catch (err) {
    target.replaceChildren(loadingBlock(err.message));
  }
}

function loadingBlock(text) {
  const block = document.createElement("div");
  block.className = "empty-section";
  block.textContent = text;
  return block;
}

function buildHistoryTable(records) {
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty-section";
    empty.textContent = "Todavia no hay facturas exportadas.";
    return empty;
  }

  const wrapper = document.createElement("section");
  wrapper.className = "history-card";
  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Facturador</th>
        <th>Factura</th>
        <th>Plantilla</th>
        <th>Filas</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDateTime(record.createdAt))}</td>
      <td>${escapeHtml(record.displayName)}</td>
      <td>${escapeHtml(record.invoiceNumber)}</td>
      <td>${escapeHtml(record.filename)}</td>
      <td>${escapeHtml(record.rowCount)}</td>
    `;
    body.append(row);
  });
  wrapper.append(table);
  return wrapper;
}

async function renderDrafts() {
  activeView = "drafts";
  setFormActions("drafts");
  title.textContent = "Borradores";
  eyebrow.textContent = "Trabajo guardado";
  globalStatus.textContent = "Borradores";
  sectionList.replaceChildren();
  content.replaceChildren();

  const filters = document.createElement("section");
  filters.className = "filter-card";
  filters.innerHTML = `
    <form id="draft-filter-form" class="filter-form compact">
      <label class="auth-field">
        <span>Buscar</span>
        <input id="draft-q" placeholder="Numero de factura">
      </label>
      <label class="auth-field">
        <span>Plantilla</span>
        <select id="draft-template">
          <option value="">Todas</option>
          <option value="fur">Plantilla_FUR_Primera_Vez.xlsx</option>
          <option value="ser">Plantilla_SER.xlsx</option>
        </select>
      </label>
      <button class="primary" data-icon="search" type="submit">Buscar</button>
    </form>
  `;
  const results = document.createElement("div");
  results.className = "content";
  content.append(filters, results);
  applyStaticIcons(filters);

  filters.querySelector("#draft-filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    loadDraftResults(results);
  });
  await loadDraftResults(results);
}

async function loadDraftResults(target) {
  target.replaceChildren(loadingBlock("Cargando borradores..."));
  const params = new URLSearchParams();
  const q = document.querySelector("#draft-q")?.value || "";
  const templateId = document.querySelector("#draft-template")?.value || "";
  if (q) params.set("q", q);
  if (templateId) params.set("templateId", templateId);
  try {
    const response = await fetch(`/api/drafts?${params.toString()}`);
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudieron cargar los borradores.");
    target.replaceChildren(buildDraftsTable(data.drafts || []));
  } catch (err) {
    target.replaceChildren(loadingBlock(err.message));
  }
}

function buildDraftsTable(drafts) {
  if (!drafts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-section";
    empty.textContent = "Todavia no hay borradores guardados.";
    return empty;
  }

  const wrapper = document.createElement("section");
  wrapper.className = "history-card";
  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Actualizado</th>
        <th>Factura</th>
        <th>Plantilla</th>
        <th>Filas</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  drafts.forEach((draft) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDateTime(draft.updatedAt))}</td>
      <td>${escapeHtml(draft.invoiceNumber || "Sin numero")}</td>
      <td>${escapeHtml(schema.templates[draft.templateId]?.file || draft.templateId)}</td>
      <td>${escapeHtml(draft.rowCount)}</td>
      <td>
        <div class="table-actions">
          <button class="mini" data-icon="file" type="button" data-load-draft="${draft.id}">Cargar</button>
          <button class="mini danger-mini" data-icon="trash" type="button" data-delete-draft="${draft.id}">Eliminar</button>
        </div>
      </td>
    `;
    body.append(row);
  });
  wrapper.append(table);
  applyStaticIcons(wrapper);
  wrapper.querySelectorAll("[data-load-draft]").forEach((button) => {
    button.addEventListener("click", () => loadDraft(Number(button.dataset.loadDraft)));
  });
  wrapper.querySelectorAll("[data-delete-draft]").forEach((button) => {
    button.addEventListener("click", () => deleteDraft(Number(button.dataset.deleteDraft)));
  });
  return wrapper;
}

async function saveCurrentDraft() {
  normalizeAll();
  saveState();
  const payload = activeTemplate === "fur" ? { row: state.fur } : { rows: state.ser };
  if (activeDraftId[activeTemplate]) payload.draftId = activeDraftId[activeTemplate];
  const button = document.querySelector("#save-draft-button");
  button.disabled = true;
  setButtonContent(button, "save", "Guardando...");
  try {
    const response = await fetch(`/api/drafts/${activeTemplate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo guardar el borrador.");
    activeDraftId[activeTemplate] = data.draft.id;
    showMessage(`Borrador guardado: ${data.draft.invoiceNumber || "sin numero"}`, "ok");
  } catch (err) {
    showMessage(err.message, "error");
  } finally {
    button.disabled = false;
    setButtonContent(button, "save", "Guardar borrador");
  }
}

async function loadDraft(draftId) {
  try {
    const response = await fetch(`/api/drafts/${draftId}`);
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo cargar el borrador.");
    const draft = data.draft;
    activeTemplate = draft.templateId;
    activeDraftId[activeTemplate] = draft.id;
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.template === activeTemplate));
    if (activeTemplate === "fur") {
      state.fur = draft.payload.row || {};
    } else {
      state.ser = Array.isArray(draft.payload.rows) && draft.payload.rows.length ? draft.payload.rows : [{}];
    }
    normalizeAll();
    saveState();
    activeView = "form";
    showMessage(`Borrador cargado: ${draft.invoiceNumber || "sin numero"}`, "ok");
    render();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function deleteDraft(draftId) {
  if (!window.confirm("Eliminar este borrador?")) return;
  try {
    const response = await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo eliminar el borrador.");
    Object.keys(activeDraftId).forEach((key) => {
      if (activeDraftId[key] === draftId) activeDraftId[key] = null;
    });
    showMessage("Borrador eliminado.", "ok");
    renderDrafts();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function renderAdmin() {
  activeView = "admin";
  setFormActions("admin");
  title.textContent = "Usuarios";
  eyebrow.textContent = "Super admin";
  globalStatus.textContent = "Admin";
  sectionList.replaceChildren();
  content.replaceChildren();

  if (!currentUser?.isSuperAdmin) {
    const denied = document.createElement("div");
    denied.className = "empty-section";
    denied.textContent = "Solo el super admin puede administrar usuarios.";
    content.append(denied);
    return;
  }

  const card = document.createElement("section");
  card.className = "admin-card";
  card.innerHTML = `
    <div class="section-title">
      <h2>Crear usuario</h2>
      <span>Facturadores y administradores</span>
    </div>
    <form id="admin-user-form" class="admin-form">
      <label class="auth-field">
        <span>Usuario</span>
        <input id="admin-username" autocomplete="off" required>
      </label>
      <label class="auth-field">
        <span>Nombre del facturador</span>
        <input id="admin-display-name" autocomplete="off" required>
      </label>
      <label class="auth-field">
        <span>Rol</span>
        <select id="admin-role">
          <option value="facturador">Facturador</option>
          <option value="super_admin">Super admin</option>
        </select>
      </label>
      <label class="auth-field">
        <span>Clave inicial</span>
        <input id="admin-password" type="password" autocomplete="new-password" required>
      </label>
      <div id="admin-message" class="auth-message" hidden></div>
      <button class="primary" data-icon="users" type="submit">Crear usuario</button>
    </form>
  `;
  content.append(card);
  applyStaticIcons(card);
  card.querySelector("#admin-user-form").addEventListener("submit", createUserFromAdmin);

  const usersWrap = document.createElement("section");
  usersWrap.className = "history-card";
  usersWrap.innerHTML = `<div class="empty-section">Cargando usuarios...</div>`;
  content.append(usersWrap);
  await loadUsers(usersWrap);
}

async function createUserFromAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = form.querySelector("#admin-message");
  msg.hidden = true;
  const payload = {
    username: form.querySelector("#admin-username").value,
    displayName: form.querySelector("#admin-display-name").value,
    password: form.querySelector("#admin-password").value,
    role: form.querySelector("#admin-role").value
  };
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    msg.textContent = data.errors?.[0]?.message || "No se pudo crear el usuario.";
    msg.hidden = false;
    return;
  }
  form.reset();
  showMessage(`Usuario creado: ${data.user.displayName}`, "ok");
  renderAdmin();
}

async function loadUsers(wrapper) {
  try {
    const response = await fetch("/api/users");
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudieron cargar usuarios.");
    wrapper.replaceChildren(buildUsersTable(data.users || []));
  } catch (err) {
    wrapper.innerHTML = `<div class="empty-section">${escapeHtml(err.message)}</div>`;
  }
}

function buildUsersTable(users) {
  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Usuario</th>
        <th>Nombre</th>
        <th>Rol</th>
        <th>Estado</th>
        <th>Nueva clave</th>
        <th>Creado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  users.forEach((user) => {
    const row = document.createElement("tr");
    row.dataset.userId = user.id;
    row.innerHTML = `
      <td>${escapeHtml(user.username)}</td>
      <td><input class="table-input" data-user-field="displayName" value="${escapeAttr(user.displayName)}"></td>
      <td>
        <select class="table-input" data-user-field="role">
          <option value="facturador"${user.role === "facturador" ? " selected" : ""}>Facturador</option>
          <option value="super_admin"${user.role === "super_admin" ? " selected" : ""}>Super admin</option>
        </select>
      </td>
      <td>
        <select class="table-input" data-user-field="active">
          <option value="1"${user.active ? " selected" : ""}>Activo</option>
          <option value="0"${!user.active ? " selected" : ""}>Inactivo</option>
        </select>
      </td>
      <td><input class="table-input" data-user-field="password" type="password" placeholder="Opcional"></td>
      <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
      <td>
        <div class="table-actions">
          <button class="mini" data-icon="save" type="button" data-save-user="${user.id}">Guardar</button>
          <button class="mini" data-icon="activity" type="button" data-activity-user="${user.id}" data-user-label="${escapeAttr(user.displayName)}">Actividad</button>
        </div>
      </td>
    `;
    body.append(row);
  });
  applyStaticIcons(table);
  table.querySelectorAll("[data-save-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserFromRow(Number(button.dataset.saveUser)));
  });
  table.querySelectorAll("[data-activity-user]").forEach((button) => {
    button.addEventListener("click", () => showUserActivity(Number(button.dataset.activityUser), button.dataset.userLabel));
  });
  return table;
}

async function updateUserFromRow(userId) {
  const row = document.querySelector(`tr[data-user-id="${userId}"]`);
  if (!row) return;
  const payload = {
    displayName: row.querySelector('[data-user-field="displayName"]').value,
    role: row.querySelector('[data-user-field="role"]').value,
    active: row.querySelector('[data-user-field="active"]').value === "1",
    password: row.querySelector('[data-user-field="password"]').value
  };
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo actualizar el usuario.");
    showMessage(`Usuario actualizado: ${data.user.displayName}`, "ok");
    if (data.user.id === currentUser.id) {
      currentUser = data.user;
      showApp();
    }
    renderAdmin();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function showUserActivity(userId, label) {
  const existing = document.querySelector("#activity-panel");
  if (existing) existing.remove();
  const panel = document.createElement("section");
  panel.id = "activity-panel";
  panel.className = "history-card activity-card";
  panel.innerHTML = `<div class="empty-section">Cargando actividad...</div>`;
  content.append(panel);
  try {
    const response = await fetch(`/api/users/${userId}/activity`);
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.errors?.[0]?.message || "No se pudo cargar la actividad.");
    const activity = data.activity;
    panel.innerHTML = `
      <div class="section-title">
        <h2>Actividad de ${escapeHtml(label)}</h2>
        <span>${activity.totals.exports} exportaciones - ${activity.totals.drafts} borradores</span>
      </div>
      <div class="activity-grid">
        <div>
          <h3>Ultimas exportaciones</h3>
          ${activityList(activity.exports, "createdAt")}
        </div>
        <div>
          <h3>Ultimos borradores</h3>
          ${activityList(activity.drafts, "updatedAt")}
        </div>
      </div>
    `;
  } catch (err) {
    panel.innerHTML = `<div class="empty-section">${escapeHtml(err.message)}</div>`;
  }
}

function activityList(items, dateKey) {
  if (!items.length) return `<p class="muted-line">Sin registros.</p>`;
  return `
    <ul class="activity-list">
      ${items.map((item) => `
        <li>
          <strong>${escapeHtml(item.invoiceNumber || "Sin factura")}</strong>
          <span>${escapeHtml(schema.templates[item.templateId]?.file || item.templateId)} - ${escapeHtml(formatDateTime(item[dateKey]))}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderFur() {
  const template = schema.templates.fur;
  const sections = groupVisibleFields(template.fields, state.fur, 1, "fur");
  Object.entries(sections).forEach(([section, fields]) => {
    const wrapper = document.createElement("section");
    wrapper.className = "form-section";
    wrapper.append(sectionHeader(section, fields.length, state.fur, 1, "fur"));

    const grid = document.createElement("div");
    grid.className = "field-grid";
    fields.forEach((field) => grid.append(renderField(field, state.fur, 1, "fur")));
    wrapper.append(grid);
    content.append(wrapper);
  });
}

function renderSer() {
  const toolbar = document.createElement("div");
  toolbar.className = "row-toolbar";
  toolbar.innerHTML = `<strong>${state.ser.length} servicio${state.ser.length === 1 ? "" : "s"}</strong>`;
  const add = document.createElement("button");
  add.className = "primary";
  add.type = "button";
  setButtonContent(add, "plus", "Agregar servicio");
  add.addEventListener("click", () => {
    const previous = state.ser[state.ser.length - 1] || {};
    state.ser.push({
      NUM_FACTURA: previous.NUM_FACTURA || state.fur.NUM_FACTURA || "",
      NIT_PRESTADOR: previous.NIT_PRESTADOR || state.fur.NIT_PRESTADOR || ""
    });
    saveState();
    render();
  });
  toolbar.append(add);
  content.append(toolbar);

  const fields = schema.templates.ser.fields;
  state.ser.forEach((row, index) => {
    const rowNumber = index + 1;
    const visible = fields.filter((field) => isVisible(field, row, rowNumber, "ser"));
    const item = document.createElement("section");
    item.className = "service-row";

    const head = document.createElement("div");
    head.className = "service-row-head";
    const rowErrors = errors.filter((error) => error.row === rowNumber);
    head.innerHTML = `<strong>Servicio ${rowNumber}</strong><span>${rowErrors.length ? `${rowErrors.length} error(es)` : "Listo para revisar"}</span>`;
    const buttons = document.createElement("div");
    const duplicate = document.createElement("button");
    duplicate.className = "mini";
    duplicate.type = "button";
    setButtonContent(duplicate, "copy", "Duplicar");
    duplicate.addEventListener("click", () => {
      state.ser.splice(index + 1, 0, { ...row });
      saveState();
      render();
    });
    const remove = document.createElement("button");
    remove.className = "mini";
    remove.type = "button";
    setButtonContent(remove, "trash", "Eliminar");
    remove.disabled = state.ser.length === 1;
    remove.addEventListener("click", () => {
      state.ser.splice(index, 1);
      if (!state.ser.length) state.ser.push({});
      saveState();
      render();
    });
    buttons.append(duplicate, remove);
    head.append(buttons);

    const grid = document.createElement("div");
    grid.className = "service-fields";
    visible.forEach((field) => grid.append(renderField(field, row, rowNumber, "ser")));

    item.append(head, grid);
    content.append(item);
  });
}

function sectionHeader(section, count, row, rowNumber, templateId) {
  const header = document.createElement("div");
  header.className = "section-title";
  const required = getSectionRequired(section, row, rowNumber, templateId);
  const done = required.filter((field) => clean(row[field.name])).length;
  header.innerHTML = `<h2>${escapeHtml(section)}</h2><span>${done}/${required.length || 0} obligatorios</span>`;
  return header;
}

function renderField(field, row, rowNumber, templateId) {
  const template = document.querySelector("#field-template");
  const node = template.content.firstElementChild.cloneNode(true);
  const required = isRequired(field, row, templateId);
  const label = node.querySelector(".field-label");
  label.textContent = field.label;
  if (required) {
    const dot = document.createElement("span");
    dot.className = "required-dot";
    dot.title = "Obligatorio";
    label.append(dot);
  }

  const controlWrap = node.querySelector(".control");
  const control = buildControl(field, clean(row[field.name]));
  control.dataset.field = field.name;
  control.dataset.row = String(rowNumber);
  control.dataset.template = templateId;
  controlWrap.append(control);
  if (DIVIPOLA_FIELD_NAMES.has(field.name) && control.tagName === "INPUT") {
    setupDivipolaControl(control, controlWrap);
  } else if (FREQUENT_FIELD_NAMES.has(field.name) && control.tagName === "INPUT") {
    const list = document.createElement("datalist");
    list.id = `list-${templateId}-${rowNumber}-${field.name}`;
    control.setAttribute("list", list.id);
    controlWrap.append(list);
    setupFrequentControl(control, list, field.name);
  }

  const hintParts = [];
  if (field.help) hintParts.push(field.help);
  if (field.maxLength) hintParts.push(`Max. ${field.maxLength}`);
  if (field.minLength) hintParts.push(`Min. ${field.minLength}`);
  node.querySelector(".hint").textContent = hintParts.join(" - ");

  const error = findError(rowNumber, field.name);
  if (error) {
    node.classList.add("invalid");
    node.querySelector(".error").textContent = error.message;
  }
  return node;
}

function setupFrequentControl(control, list, fieldName) {
  let lastQuery = "";
  let timeout = null;
  const load = () => {
    const query = clean(control.value);
    if (query === lastQuery && list.children.length) return;
    lastQuery = query;
    window.clearTimeout(timeout);
    timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ fieldName });
        if (query) params.set("q", query);
        const response = await fetch(`/api/frequent?${params.toString()}`);
        const data = await readJsonResponse(response);
        if (!response.ok) return;
        list.replaceChildren();
        (data.values || []).forEach((item) => {
          const option = document.createElement("option");
          option.value = item.value;
          option.label = `${item.label} (${item.useCount})`;
          list.append(option);
        });
      } catch {
        list.replaceChildren();
      }
    }, 180);
  };
  control.addEventListener("focus", load);
  control.addEventListener("input", load);
}

function buildControl(field, value) {
  let control;
  if (DIVIPOLA_FIELD_NAMES.has(field.name)) {
    control = buildDivipolaInput(value);
  } else if (field.type === "select") {
    control = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Seleccione";
    control.append(blank);
    schema.options[field.optionsRef].forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      control.append(item);
    });
    control.addEventListener("change", onControlCommit);
  } else if (field.type === "textarea") {
    control = document.createElement("textarea");
    control.addEventListener("input", onControlInput);
    control.addEventListener("blur", onControlCommit);
  } else {
    control = document.createElement("input");
    control.type = field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
    if (field.type === "numeric" || field.type === "amount") control.inputMode = "numeric";
    control.addEventListener("input", onControlInput);
    control.addEventListener("blur", onControlCommit);
  }
  control.value = value;
  if (field.maxLength && !DIVIPOLA_FIELD_NAMES.has(field.name)) control.maxLength = field.maxLength;
  if (field.readonly) control.readOnly = true;
  return control;
}

function buildDivipolaInput(value) {
  const control = document.createElement("input");
  control.type = "text";
  control.inputMode = "search";
  control.autocomplete = "off";
  control.className = "divipola-input";
  control.placeholder = "Buscar departamento, municipio o codigo";
  control.addEventListener("input", onControlInput);
  control.addEventListener("blur", onDivipolaBlur);
  control.value = normalizeDivipolaValue(value) || value;
  return control;
}

function setupDivipolaControl(control, controlWrap) {
  controlWrap.classList.add("divipola-control");
  const panel = document.createElement("div");
  panel.className = "divipola-results";
  panel.hidden = true;
  controlWrap.append(panel);

  const hide = () => {
    panel.hidden = true;
    panel.replaceChildren();
  };

  const choose = (item) => {
    control.value = item.code;
    updateState(control.dataset.template, Number(control.dataset.row), control.dataset.field, item.code);
    normalizeAll();
    saveState();
    hide();
    renderPreservingScroll();
  };

  const renderResults = () => {
    const query = clean(control.value);
    const matches = filterDivipola(query);
    panel.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "divipola-empty";
      empty.textContent = query ? "Sin resultados DIVIPOLA" : "Escribe para buscar";
      panel.append(empty);
      panel.hidden = false;
      return;
    }
    matches.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "divipola-option";
      button.innerHTML = `
        <strong>${escapeHtml(item.code)} - ${escapeHtml(item.municipality)}</strong>
        <span>${escapeHtml(item.department)}</span>
      `;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => choose(item));
      panel.append(button);
    });
    panel.hidden = false;
  };

  control.addEventListener("focus", renderResults);
  control.addEventListener("input", renderResults);
}

function filterDivipola(query) {
  const term = normalizeSearch(query);
  const source = term
    ? divipolaItems.filter((item) => item.searchText.includes(term))
    : divipolaItems;
  return source.slice(0, 30);
}

function normalizeDivipolaValue(value) {
  const text = clean(value);
  if (!text) return "";
  if (divipolaCodes.has(text)) return text;
  const prefix = text.match(/^\d{5}/);
  if (prefix && divipolaCodes.has(prefix[0])) return prefix[0];
  const normalized = normalizeSearch(text);
  const exact = divipolaItems.find((item) => normalizeSearch(item.label) === normalized);
  return exact ? exact.code : text;
}

function onDivipolaBlur(event) {
  const control = event.currentTarget;
  window.setTimeout(() => {
    control.value = normalizeDivipolaValue(control.value);
    onControlCommit({ currentTarget: control });
  }, 120);
}

function onControlInput(event) {
  const control = event.currentTarget;
  updateState(control.dataset.template, Number(control.dataset.row), control.dataset.field, control.value);
  if (control.readOnly) return;
  saveState();
}

function onControlCommit(event) {
  const control = event.currentTarget;
  updateState(control.dataset.template, Number(control.dataset.row), control.dataset.field, control.value);
  normalizeAll();
  saveState();
  renderPreservingScroll();
}

function updateState(templateId, rowNumber, field, value) {
  if (templateId === "fur") {
    state.fur[field] = clean(value);
    return;
  }
  state.ser[rowNumber - 1][field] = clean(value);
}

function renderPreservingScroll() {
  const x = window.scrollX;
  const y = window.scrollY;
  render();
  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

function normalizeAll() {
  state.fur = normalizeRow("fur", state.fur);
  state.ser = state.ser.map((row) => normalizeRow("ser", row));
}

function normalizeRow(templateId, rawRow) {
  const row = { ...rawRow };
  schema.templates[templateId].fields.forEach((field) => {
    row[field.name] = clean(row[field.name]);
  });
  if (Object.prototype.hasOwnProperty.call(row, "NUM_FACTURA")) {
    row.NUM_FACTURA = normalizeInvoiceNumber(row.NUM_FACTURA);
  }
  schema.templates[templateId].fields.forEach((field) => {
    if (field.emptyWhen && condition(field.emptyWhen, row, templateId)) row[field.name] = "";
  });

  if (templateId === "fur") {
    if (condition("accident", row, templateId) && row.Estado_de_aseguramiento && row.Estado_de_aseguramiento !== "6") {
      row.Cobro_por_agotamiento_tope_Aseguradora = "0";
    }
    if (condition("notAccident", row, templateId)) {
      row.Cobro_por_agotamiento_tope_Aseguradora = "";
    }
  }

  if (templateId === "ser") {
    const qty = toInt(row.Cantidad_de_servicios);
    const billed = toInt(row.Valor_unitario_facturado);
    const claimed = toInt(row.Valor_unitario_reclamado);
    if (qty !== null && billed !== null) row.Valor_total_facturado = String(qty * billed);
    if (qty !== null && claimed !== null) row.Valor_total_reclamado = String(qty * claimed);
  }
  return row;
}

function validateActive() {
  const templateId = activeTemplate;
  const rows = templateId === "fur" ? [state.fur] : state.ser;
  const list = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    schema.templates[templateId].fields.forEach((field) => {
      const value = clean(row[field.name]);
      const required = isRequired(field, row, templateId);
      if (required && !value) {
        list.push(error(rowNumber, field, "Campo obligatorio segun las reglas seleccionadas."));
        return;
      }
      if (!value) return;
      if (field.maxLength && value.length > field.maxLength) list.push(error(rowNumber, field, `Maximo ${field.maxLength} caracteres.`));
      if (field.minLength && value.length < field.minLength) list.push(error(rowNumber, field, `Minimo ${field.minLength} caracteres.`));
      if ((field.type === "numeric" || field.type === "amount") && !/^\d+$/.test(value)) {
        list.push(error(rowNumber, field, "Solo se permiten digitos, sin puntos, comas ni espacios."));
      }
      if (DIVIPOLA_FIELD_NAMES.has(field.name) && divipolaCodes.size && !divipolaCodes.has(value)) {
        list.push(error(rowNumber, field, "Seleccione un codigo DIVIPOLA valido."));
      }
      if (field.type === "amount" && field.minValue && toInt(value) !== null && toInt(value) < field.minValue) {
        list.push(error(rowNumber, field, `Debe ser mayor o igual a ${field.minValue}.`));
      }
      if (field.type === "date" && !parseDate(value)) list.push(error(rowNumber, field, "Use una fecha valida en formato AAAA-MM-DD."));
      if (field.type === "time" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) list.push(error(rowNumber, field, "Use hora valida en formato HH:MM."));
      if (field.type === "select") {
        const allowed = new Set(schema.options[field.optionsRef].map((item) => item.value));
        if (!allowed.has(value)) list.push(error(rowNumber, field, "Seleccione un valor permitido."));
      }
      if (field.noComma && value.includes(",")) list.push(error(rowNumber, field, "La guia indica que este campo no debe incluir coma (,)."));
    });
    list.push(...validateCross(templateId, row, rowNumber));
  });
  return list;
}

function validateCross(templateId, row, rowNumber) {
  const list = [];
  const fieldByName = Object.fromEntries(schema.templates[templateId].fields.map((field) => [field.name, field]));

  if (templateId === "fur") {
    const start = parseDate(row.Fecha_de_inicio_de_vigencia_de_la_poliza);
    const end = parseDate(row.Fecha_final_de_vigencia_de_la_poliza);
    if (start && end && end < start) {
      list.push(error(rowNumber, fieldByName.Fecha_final_de_vigencia_de_la_poliza, "La fecha final de la poliza no puede ser anterior al inicio."));
    }
  }

  if (templateId === "ser") {
    const unitBilled = toInt(row.Valor_unitario_facturado);
    const unitClaimed = toInt(row.Valor_unitario_reclamado);
    const totalBilled = toInt(row.Valor_total_facturado);
    const totalClaimed = toInt(row.Valor_total_reclamado);
    if (unitBilled !== null && unitClaimed !== null && unitClaimed > unitBilled) {
      list.push(error(rowNumber, fieldByName.Valor_unitario_reclamado, "No puede ser mayor al valor unitario facturado."));
    }
    if (totalBilled !== null && totalClaimed !== null && totalClaimed > totalBilled) {
      list.push(error(rowNumber, fieldByName.Valor_total_reclamado, "No puede ser mayor al valor total facturado."));
    }
  }

  return list;
}

function error(rowNumber, field, messageText) {
  return {
    row: rowNumber,
    field: field.name,
    label: field.label,
    message: messageText
  };
}

function findError(rowNumber, fieldName) {
  return errors.find((item) => item.row === rowNumber && item.field === fieldName);
}

function groupVisibleFields(fields, row, rowNumber, templateId) {
  return fields.reduce((groups, field) => {
    if (!isVisible(field, row, rowNumber, templateId)) return groups;
    if (!groups[field.section]) groups[field.section] = [];
    groups[field.section].push(field);
    return groups;
  }, {});
}

function getSectionRequired(section, row, rowNumber, templateId) {
  return schema.templates[templateId].fields.filter((field) => {
    return field.section === section && isVisible(field, row, rowNumber, templateId) && isRequired(field, row, templateId);
  });
}

function isVisible(field, row, rowNumber, templateId) {
  if (!field.visibleWhen) return true;
  return condition(field.visibleWhen, row, templateId);
}

function isRequired(field, row, templateId) {
  return Boolean(field.required) || condition(field.requiredWhen, row, templateId);
}

function condition(name, row, templateId) {
  if (!name) return false;
  const nature = clean(row.Naturaleza_del_evento);
  const stateValue = clean(row.Estado_de_aseguramiento);
  const attention = clean(row.Es_atencion_inicial_paciente_remitido_o_control);
  const ownerDoc = clean(row.Tipo_de_documento_de_identidad_del_propietario);
  const victimDoc = clean(row.Tipo_documento_identidad_victima);
  const serviceType = clean(row.Tipo_de_servicio);
  const accident = nature === "01";
  const policyRequired = accident && ["4", "6"].includes(stateValue);
  const ownerRequired = accident && ["2", "4", "6", "8"].includes(stateValue);
  const ownerPersonRequired = ownerRequired && ownerDoc !== "NI";
  const driverRequired = accident && ["2", "4", "6", "7", "8"].includes(stateValue);
  const secondary = ["3", "7", "8"].includes(attention);
  const primary = ["2", "6", "8"].includes(attention);
  const eventDate = parseDate(row.Fecha_de_ocurrencia_evento);
  const sirasRequired = Boolean(accident && eventDate && eventDate > new Date(2023, 5, 1));

  const map = {
    accident,
    notAccident: !accident,
    natureOther: nature === "17",
    notNatureOther: nature !== "17",
    poblacionEspecialRequerida: ["AS", "MS"].includes(victimDoc),
    plateRequired: accident && ["2", "4", "6", "7"].includes(stateValue),
    plateBlank: !accident || ["3", "8"].includes(stateValue),
    policyRequired,
    notPolicyRequired: !policyRequired,
    sirasRequired,
    topRequired: accident && stateValue === "6",
    ownerRequired,
    notOwnerRequired: !ownerRequired,
    ownerPersonRequired,
    ownerAddressBlank: !ownerRequired || ownerDoc === "NI",
    driverRequired,
    notDriverRequired: !driverRequired,
    secondaryTransport: secondary,
    notSecondaryTransport: !secondary,
    primaryTransport: primary,
    notPrimaryTransport: !primary,
    procedureService: serviceType === "2",
    nonProcedureService: serviceType !== "2",
    serviceCodeRequired: ["1", "2", "5", "6", "7"].includes(serviceType),
    serviceCodeVisible: !["3", "4", "8"].includes(serviceType),
    serviceCodeBlank: ["3", "4", "8"].includes(serviceType),
    cupsVisible: !["1", "5", "6", "7"].includes(serviceType),
    cupsBlank: ["1", "5", "6", "7"].includes(serviceType)
  };

  return Boolean(map[name]);
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(value))) return null;
  const [year, month, day] = clean(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function toInt(value) {
  const text = clean(value);
  if (!/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

function renderStatus() {
  const total = errors.length;
  globalStatus.textContent = total ? `${total} error(es)` : "Listo";
  sectionList.replaceChildren();

  if (activeTemplate === "fur") {
    const sections = groupVisibleFields(schema.templates.fur.fields, state.fur, 1, "fur");
    Object.keys(sections).forEach((section) => {
      const required = getSectionRequired(section, state.fur, 1, "fur");
      const done = required.filter((field) => clean(state.fur[field.name])).length;
      const chip = document.createElement("div");
      chip.className = "section-chip";
      chip.classList.add(required.length && done === required.length ? "is-ok" : "has-error");
      chip.innerHTML = `<span>${escapeHtml(section)}</span><strong>${done}/${required.length}</strong>`;
      sectionList.append(chip);
    });
    return;
  }

  state.ser.forEach((row, index) => {
    const rowNumber = index + 1;
    const rowErrors = errors.filter((item) => item.row === rowNumber).length;
    const chip = document.createElement("div");
    chip.className = "section-chip";
    chip.classList.add(rowErrors ? "has-error" : "is-ok");
    chip.innerHTML = `<span>Servicio ${rowNumber}</span><strong>${rowErrors ? `${rowErrors} error` : "OK"}</strong>`;
    sectionList.append(chip);
  });
}

async function exportActive() {
  normalizeAll();
  saveState();
  errors = validateActive();
  if (errors.length) {
    showMessage("Corrige los campos marcados antes de exportar.", "error");
    render();
    return;
  }

  const payload = activeTemplate === "fur" ? { row: state.fur } : { rows: state.ser };
  const button = document.querySelector("#export-form");
  button.disabled = true;
  setButtonContent(button, "download", "Exportando...");
  try {
    const response = await fetch(`/api/export/${activeTemplate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await readJsonResponse(response);
      errors = data.errors || [];
      if (response.status === 409 && data.duplicate) {
        showMessage(
          `Factura duplicada: ${data.duplicate.invoiceNumber} ya fue exportada por ${data.duplicate.displayName} el ${formatDateTime(data.duplicate.createdAt)}.`,
          "error"
        );
      } else {
        showMessage(data.errors?.[0]?.message || "El servidor encontro errores de validacion.", "error");
      }
      render();
      return;
    }

    const blob = await response.blob();
    const filename = schema.templates[activeTemplate].file;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage(`Archivo generado: ${filename}`, "ok");
  } catch (err) {
    showMessage(`No se pudo exportar: ${err.message}`, "error");
  } finally {
    button.disabled = false;
    setButtonContent(button, "download", "Exportar Excel");
  }
}

function showMessage(text, kind) {
  message.textContent = text;
  message.className = `message ${kind}`;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
  message.className = "message";
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("El servidor devolvio una pagina en vez de datos. Reinicia la app con .\\run.ps1 y recarga con Ctrl + F5.");
    }
    throw new Error("El servidor devolvio una respuesta que la app no pudo leer.");
  }
}

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeSearch(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeInvoiceNumber(value) {
  const text = clean(value).toUpperCase().replace(/\s+/g, "");
  if (!text) return "";
  if (text.startsWith(INVOICE_PREFIX)) return text;
  return `${INVOICE_PREFIX}${text}`;
}

function roleLabel(role) {
  if (role === "super_admin") return "Super admin";
  return "Facturador";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
