/* MediLink — arranque: estado, navegación entre pantallas e inicio */
const MODE = document.body.dataset.mode; // 'web' o 'mobile' (se define en el <body> de cada index.html)
const LOGO = "../shared/img/logo.png";

/* Estado de la aplicación */
let activeSpec = "Todas",
  activeHosp = "0",
  lastView = "inicio",
  pickedRating = 0;

/* Navegación */
function go(v) {
  if (v !== "perfil") lastView = v;
  document
    .querySelectorAll(".view")
    .forEach((x) => x.classList.remove("active"));
  document.getElementById("view-" + v).classList.add("active");
  const navView = v === "perfil" ? "buscar" : v;
  document
    .querySelectorAll(".nav-item,.bn-item")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === navView));
  const sc = document.querySelector(".phone-scroll");
  if (sc) sc.scrollTop = 0;
  else window.scrollTo(0, 0);
  if (v === "inicio") renderHome();
  if (v === "buscar") {
    renderChips();
    renderHospSelect();
    renderCitySelect();
    renderProfessionals();
  }
  if (v === "ranking") renderRanking();
  if (v === "centros") renderCentros();
  if (v === "turnos") {
    if (API_ENABLED && currentUser) syncAppointments().then(renderAppointments);
    else renderAppointments();
  }
  if (v === "cuenta") renderAccount();
}

/* Menús */
const NAV = [
  ["inicio", "home", "Inicio"],
  ["buscar", "search", "Profesionales"],
  ["turnos", "calendar", "Mis turnos"],
  ["ranking", "star", "Ranking"],
  ["centros", "hosp", "Centros"],
  ["cuenta", "user", "Mi cuenta"],
];
function renderNavigationLabels() {
  document.querySelectorAll(".nav-item").forEach((b) => {
    const item = NAV.find((x) => x[0] === b.dataset.view);
    b.innerHTML = ICON[item[1]] + " " + (item[0] === "cuenta" && currentUser ? "Mi cuenta" : item[2]);
  });
  document.querySelectorAll(".bn-item").forEach((b) => {
    const item = NAV.find((x) => x[0] === b.dataset.view);
    b.innerHTML = ICON[item[1]] + "<span>" + (item[0] === "cuenta" && currentUser ? "Perfil" : item[0] === "buscar" ? "Buscar" : item[2]) + "</span>";
  });
}
document.querySelectorAll(".nav-item").forEach((b) => {
  const n = NAV.find((x) => x[0] === b.dataset.view);
  b.innerHTML = ICON[n[1]] + " " + n[2];
});
document.querySelectorAll(".bn-item").forEach((b) => {
  const n = NAV.find((x) => x[0] === b.dataset.view);
  b.innerHTML =
    ICON[n[1]] + "<span>" + (n[0] === "buscar" ? "Buscar" : n[2]) + "</span>";
});
async function startApp() {
  await initializeApi();
  prepareData();
  renderNavigationLabels();
  go("inicio");
}
startApp();
