/* MediLink — pantallas: tarjetas, inicio, búsqueda, ranking, centros y perfil */
function profCard(p, rank) {
  const s = stats(p);
  return `<button class="prof-card" onclick="openProfile(${p.id})">
    ${rank ? `<span class="rank">${rank}</span>` : ""}
    <div class="p-avatar" style="background:${BG[p.bg][0]};color:${BG[p.bg][1]};">${p.initials}</div>
    <div class="pc-body">
      <div class="p-name">${p.name}</div>
      <div class="p-spec">${p.spec}</div>
      <div class="p-meta"><span class="stars">★</span> <b>${s.avg.toFixed(1)}</b> (${s.n} opiniones)</div>
      <div class="p-meta">${ICON.hosp.replace('class="icon"', 'class="icon ic-s"')} ${hospNames(p)}</div>
      <div class="p-meta">${ICON.pin} ${p.city}</div>
    </div>${ICON.chev}</button>`;
}

function renderHome() {
  const top = [...P].sort((a, b) => stats(b).avg - stats(a).avg).slice(0, 3);
  const totalRv = P.reduce((s, p) => s + p.reviews.length, 0);
  const specGrid = specs()
    .map(
      (s) =>
        `<button class="spec-pill" onclick="quickSpec('${s}')">${s}<small>${P.filter((p) => p.spec === s).length} ${P.filter((p) => p.spec === s).length === 1 ? "profesional" : "profesionales"}</small></button>`,
    )
    .join("");
  const how = `<div class="how">
    <div class="how-item"><div class="how-i" style="background:var(--green-l);color:var(--green-d);">${ICON.search}</div><span>Buscás por nombre, especialidad, hospital o ciudad</span></div>
    <div class="how-item"><div class="how-i" style="background:var(--blue-l);color:var(--blue-d);">${ICON.star}</div><span>Mirás dónde atiende y qué opinan otros pacientes</span></div>
    <div class="how-item"><div class="how-i" style="background:var(--mint-l);color:var(--mint-d);">${ICON.phone.replace("ic-s", "")}</div><span>Llamás al hospital para sacar turno</span></div></div>`;
  const topList = `<div class="prof-list">${top.map((p, i) => profCard(p, i + 1)).join("")}</div>`;
  if (MODE === "web") {
    document.getElementById("home-content").innerHTML = `
      <div class="hero"><h1>Encontrá al profesional de salud indicado para vos</h1>
        <p>Mirá dónde atiende, qué tan bien lo valoran otros pacientes y a qué teléfono llamar</p>
        <div class="hero-search">${ICON.search}<input id="hero-input" placeholder="Ej: Cardiología, Dr. Pérez, Hospital San Martín..." onkeydown="if(event.key==='Enter')heroSearch()"><button onclick="heroSearch()">Buscar</button></div>
        <div class="spec-grid">${specGrid}</div></div>
      <div class="stat-row"><div class="stat"><b>${P.length}</b><span>Profesionales</span></div><div class="stat"><b>${H.length}</b><span>Centros de atención</span></div><div class="stat"><b>${totalRv}</b><span>Opiniones de pacientes</span></div></div>
      <p class="section-title">Mejor valorados</p>${topList}
      <p class="section-title">Cómo funciona MediLink</p>${how}`;
  } else {
    document.getElementById("home-content").innerHTML = `
      <img class="m-logo" src="${LOGO}" alt="MediLink"><p class="h-greet">Hola 👋</p><p class="h-sub">¿A qué profesional buscás hoy?</p>
      <div class="search-bar" style="margin-top:14px;">${ICON.search}<input id="hero-input" placeholder="Nombre, especialidad, hospital..." onkeydown="if(event.key==='Enter')heroSearch()"></div>
      <p class="section-title">Especialidades</p><div class="spec-grid" style="grid-template-columns:1fr 1fr;">${specGrid}</div>
      <p class="section-title">Mejor valorados</p>${topList}
      <p class="section-title">Cómo funciona</p>${how}`;
  }
}
function heroSearch() {
  document.getElementById("search-input").value =
    document.getElementById("hero-input").value;
  activeSpec = "Todas";
  activeHosp = "0";
  const city = document.getElementById("city-select");
  if (city) city.value = "all";
  go("buscar");
}
function quickSpec(s) {
  document.getElementById("search-input").value = "";
  activeSpec = s;
  activeHosp = "0";
  const city = document.getElementById("city-select");
  if (city) city.value = "all";
  go("buscar");
}

