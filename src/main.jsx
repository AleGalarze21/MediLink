import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api.js";
import "../shared/css/base.css";
import "./app.css";

const isMobile = window.location.pathname.startsWith("/mobile");
const logo = "/shared/img/logo.png";
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (value) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
const initials = (name) => name.replace(/^(Dr\.|Dra\.)\s*/, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
const average = (professional) => professional.reviews.length ? professional.reviews.reduce((sum, review) => sum + review.r, 0) / professional.reviews.length : 0;
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

function App() {
  const [catalog, setCatalog] = useState({ professionals: [], centers: [] });
  const [page, setPage] = useState("inicio");
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("Todas");
  const [city, setCity] = useState("Todas");
  const [centerFilter, setCenterFilter] = useState("Todos");
  const [rating, setRating] = useState("0");
  const [sort, setSort] = useState("rating");
  const [availability, setAvailability] = useState("any");
  const [availableIds, setAvailableIds] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [pendingBooking, setPendingBooking] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [data, session] = await Promise.all([api.getCatalog(), api.getUser()]);
        if (!active) return;
        setCatalog(data);
        setUser(session.user);
        if (session.user?.rol === "paciente") {
          const result = await api.getAppointments();
          if (active) setAppointments(result.appointments);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "No se pudo conectar con el servidor.");
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (availability !== "available") { setAvailableIds(null); return undefined; }
    let active = true;
    setAvailabilityLoading(true);
    async function loadAvailabilitySummary() {
      try {
        const result = await api.getAvailabilitySummary();
        if (active) setAvailableIds(new Set(result.professionalIds));
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally { if (active) setAvailabilityLoading(false); }
    }
    loadAvailabilitySummary();
    return () => { active = false; };
  }, [availability]);

  const specialties = useMemo(() => ["Todas", ...new Set(catalog.professionals.map((person) => person.spec))], [catalog.professionals]);
  const cities = useMemo(() => ["Todas", ...new Set(catalog.professionals.map((person) => person.city).filter(Boolean))], [catalog.professionals]);
  const professionals = useMemo(() => {
    const filtered = catalog.professionals.filter((person) => {
      const centerNames = person.hosps.map((id) => catalog.centers.find((item) => item.id === id)?.name || "").join(" ");
      return (specialty === "Todas" || person.spec === specialty)
        && (city === "Todas" || person.city === city)
        && (centerFilter === "Todos" || person.hosps.includes(Number(centerFilter)))
        && (!rating || average(person) >= Number(rating))
        && (availability !== "available" || !availableIds || availableIds.has(person.id))
        && (!query || normalize([person.name, person.spec, person.city, centerNames].join(" ")).includes(normalize(query)));
    });
    return filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "es") : sort === "count" ? b.reviews.length - a.reviews.length : average(b) - average(a));
  }, [catalog.professionals, catalog.centers, specialty, city, centerFilter, rating, query, sort, availability, availableIds]);

  function navigate(nextPage) { setPage(nextPage); setError(""); }
  function openProfile(person) { setSelected(person); navigate("perfil"); }
  function flash(message) { setToast(message); }

  async function submitAuth(formData) {
    try {
      const response = formData.mode === "register"
        ? await api.register({ name: formData.name, email: formData.email, password: formData.password })
        : await api.login({ email: formData.email, password: formData.password });
      setUser(response.user);
      setError("");
      if (response.user.rol === "paciente") {
        const result = await api.getAppointments();
        setAppointments(result.appointments);
      }
      if (pendingBooking) {
        const booking = pendingBooking;
        setPendingBooking(null);
        await createBooking(booking, response.user);
      } else {
        flash("Sesión iniciada.");
      }
    } catch (authError) { setError(authError.message); }
  }

  async function createBooking(booking, activeUser = user) {
    if (!activeUser) {
      setPendingBooking(booking);
      navigate("cuenta");
      flash("Iniciá sesión o creá una cuenta para pedir el turno.");
      return;
    }
    try {
      await api.createAppointment(booking);
      const result = await api.getAppointments();
      setAppointments(result.appointments);
      flash("Solicitud de turno registrada.");
      navigate("turnos");
    } catch (bookingError) { setError(bookingError.message); }
  }

  async function signOut() {
    try { await api.logout(); } finally { setUser(null); setAppointments([]); navigate("inicio"); flash("Sesión cerrada."); }
  }

  const content = loading ? <div className="react-loading"><span className="spinner" /> Cargando MediLink…</div>
    : error && !catalog.professionals.length ? <div className="react-error"><h2>No pudimos conectar con MediLink</h2><p>{error}</p><p>Iniciá el servidor con <code>npm run dev</code>.</p></div>
      : page === "inicio" ? <Home catalog={catalog} onSearch={(value) => { setQuery(value); navigate("buscar"); }} onSpecialty={(value) => { setSpecialty(value); setQuery(""); navigate("buscar"); }} onProfile={openProfile} />
          : page === "buscar" ? <Search catalog={catalog} professionals={professionals} specialties={specialties} cities={cities} values={{ query, specialty, city, centerFilter, rating, sort, availability }} set={{ setQuery, setSpecialty, setCity, setCenterFilter, setRating, setSort, setAvailability }} availabilityLoading={availabilityLoading} onProfile={openProfile} onReset={() => { setQuery(""); setSpecialty("Todas"); setCity("Todas"); setCenterFilter("Todos"); setRating("0"); setSort("rating"); setAvailability("any"); }} />
          : page === "perfil" && selected ? <Profile person={selected} catalog={catalog} user={user} onBook={createBooking} onBack={() => navigate("buscar")} onLogin={() => { setPendingBooking(null); navigate("cuenta"); }} />
            : page === "turnos" ? <Appointments appointments={appointments} catalog={catalog} user={user} onLogin={() => navigate("cuenta")} />
              : <Account user={user} error={error} onAuth={submitAuth} onLogout={signOut} />;

  const nav = <nav className={isMobile ? "mobile-tabs" : "desktop-nav"} aria-label="Navegación principal">
    {[["inicio", "⌂", "Inicio"], ["buscar", "⌕", "Buscar profesionales"], ["turnos", "▣", "Mis turnos"], ["cuenta", "◉", user ? "Mi cuenta" : "Ingresar"]].map(([id, icon, label]) => <button key={id} className={`nav-button ${page === id ? "selected" : ""}`} type="button" onClick={() => navigate(id)}><span aria-hidden="true">{icon}</span><span>{label}</span></button>)}
  </nav>;

  const app = <>
    {!isMobile && <header className="react-topbar"><img src={logo} alt="MediLink" /><div className="topbar-search" role="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && navigate("buscar")} placeholder="Buscar profesionales, especialidades…" aria-label="Buscar profesionales" /></div><div className="topbar-user">{user ? <><span className="user-avatar">{initials(user.nombre)}</span><span>{user.nombre}</span></> : <button className="text-action" onClick={() => navigate("cuenta")}>Ingresar</button>}</div></header>}
    <div className={isMobile ? "mobile-app-shell" : "desktop-app-shell"}>
      {!isMobile && <aside className="react-sidebar"><img className="sidebar-logo" src={logo} alt="MediLink — Conectando tu salud" /><p className="nav-caption">MEDILINK</p>{nav}<div className="sidebar-note">Encontrá atención de salud con más confianza.</div></aside>}
      <div className="react-main-column">
        {isMobile && <div className="mobile-status"><span>9:41</span><span>●●● ▰</span></div>}
        <main className={isMobile ? "react-main mobile-main" : "react-main"}>
          {error && catalog.professionals.length > 0 && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Cerrar</button></div>}
          {content}
        </main>
        {isMobile ? <>{nav}<div className="mobile-home-indicator" /></> : <footer className="react-footer">MediLink · Conectando tu salud</footer>}
      </div>
    </div>
    {toast && <div className="react-toast" role="status">{toast}</div>}
  </>;
  return isMobile ? <div className="phone-frame-react"><div className="phone-screen-react">{app}</div></div> : app;
}

