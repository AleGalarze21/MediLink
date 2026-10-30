/* Cliente HTTP opcional. Sin servidor, el prototipo conserva el modo local. */
let API_ENABLED = false;
let currentUser = null;
let remoteAppointments = [];
let pendingBooking = null;
let reviewingAppointmentId = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud.");
  return payload;
}

async function initializeApi() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const [catalog, session] = await Promise.all([apiRequest("/api/catalog"), apiRequest("/api/auth/me")]);
    H = catalog.centers;
    P = catalog.professionals;
    currentUser = session.user;
    API_ENABLED = true;
    await syncAppointments();
  } catch {
    API_ENABLED = false;
  }
}

async function syncAppointments() {
  if (!API_ENABLED || !currentUser) return;
  try {
    const data = await apiRequest("/api/appointments");
    remoteAppointments = data.appointments.map((row) => ({
      id: row.id,
      professionalId: row.profesional_id,
      centerId: row.centro_id,
      date: row.fecha,
      time: row.hora,
      status: row.estado,
      patientName: row.paciente,
      hasReview: Boolean(row.tiene_resena),
    }));
    renderNavigationLabels();
  } catch (error) {
    toast(error.message);
  }
}

async function submitAuth(mode) {
  const name = document.getElementById("account-name")?.value.trim();
  const email = document.getElementById("account-email")?.value.trim();
  const password = document.getElementById("account-password")?.value || "";
  const button = document.getElementById("account-submit");
  if (!API_ENABLED) {
    toast("Para usar cuentas, iniciá MediLink con npm run dev.");
    return;
  }
  if (button) button.disabled = true;
  try {
    const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const user = await apiRequest(path, { method: "POST", body: JSON.stringify({ name, email, password }) });
    currentUser = user.user;
    await syncAppointments();
    renderNavigationLabels();
    renderAccount();
    if (pendingBooking) {
      const booking = pendingBooking;
      pendingBooking = null;
      await sendAppointment(booking);
    } else {
      toast("Sesión iniciada.");
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderAccount() {
  const target = document.getElementById("account-content");
  if (!target) return;
  if (!API_ENABLED) {
    target.innerHTML = '<div class="card empty-state"><h2>Activá el servidor de MediLink</h2><p class="h-sub">Para crear una cuenta y guardar turnos en la base de datos, ejecutá <code>npm run dev</code> desde la carpeta del proyecto.</p></div>';
    return;
  }
  if (!currentUser) {
    target.innerHTML = `<div class="account-card card"><div><p class="eyebrow">Tu espacio MediLink</p><h2>Ingresá o creá tu cuenta</h2><p class="h-sub">Guardá tus turnos y recibí avisos sobre tus consultas.</p></div>
      <div class="auth-tabs"><button class="chip active" type="button" id="login-tab" aria-pressed="true" onclick="renderAuthForm('login')">Iniciar sesión</button><button class="chip" type="button" id="register-tab" aria-pressed="false" onclick="renderAuthForm('register')">Crear cuenta</button></div>
      <div id="auth-form"></div></div>`;
    renderAuthForm("login");
    return;
  }
  target.innerHTML = `<div class="account-card card"><div class="account-heading"><div class="p-avatar" aria-hidden="true">${escapeHTML((currentUser.nombre || "P").slice(0, 1).toUpperCase())}</div><div><p class="eyebrow">${escapeHTML(currentUser.rol)}</p><h2>${escapeHTML(currentUser.nombre)}</h2><p class="h-sub">${escapeHTML(currentUser.email)}</p></div><button class="btn-outline" type="button" onclick="logout()">Cerrar sesión</button></div>
    <div class="account-section"><h3>Mis avisos</h3><div id="notifications-list" class="account-list"><p class="muted">Cargando avisos…</p></div></div>
    ${currentUser.rol === "paciente" ? '<div class="account-section"><h3>Mis resultados</h3><div id="documents-list" class="account-list"><p class="muted">Cargando documentos…</p></div><div id="document-view"></div></div>' : '<div class="account-section"><p class="h-sub">Usá Mis turnos para consultar y actualizar tu agenda.</p></div>'}</div>`;
  loadAccountDetails();
}

function renderAuthForm(mode) {
  const target = document.getElementById("auth-form");
  if (!target) return;
  const loginTab = document.getElementById("login-tab"), registerTab = document.getElementById("register-tab");
  if (loginTab) { loginTab.classList.toggle("active", mode === "login"); loginTab.setAttribute("aria-pressed", String(mode === "login")); }
  if (registerTab) { registerTab.classList.toggle("active", mode === "register"); registerTab.setAttribute("aria-pressed", String(mode === "register")); }
  target.innerHTML = `${mode === "register" ? '<label class="field-label" for="account-name">Nombre y apellido</label><input class="field" id="account-name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Tu nombre completo">' : ""}
    <label class="field-label" for="account-email">Correo electrónico</label><input class="field" id="account-email" type="email" autocomplete="email" required maxlength="254" placeholder="nombre@correo.com">
    <label class="field-label" for="account-password">Contraseña</label><input class="field" id="account-password" type="password" autocomplete="${mode === "register" ? "new-password" : "current-password"}" required minlength="10" maxlength="200" placeholder="Mínimo 10 caracteres">
    <button class="btn-primary" id="account-submit" type="button" onclick="submitAuth('${mode}')">${mode === "register" ? "Crear cuenta de paciente" : "Iniciar sesión"}</button>`;
}

async function logout() {
  try { await apiRequest("/api/auth/logout", { method: "POST", body: "{}" }); }
  finally { currentUser = null; remoteAppointments = []; renderNavigationLabels(); renderAccount(); toast("Sesión cerrada."); }
}

async function loadAccountDetails() {
  try {
    const notifications = await apiRequest("/api/notifications");
    const documents = currentUser.rol === "paciente" ? await apiRequest("/api/documents") : { documents: [] };
    const noticeTarget = document.getElementById("notifications-list"), docsTarget = document.getElementById("documents-list");
    if (noticeTarget) noticeTarget.innerHTML = notifications.notifications.length ? notifications.notifications.map((notice) => `<article class="account-row"><span class="notice-dot ${notice.leida ? "read" : ""}"></span><div><b>${escapeHTML(notice.titulo)}</b><p>${escapeHTML(notice.mensaje)}</p><small>${escapeHTML(notice.creada_en)}</small></div>${notice.leida ? "" : `<button class="mini-chip" type="button" onclick="markNotificationRead(${notice.id})">Marcar leído</button>`}</article>`).join("") : '<p class="muted">Todavía no tenés avisos.</p>';
    if (docsTarget) docsTarget.innerHTML = documents.documents.length ? documents.documents.map((doc) => `<article class="account-row"><span class="document-icon">▤</span><div><b>${escapeHTML(doc.titulo)}</b><p>${escapeHTML(doc.tipo)} · ${escapeHTML(doc.profesional)}</p><small>${escapeHTML(doc.creado_en)}</small></div><button class="mini-chip" type="button" onclick="viewPatientDocument(${doc.id})">Consultar</button></article>`).join("") : '<p class="muted">Todavía no hay resultados o documentos asociados a tus consultas.</p>';
  } catch (error) { toast(error.message); }
}

async function markNotificationRead(id) {
  try { await apiRequest(`/api/notifications/${id}`, { method: "PATCH", body: "{}" }); await loadAccountDetails(); }
  catch (error) { toast(error.message); }
}

async function viewPatientDocument(id) {
  try {
    const data = await apiRequest(`/api/documents/${id}`);
    const target = document.getElementById("document-view");
    if (!target) return;
    target.innerHTML = `<article class="document-view card"><div class="document-view-heading"><div><p class="eyebrow">${escapeHTML(data.document.tipo)}</p><h3>${escapeHTML(data.document.titulo)}</h3><p class="muted">${escapeHTML(data.document.profesional)} · ${escapeHTML(data.document.creado_en)}</p></div><button class="btn-outline" type="button" onclick="document.getElementById('document-view').replaceChildren()">Cerrar</button></div><pre>${escapeHTML(data.document.contenido || "Este documento no contiene texto de demostración.")}</pre></article>`;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { toast(error.message); }
}

async function sendAppointment(booking) {
  try {
    await apiRequest("/api/appointments", { method: "POST", body: JSON.stringify(booking) });
    await syncAppointments();
    toast("Solicitud de turno registrada.");
    go("turnos");
  } catch (error) { toast(error.message); }
}

function reviewAppointment(appointmentId, professionalId) {
  reviewingAppointmentId = appointmentId;
  openProfile(professionalId);
}

async function submitVerifiedReview(professionalId, rating, comment) {
  if (!currentUser) {
    toast("Iniciá sesión para publicar tu reseña.");
    go("cuenta");
    return;
  }
  if (!reviewingAppointmentId) {
    toast("Las reseñas se habilitan desde un turno atendido en Mis turnos.");
    go("turnos");
    return;
  }
  try {
    await apiRequest("/api/reviews", { method: "POST", body: JSON.stringify({ appointmentId: reviewingAppointmentId, rating, comment }) });
    const catalog = await apiRequest("/api/catalog");
    P = catalog.professionals;
    prepareData();
    reviewingAppointmentId = null;
    toast("Gracias por compartir tu experiencia.");
    openProfile(professionalId);
  } catch (error) { toast(error.message); }
}