function renderChips() {
  document.getElementById("chip-row").innerHTML = ["Todas", ...specs()]
    .map(
      (s) =>
        `<button class="chip ${s === activeSpec ? "active" : ""}" onclick="setSpec('${s}')">${s}</button>`,
    )
    .join("");
}
function setSpec(s) {
  activeSpec = s;
  renderChips();
  renderProfessionals();
}
function renderHospSelect() {
  document.getElementById("hosp-select").innerHTML =
    '<option value="0">Todos los centros</option>' +
    H.map(
      (h) =>
        `<option value="${h.id}" ${String(h.id) === activeHosp ? "selected" : ""}>${h.name}</option>`,
    ).join("");
}
function renderCitySelect() {
  const select = document.getElementById("city-select");
  if (!select) return;
  const selected = select.value || "all";
  select.innerHTML = '<option value="all">Todas</option>' + [...new Set(P.map((p) => p.city))].sort((a, b) => a.localeCompare(b, "es")).map((city) => `<option value="${city}">${city}</option>`).join("");
  select.value = [...select.options].some((option) => option.value === selected) ? selected : "all";
}

function renderProfessionals() {
  const term = normalizeText(document.getElementById("search-input").value.trim());
  const sort = document.getElementById("sort-select").value;
  const city = document.getElementById("city-select").value;
  const minRating = Number(document.getElementById("rating-select").value);
  const availability = document.getElementById("availability-select").value;
  let list = P.filter(
    (p) =>
      (activeSpec === "Todas" || p.spec === activeSpec) &&
      (activeHosp === "0" || p.hosps.includes(Number(activeHosp))) &&
      (city === "all" || p.city === city) &&
      (!minRating || stats(p).avg >= minRating) &&
      (availability !== "available" || hasAvailableAppointments(p)) &&
      (!term ||
        [p.name, p.spec, p.city, ...p.hosps.map((i) => hosp(i).name)]
          .join(" ")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
          .includes(term)),
  );
  list.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "count"
        ? stats(b).n - stats(a).n
        : stats(b).avg - stats(a).avg,
  );
  document.getElementById("result-count").textContent = `${list.length} ${list.length === 1 ? "profesional encontrado" : "profesionales encontrados"}`;
  document.getElementById("prof-list").innerHTML =
    list.map((p) => profCard(p)).join("") ||
    '<p class="muted">Sin resultados para esta búsqueda.</p>';
}
function renderRanking() {
  document.getElementById("rank-list").innerHTML = [...P]
    .sort((a, b) => stats(b).avg - stats(a).avg || stats(b).n - stats(a).n)
    .map((p, i) => profCard(p, i + 1))
    .join("");
}

function hospCard(h, withPros) {
  const open = isOpen(h);
  const pros = P.filter((p) => p.hosps.includes(h.id));
  return `<div class="hosp-card">
    <div class="hosp-head"><span class="hosp-name">${h.name}</span><span class="badge ${open ? "badge-open" : "badge-closed"}">${open ? "Abierto ahora" : "Cerrado ahora"}</span></div>
    <div class="line">${ICON.pin}<span>${h.addr}, ${h.city}</span></div>
    ${hoursHtml(h)}
    <a class="btn-primary" href="tel:${h.phone.replace(/\D/g, "")}">Llamar para sacar turno · ${h.phone}</a>
    ${withPros ? `<p class="muted" style="margin-top:14px;">Profesionales que atienden acá</p><div class="mini-chips">${pros.map((p) => `<button class="mini-chip" onclick="openProfile(${p.id})">${p.name} · ${p.spec}</button>`).join("")}</div>` : ""}
  </div>`;
}
function bookingCard(p) {
  const dates = availableDates(p), firstDate = dates[0] || "";
  return `<div class="card booking-card"><p class="section-title" style="margin:0 0 12px;">Solicitar un turno</p>
    <p class="muted">Elegí un centro, una fecha y un horario disponible.</p>
    <div class="booking-fields">
      <label>Centro<select class="sel" id="booking-center" onchange="renderBookingSlots(${p.id})">${p.hosps.map((id) => `<option value="${id}">${hosp(id).name}</option>`).join("")}</select></label>
      <label>Fecha<select class="sel" id="booking-date" onchange="renderBookingSlots(${p.id})">${dates.map((d) => `<option value="${d}">${dateLabel(d)}</option>`).join("") || '<option value="">Sin fechas disponibles</option>'}</select></label>
      <label>Horario<select class="sel" id="booking-time"></select></label>
    </div>
    <button class="btn-primary" onclick="requestAppointment(${p.id})">Solicitar turno</button>
  </div>`;
}
function renderCentros() {
  document.getElementById("centros-list").innerHTML = H.map((h) =>
    hospCard(h, true),
  ).join("");
}