function Home({ catalog, onSearch, onSpecialty, onProfile }) {
  const top = [...catalog.professionals].sort((a, b) => average(b) - average(a)).slice(0, 3);
  const queryRef = React.useRef(null);
  const specialties = [...new Set(catalog.professionals.map((person) => person.spec))].slice(0, 6);
  return <div className="page-content">
    <section className="hero-panel"><p className="eyebrow">CONECTANDO TU SALUD</p><h1>Encontrá al profesional indicado para vos</h1><p className="lead">Buscá especialistas, conocé dónde atienden y elegí el horario que te quede cómodo.</p>
      <form className="hero-form" onSubmit={(event) => { event.preventDefault(); onSearch(queryRef.current?.value || ""); }}><span>⌕</span><input ref={queryRef} type="search" placeholder="Ej.: Cardiología, Dra. Pérez, Ciudad…" aria-label="Buscar profesionales"/><button className="button-primary">Buscar</button></form>
      <div className="hero-specialties">{specialties.map((item) => <button key={item} type="button" onClick={() => onSpecialty(item)}>{item}<span>→</span></button>)}</div>
    </section>
    <section className="stats-grid"><Stat value={catalog.professionals.length} label="Profesionales"/><Stat value={catalog.centers.length} label="Centros de atención"/><Stat value={catalog.professionals.reduce((sum, person) => sum + person.reviews.length, 0)} label="Opiniones publicadas"/></section>
    <SectionHeading title="Profesionales mejor valorados" subtitle="Opiniones de pacientes para ayudarte a elegir" action="Explorar todos" onAction={() => onSearch("")}/>
    <div className="professional-grid">{top.map((person) => <ProfessionalCard key={person.id} person={person} centers={catalog.centers} onClick={() => onProfile(person)}/>)}</div>
  </div>;
}

