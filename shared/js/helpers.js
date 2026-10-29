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
P.forEach((p) => {
  p.initials = p.name
    .replace(/^(Dr\.|Dra\.)\s*/, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
});

const hosp = (id) => H.find((h) => h.id === id);
const stats = (p) => {
  const n = p.reviews.length;
  const avg = n ? p.reviews.reduce((s, r) => s + r.r, 0) / n : 0;
  return { n, avg };
};
const specs = () => [...new Set(P.map((p) => p.spec))];
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