function openProfile(id) {
  const p = P.find((x) => x.id === id),
    s = stats(p);
  pickedRating = 0;
  const dist = [5, 4, 3, 2, 1]
    .map((n) => {
      const c = p.reviews.filter((r) => r.r === n).length;
      const pct = s.n ? Math.round((c * 100) / s.n) : 0;
      return `<div class="bar-row"><span style="width:12px;">${n}</span><span class="stars">★</span><div class="bar"><span style="width:${pct}%;"></span></div><span style="width:22px;text-align:right;">${c}</span></div>`;
    })
    .join("");
  const rvHtml = p.reviews
    .map(
      (r) =>
        `<div class="review-line"><div class="rv-top"><span>${escapeHTML(r.a)}</span><span><span class="stars">${"★".repeat(r.r)}</span><span style="color:var(--border);">${"★".repeat(5 - r.r)}</span></span></div><div class="rv-when">${timeAgo(r.d)}</div><p class="rv-text">${escapeHTML(r.t)}</p></div>`,
    )
    .join("");
  document.getElementById("view-perfil").innerHTML = `
    <button class="back-btn" onclick="go(lastView)">${ICON.arrow} Volver</button>
    <div class="profile-wrap">
      <div class="profile-head">
        <div class="p-avatar" style="background:${BG[p.bg][0]};color:${BG[p.bg][1]};">${p.initials}</div>
        <p class="p-name" style="font-size:18px;">${p.name}</p>
        <p class="p-spec" style="margin:3px 0 10px;font-size:13.5px;">${p.spec}</p>
        <span class="verified">${ICON.check} Profesional verificado</span>
        <div style="margin-top:16px;"><span class="big-rating">${s.avg.toFixed(1)}</span> <span class="stars" style="font-size:20px;">★</span></div>
        <p class="muted" style="margin-top:4px;">${s.n} opiniones de pacientes</p>
        <div style="width:100%;margin-top:14px;">${dist}</div>
        <div class="line" style="margin-top:16px;">${ICON.pin}<span><b>Ciudad:</b> ${p.city}</span></div>
        <div class="line">${ICON.cap}<span><b>Experiencia:</b> ${p.exp} años</span></div>
      </div>
      <div>
        <p class="section-title where-title">Dónde atiende</p>
        <div style="display:grid;gap:12px;">${p.hosps.map((i) => hospCard(hosp(i), false)).join("")}</div>
         ${bookingCard(p)}
        <p class="section-title">Opiniones de pacientes</p>
        <div class="card">${rvHtml}</div>
        <p class="section-title">Dejá tu opinión</p>
        <div class="card">
          <input class="field" id="rv-name" placeholder="Tu nombre (opcional)">
          <div class="rf-stars" id="rf-stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="rf-star" onclick="setRating(${n})">★</button>`).join("")}</div>
          <textarea class="field" id="rv-text" placeholder="Contá tu experiencia con este profesional..."></textarea>
          <p class="err" id="rv-err">Elegí una puntuación y escribí un comentario.</p>
          <button class="btn-outline" onclick="submitReview(${p.id})">Publicar opinión</button>
        </div>
      </div>
    </div>`;
  go("perfil");
  renderBookingSlots(id);
}
function setRating(n) {
  pickedRating = n;
  document
    .querySelectorAll(".rf-star")
    .forEach((b, i) => b.classList.toggle("on", i < n));
  document.getElementById("rv-err").style.display = "none";
}
function submitReview(id) {
  const t = document.getElementById("rv-text").value.trim();
  if (!pickedRating || !t) {
    document.getElementById("rv-err").style.display = "block";
    return;
  }
  const n = document.getElementById("rv-name").value.trim() || "Anónimo";
  P.find((x) => x.id === id).reviews.unshift({
    a: n,
    r: pickedRating,
    t: t,
    d: todayISO(),
  });
  toast("¡Gracias por tu opinión!");
  openProfile(id);
}