function Stat({ value, label }) { return <div className="stat-card"><strong>{value.toLocaleString("es-AR")}</strong><span>{label}</span></div>; }
function SectionHeading({ title, subtitle, action, onAction }) { return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="text-action" onClick={onAction}>{action} →</button>}</div>; }

function ProfessionalCard({ person, centers, onClick }) {
  const linkedCenters = person.hosps.map((id) => centers.find((center) => center.id === id)?.name).filter(Boolean);
  const score = average(person);
  return <button type="button" className="professional-card" onClick={onClick}>
    <div className={`professional-avatar avatar-${person.bg || "green"}`}>{initials(person.name)}</div>
    <div className="professional-info"><div className="professional-title"><h3>{person.name}</h3>{person.verified && <span className="verified-badge">✓ Verificado</span>}</div><p className="professional-specialty">{person.spec}</p>
      <div className="professional-meta"><span className="rating-star">★</span><b>{score.toFixed(1)}</b><span>({person.reviews.length} opiniones)</span><span className="meta-divider">·</span><span>{person.exp} años de experiencia</span></div>
      <div className="professional-centers">{linkedCenters.slice(0, 2).map((name) => <span key={name}>⌂ {name}</span>)}</div><p className="professional-city">⌖ {person.city}</p>
    </div><span className="card-arrow" aria-hidden="true">›</span>
  </button>;
}

