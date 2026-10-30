/* MediLink — funciones auxiliares: promedios, horarios, fechas, avisos */

/* Fecha de hoy en formato AAAA-MM-DD (hora local) */
function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
/* "Hace 2 semanas", "Hace 3 meses"... a partir de la fecha guardada en la base */
function timeAgo(iso) {
  const days = Math.floor(
    (new Date(todayISO() + "T00:00:00") - new Date(iso + "T00:00:00")) /
      86400000,
  );
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Hace " + days + " días";
  if (days < 30) {
    const w = Math.floor(days / 7);
    return "Hace " + w + (w === 1 ? " semana" : " semanas");
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return "Hace " + m + (m === 1 ? " mes" : " meses");
  }
  const y = Math.floor(days / 365);
  return "Hace " + y + (y === 1 ? " año" : " años");
}
/* Iniciales para el avatar: "Dra. Marisa Suárez" -> "MS" */
function prepareData() {
  P.forEach((p) => {
    p.initials = p.name.replace(/^(Dr\.|Dra\.)\s*/, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
  });
}

const hosp = (id) => H.find((h) => h.id === id);
const stats = (p) => {
  const n = p.reviews.length;
  const avg = n ? p.reviews.reduce((s, r) => s + r.r, 0) / n : 0;
  return { n, avg };
};
const specs = () => [...new Set(P.map((p) => p.spec))];
const normalizeText = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function isOpen(h) {
  const d = new Date();
  const day = d.getDay();
  const t = d.getHours() + d.getMinutes() / 60;
  return h.hours.some((s) => s.d.includes(day) && t >= s.f && t < s.t);
}
function hoursHtml(h) {
  const rows = h.hours
    .map(
      (s) =>
        `<div class="line">${ICON.clock}<span><b>${s.l}:</b> ${s.x}</span></div>`,
    )
    .join("");
  const dom = h.hours.some((s) => s.d.includes(0))
    ? ""
    : `<div class="line">${ICON.clock}<span><b>Domingos:</b> cerrado</span></div>`;
  return (
    rows +
    dom +
    (h.note
      ? `<div class="line">${ICON.check}<span>${h.note}</span></div>`
      : "")
  );
}
function hospNames(p) {
  const hs = p.hosps.map(hosp);
  return hs[0].name + (hs.length > 1 ? ` +${hs.length - 1}` : "");
}

function toast(m) {
  const t = document.getElementById("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove("show"), 2400);
}

/* Persistencia local del prototipo. Se reemplazará por la API del backend. */
const APPOINTMENTS_KEY = "medilink-appointments";
function getAppointments() {
  if (typeof API_ENABLED !== "undefined" && API_ENABLED && currentUser) return remoteAppointments;
  try { return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY) || "[]"); }
  catch { return []; }
}
function saveAppointments(items) { localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(items)); }
function isoDate(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
function dateLabel(iso) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(iso + "T12:00:00"));
}
function availableDates(p) {
  const dates = [], start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let i = 0; i < 21 && dates.length < 10; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (p.hosps.some((id) => hosp(id).hours.some((slot) => slot.d.includes(d.getDay())))) dates.push(isoDate(d));
  }
  return dates;
}
function availableSlots(profId, hospId, date) {
  const h = hosp(Number(hospId));
  if (!h || !date) return [];
  const day = new Date(date + "T12:00:00").getDay(), slots = [];
  h.hours.filter((slot) => slot.d.includes(day)).forEach((slot) => {
    for (let hour = slot.f; hour < slot.t; hour++) slots.push(`${String(hour).padStart(2, "0")}:00`);
  });
  const used = getAppointments().filter((a) => a.professionalId === profId && a.centerId === Number(hospId) && a.date === date).map((a) => a.time);
  return slots.filter((slot) => !used.includes(slot));
}
function hasAvailableAppointments(p) {
  return availableDates(p).some((date) => p.hosps.some((centerId) => availableSlots(p.id, centerId, date).length > 0));
}
let bookingSlotRequest = 0;
async function renderBookingSlots(profId) {
  const center = document.getElementById("booking-center"), date = document.getElementById("booking-date"), time = document.getElementById("booking-time");
  if (!center || !date || !time) return;
  const requestId = ++bookingSlotRequest;
  const centerId = Number(center.value), requestedDate = date.value;
  time.disabled = true;
  time.innerHTML = '<option value="">Buscando horarios...</option>';
  let slots;
  if (API_ENABLED) {
    try {
      const result = await apiRequest(`/api/availability?professionalId=${profId}&centerId=${centerId}&date=${encodeURIComponent(requestedDate)}`);
      slots = result.slots;
    } catch (error) {
      if (requestId !== bookingSlotRequest) return;
      slots = [];
      toast(error.message);
    }
  } else {
    slots = availableSlots(profId, centerId, requestedDate);
  }
  if (requestId !== bookingSlotRequest || !document.getElementById("booking-time")) return;
  time.disabled = false;
  time.innerHTML = slots.length ? slots.map((slot) => `<option value="${slot}">${slot}</option>`).join("") : '<option value="">No hay horarios disponibles</option>';
}
async function requestAppointment(profId) {
  const center = document.getElementById("booking-center"), date = document.getElementById("booking-date"), time = document.getElementById("booking-time");
  if (!center || !date || !time || !date.value || !time.value) { toast("Elegí un centro, fecha y horario disponible."); return; }
  const booking = { professionalId: profId, centerId: Number(center.value), date: date.value, time: time.value };
  if (API_ENABLED) {
    if (!currentUser) {
      pendingBooking = booking;
      toast("Iniciá sesión o creá una cuenta para solicitar el turno.");
      go("cuenta");
      return;
    }
    await sendAppointment(booking);
    return;
  }
  const appointments = getAppointments();
  if (appointments.some((a) => a.professionalId === profId && a.centerId === Number(center.value) && a.date === date.value && a.time === time.value)) {
    toast("Ese horario ya no está disponible."); renderBookingSlots(profId); return;
  }
  appointments.push({ id: Date.now(), ...booking, status: "Solicitado", createdAt: todayISO() });
  saveAppointments(appointments);
  toast("Solicitud de turno registrada.");
  go("turnos");
}
function renderAppointments() {
  const target = document.getElementById("appointments-list");
  if (!target) return;
  const items = getAppointments().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  target.innerHTML = items.length ? items.map((a) => {
    const p = P.find((item) => item.id === a.professionalId), h = hosp(a.centerId);
    const statusText = { solicitado: "Solicitado", confirmado: "Confirmado", rechazado: "Rechazado", atendido: "Atendido", cancelado: "Cancelado" }[a.status] || a.status;
    const reviewAction = a.status === "atendido" && !a.hasReview && currentUser?.rol === "paciente" ? `<button class="btn-outline" type="button" onclick="reviewAppointment(${a.id}, ${a.professionalId})">Dejar reseña</button>` : "";
    const statusActions = API_ENABLED && ["profesional", "admin"].includes(currentUser?.rol)
      ? (a.status === "solicitado" ? `<button class="btn-outline" type="button" onclick="updateAppointmentStatus(${a.id}, 'confirmado')">Confirmar</button><button class="btn-outline" type="button" onclick="updateAppointmentStatus(${a.id}, 'rechazado')">Rechazar</button>` : a.status === "confirmado" ? `<button class="btn-outline" type="button" onclick="updateAppointmentStatus(${a.id}, 'atendido')">Marcar atendido</button>` : "")
      : "";
    return `<article class="appointment-card"><div><span class="badge ${a.status === "rechazado" || a.status === "cancelado" ? "badge-closed" : "badge-open"}">${escapeHTML(statusText)}</span><h3>${escapeHTML(p ? p.name : "Profesional no disponible")}</h3><p>${escapeHTML(p ? p.spec : "")} · ${escapeHTML(h ? h.name : "Centro no disponible")}</p><p class="appointment-date">${escapeHTML(dateLabel(a.date))} · ${escapeHTML(a.time)}${a.patientName ? ` · ${escapeHTML(a.patientName)}` : ""}</p></div><div class="appointment-actions"><button class="btn-outline" type="button" onclick="openProfile(${a.professionalId})">Ver perfil</button>${reviewAction}${statusActions}</div></article>`;
  }).join("") : '<div class="card empty-state"><p class="h-sub">Todavía no tenés turnos solicitados.</p><button class="btn-primary" onclick="go(\'buscar\')">Buscar un profesional</button></div>';
}
async function updateAppointmentStatus(id, status) {
  try {
    await apiRequest(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await syncAppointments();
    renderAppointments();
    toast("Estado del turno actualizado.");
  } catch (error) { toast(error.message); }
}