function Search({ catalog, professionals, specialties, cities, values, set, availabilityLoading, onProfile, onReset }) {
  return <div className="page-content"><SectionHeading title="Buscar profesionales" subtitle="Encontrá al especialista indicado según tu necesidad."/>
    <section className="filter-panel"><label className="search-field"><span>⌕</span><input type="search" value={values.query} onChange={(e) => set.setQuery(e.target.value)} placeholder="Nombre, especialidad, centro o ciudad…" /></label>
      <div className="filter-controls"><label>Especialidad<select value={values.specialty} onChange={(e) => set.setSpecialty(e.target.value)}>{specialties.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Ciudad<select value={values.city} onChange={(e) => set.setCity(e.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Centro<select value={values.centerFilter} onChange={(e) => set.setCenterFilter(e.target.value)}><option>Todos</option>{catalog.centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>
        <label>Valoración<select value={values.rating} onChange={(e) => set.setRating(e.target.value)}><option value="0">Cualquiera</option><option value="4">4 o más</option><option value="4.5">4,5 o más</option></select></label>
        <label>Disponibilidad<select value={values.availability} onChange={(e) => set.setAvailability(e.target.value)}><option value="any">Cualquier fecha</option><option value="available">Con turnos en 14 días</option></select></label>
        <label>Ordenar por<select value={values.sort} onChange={(e) => set.setSort(e.target.value)}><option value="rating">Mejor valorados</option><option value="count">Más opiniones</option><option value="name">Nombre A–Z</option></select></label></div>
    </section>
    <SectionHeading title={availabilityLoading ? "Buscando disponibilidad…" : `${professionals.length} ${professionals.length === 1 ? "profesional encontrado" : "profesionales encontrados"}`}/>
    {availabilityLoading ? <div className="react-loading"><span className="spinner"/> Consultando turnos disponibles…</div> : professionals.length ? <div className="professional-list">{professionals.map((person) => <ProfessionalCard key={person.id} person={person} centers={catalog.centers} onClick={() => onProfile(person)}/>)}</div>
      : <div className="empty-panel"><span>⌕</span><h3>No encontramos profesionales</h3><p>Probá cambiar el texto o los filtros.</p><button className="button-secondary" onClick={onReset}>Limpiar filtros</button></div>}
  </div>;
}

function Profile({ person, catalog, user, onBook, onBack, onLogin }) {
  const [centerId, setCenterId] = useState(String(person.hosps[0] || ""));
  const [date, setDate] = useState("");
  const [dateOptions, setDateOptions] = useState([]);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [slotError, setSlotError] = useState("");
  useEffect(() => {
    let active = true;
    setDate(""); setTime(""); setDateOptions([]);
    async function loadDates() {
      try { const result = await api.getAvailabilityDates(person.id, centerId); if (active) setDateOptions(result.dates); }
      catch (error) { if (active) setSlotError(error.message); }
    }
    loadDates();
    return () => { active = false; };
  }, [person.id, centerId]);
  useEffect(() => { setDate(dateOptions[0] || ""); setTime(""); }, [dateOptions]);
  useEffect(() => {
    if (!centerId || !date) { setSlots([]); return undefined; }
    let active = true;
    setBusy(true); setSlotError("");
    async function loadSlots() {
      try { const result = await api.getAvailability(person.id, centerId, date); if (active) setSlots(result.slots); }
      catch (error) { if (active) { setSlots([]); setSlotError(error.message); } }
      finally { if (active) setBusy(false); }
    }
    loadSlots();
    return () => { active = false; };
  }, [person.id, centerId, date]);
  const score = average(person);
  async function handleSubmit(event) {
    event.preventDefault();
    if (!time) return;
    await onBook({ professionalId: person.id, centerId: Number(centerId), date, time });
  }
  return <div className="page-content profile-page"><button className="back-link" type="button" onClick={onBack}>← Volver a búsqueda</button>
    <div className="profile-grid"><section className="profile-main">
      <article className="profile-card"><div className={`profile-avatar avatar-${person.bg || "green"}`}>{initials(person.name)}</div><div className="profile-copy"><div className="professional-title"><h1>{person.name}</h1>{person.verified && <span className="verified-badge">✓ Profesional verificado</span>}</div><p className="professional-specialty">{person.spec}</p><p className="profile-meta"><span className="rating-star">★</span><b>{score.toFixed(1)}</b><span>{person.reviews.length} opiniones</span><span>{person.exp} años de experiencia</span></p><p className="profile-meta">⌖ {person.city}</p></div></article>
      <section className="content-card"><SectionHeading title="Dónde atiende"/><div className="center-list">{person.hosps.map((id) => { const center = catalog.centers.find((item) => item.id === id); return center && <article className="center-card" key={id}><div><h3>{center.name}</h3><p>{center.addr}, {center.city}</p><p>{center.hours.map((row) => row.x).join(" · ")}</p></div><a href={`tel:${center.phone.replace(/\D/g, "")}`}>Llamar</a></article>; })}</div></section>
      <section className="content-card"><SectionHeading title="Opiniones de pacientes" subtitle={`${score.toFixed(1)} / 5 · ${person.reviews.length} opiniones`}/>{person.reviews.length ? person.reviews.slice(0, 8).map((review, index) => <article className="review-card" key={review.id || `${review.a}-${index}`}><div className="review-top"><b>{review.a}</b><span className="rating-star">{"★".repeat(review.r)}<span className="star-muted">{"★".repeat(5-review.r)}</span></span></div><p>{review.t}</p><small>{review.d}{review.verified && " · Consulta verificada"}</small></article>) : <p className="muted">Todavía no hay opiniones.</p>}</section>
    </section>
    <aside className="booking-panel"><p className="eyebrow">TURNOS</p><h2>Elegí un horario</h2><p>Consultá la disponibilidad actual de este profesional.</p><form onSubmit={handleSubmit}>
      <label>Centro<select value={centerId} onChange={(e) => { setCenterId(e.target.value); setTime(""); }} required>{person.hosps.map((id) => { const center = catalog.centers.find((item) => item.id === id); return center && <option key={id} value={id}>{center.name}</option>; })}</select></label>
      <label>Fecha<select value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} required>{dateOptions.length ? dateOptions.map((option) => <option key={option} value={option}>{dateLabel(option)}</option>) : <option value="">Sin fechas disponibles</option>}</select></label>
      <label>Horario<select value={time} onChange={(e) => setTime(e.target.value)} required disabled={busy || !slots.length}><option value="">{busy ? "Buscando horarios…" : slots.length ? "Elegí un horario" : "No hay horarios disponibles"}</option>{slots.map((slot) => <option key={slot}>{slot}</option>)}</select></label>
      {slotError && <p className="field-error" role="alert">{slotError}</p>}
      <button className="button-primary full-width" disabled={busy || !time}>{busy ? "Consultando…" : "Solicitar turno"}</button>
      <small>{user ? `Sesión: ${user.nombre}` : "Vas a necesitar una cuenta para confirmar la solicitud."}</small>
      {!user && <button type="button" className="text-action booking-login" onClick={onLogin}>Ingresar o crear cuenta</button>}
    </form></aside></div>
  </div>;
}

function Appointments({ appointments, catalog, user, onLogin }) {
  if (!user) return <div className="page-content"><SectionHeading title="Mis turnos" subtitle="Ingresá para consultar tus solicitudes."/><div className="empty-panel"><button className="button-primary" onClick={onLogin}>Ingresar a mi cuenta</button></div></div>;
  const status = { solicitado: "Solicitado", confirmado: "Confirmado", rechazado: "Rechazado", atendido: "Atendido", cancelado: "Cancelado" };
  return <div className="page-content"><SectionHeading title="Mis turnos" subtitle="Consultá el estado de tus solicitudes y próximas visitas."/>
    {appointments.length ? <div className="appointment-list">{appointments.map((item) => { const person = catalog.professionals.find((row) => row.id === item.professionalId); const center = catalog.centers.find((row) => row.id === item.centerId); return <article className="appointment-item" key={item.id}><div className="appointment-date-icon">▣</div><div className="appointment-details"><span className={`status-pill status-${item.status}`}>{status[item.status] || item.status}</span><h3>{person?.name || "Profesional"}</h3><p>{person?.spec || "Consulta"} · {center?.name || "Centro"}</p><small>{dateLabel(item.date)} · {item.time}</small></div></article>; })}</div> : <div className="empty-panel"><span>▣</span><h3>Todavía no tenés turnos</h3><p>Encontrá un profesional y elegí un horario.</p></div>}
  </div>;
}

function Account({ user, error, onAuth, onLogout }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    try { await onAuth({ mode, name: data.get("name"), email: data.get("email"), password: data.get("password") }); }
    finally { setBusy(false); }
  }
  if (user) return <div className="page-content account-page"><SectionHeading title="Mi cuenta" subtitle="Tus datos de acceso a MediLink."/><article className="account-profile"><span className="user-avatar large">{initials(user.nombre)}</span><div><p className="eyebrow">PACIENTE</p><h2>{user.nombre}</h2><p>{user.email}</p></div><button className="button-secondary" onClick={onLogout}>Cerrar sesión</button></article></div>;
  return <div className="page-content account-page"><SectionHeading title="Tu espacio MediLink" subtitle="Ingresá o creá una cuenta para guardar tus solicitudes de turnos."/>
    <section className="auth-card"><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Iniciar sesión</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Crear cuenta</button></div>
      <form onSubmit={submit}>{mode === "register" && <label>Nombre y apellido<input name="name" autoComplete="name" minLength="2" maxLength="100" required placeholder="Tu nombre completo"/></label>}<label>Correo electrónico<input type="email" name="email" autoComplete="email" maxLength="254" required placeholder="nombre@correo.com"/></label><label>Contraseña<input type="password" name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength="10" maxLength="200" required placeholder="Mínimo 10 caracteres"/></label>{error && <p className="field-error" role="alert">{error}</p>}<button className="button-primary full-width" disabled={busy}>{busy ? "Procesando…" : mode === "register" ? "Crear cuenta de paciente" : "Ingresar"}</button></form>
    </section></div>;
}

createRoot(document.getElementById("root")).render(<App />);
