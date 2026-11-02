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
  const [managedAppointments, setManagedAppointments] = useState([]);
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
        } else if (["profesional", "admin"].includes(session.user?.rol)) {
          const result = await api.getManagedAppointments();
          if (active) setManagedAppointments(result.appointments);
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
    if (page !== "buscar") return undefined;
    const timer = window.setTimeout(() => api.recordSearch().catch(() => {}), 500);
    return () => window.clearTimeout(timer);
  }, [page, query, specialty, city, centerFilter, rating, availability]);

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

  const specialties = useMemo(() => ["Todas", ...new Set(catalog.professionals.flatMap((person) => person.specs || [person.spec]))], [catalog.professionals]);
  const cities = useMemo(() => ["Todas", ...new Set(catalog.professionals.map((person) => person.city).filter(Boolean))], [catalog.professionals]);
  const professionals = useMemo(() => {
    const filtered = catalog.professionals.filter((person) => {
      const centerNames = person.hosps.map((id) => catalog.centers.find((item) => item.id === id)?.name || "").join(" ");
      return (specialty === "Todas" || (person.specs || [person.spec]).includes(specialty))
        && (city === "Todas" || person.city === city)
        && (centerFilter === "Todos" || person.hosps.includes(Number(centerFilter)))
        && (!rating || average(person) >= Number(rating))
        && (availability !== "available" || !availableIds || availableIds.has(person.id))
        && (!query || normalize([person.name, person.spec, person.city, centerNames].join(" ")).includes(normalize(query)));
    });
    return filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "es") : sort === "count" ? b.reviews.length - a.reviews.length : average(b) - average(a));
  }, [catalog.professionals, catalog.centers, specialty, city, centerFilter, rating, query, sort, availability, availableIds]);

  function navigate(nextPage) {
    setPage(nextPage); setError("");
  }
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
      } else if (["profesional", "admin"].includes(response.user.rol)) {
        const result = await api.getManagedAppointments();
        setManagedAppointments(result.appointments);
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

  async function updateManagedAppointment(id, status) {
    try {
      await api.updateAppointmentStatus(id, status);
      const result = await api.getManagedAppointments();
      setManagedAppointments(result.appointments);
      flash("Estado del turno actualizado.");
    } catch (statusError) { setError(statusError.message); }
  }

  async function cancelAppointment(id) {
    try { await api.cancelAppointment(id); const result = await api.getAppointments(); setAppointments(result.appointments); flash("Turno cancelado y horario liberado."); }
    catch (cancelError) { setError(cancelError.message); }
  }

  async function signOut() {
    try { await api.logout(); } finally { setUser(null); setAppointments([]); setManagedAppointments([]); navigate("inicio"); flash("Sesión cerrada."); }
  }

  const content = loading ? <div className="react-loading"><span className="spinner" /> Cargando MediLink…</div>
    : error && !catalog.professionals.length ? <div className="react-error"><h2>No pudimos conectar con MediLink</h2><p>{error}</p><p>Iniciá el servidor con <code>npm run dev</code>.</p></div>
      : page === "inicio" ? <Home catalog={catalog} onSearch={(value) => { setQuery(value); navigate("buscar"); }} onSpecialty={(value) => { setSpecialty(value); setQuery(""); navigate("buscar"); }} onProfile={openProfile} />
          : page === "buscar" ? <Search catalog={catalog} professionals={professionals} specialties={specialties} cities={cities} values={{ query, specialty, city, centerFilter, rating, sort, availability }} set={{ setQuery, setSpecialty, setCity, setCenterFilter, setRating, setSort, setAvailability }} availabilityLoading={availabilityLoading} onProfile={openProfile} onReset={() => { setQuery(""); setSpecialty("Todas"); setCity("Todas"); setCenterFilter("Todos"); setRating("0"); setSort("rating"); setAvailability("any"); }} />
          : page === "perfil" && selected ? <Profile person={selected} catalog={catalog} user={user} onBook={createBooking} onBack={() => navigate("buscar")} onLogin={() => { setPendingBooking(null); navigate("cuenta"); }} />
            : page === "turnos" ? (user && ["profesional", "admin"].includes(user.rol) ? <ProfessionalAgenda appointments={managedAppointments} user={user} onLogin={() => navigate("cuenta")} onUpdate={updateManagedAppointment} onDocumentCreated={async () => { const r = await api.getManagedAppointments(); setManagedAppointments(r.appointments); flash("Documento agregado y paciente notificado."); }} /> : <Appointments appointments={appointments} catalog={catalog} user={user} onLogin={() => navigate("cuenta")} onCancel={cancelAppointment} onReview={async (id, rating, comment) => { await api.createReview({ appointmentId: id, rating, comment }); const r = await api.getAppointments(); setAppointments(r.appointments); setCatalog(await api.getCatalog()); flash("Reseña verificada publicada."); }} />)
              : page === "agenda" ? <ProfessionalAgenda appointments={managedAppointments} user={user} onLogin={() => navigate("cuenta")} onUpdate={updateManagedAppointment} onDocumentCreated={async () => { const r = await api.getManagedAppointments(); setManagedAppointments(r.appointments); flash("Documento agregado y paciente notificado."); }} />
                : page === "cuenta" ? <Account user={user} error={error} onAuth={submitAuth} onLogout={signOut} flash={flash} onRefreshCatalog={async () => { setCatalog(await api.getCatalog()); const session = await api.getUser(); setUser(session.user); }} />
                  : user?.rol === "admin" && page === "admin-usuarios" ? <AdminUsers currentUser={user} flash={flash} />
                    : user?.rol === "admin" && page === "admin-profesionales" ? <AdminProfessionals flash={flash} onRefreshCatalog={async () => setCatalog(await api.getCatalog())} />
                      : user?.rol === "admin" && page === "admin-centros" ? <AdminManagement section="centers" flash={flash} onRefreshCatalog={async () => setCatalog(await api.getCatalog())} />
                        : user?.rol === "admin" && page === "admin-resenas" ? <AdminReviews flash={flash} />
                          : user?.rol === "admin" && page === "admin-estadisticas" ? <AdminStatistics />
                            : <Account user={user} error={error} onAuth={submitAuth} onLogout={signOut} flash={flash} onRefreshCatalog={async () => { setCatalog(await api.getCatalog()); const session = await api.getUser(); setUser(session.user); }} />;

  const nav = <nav className={`${isMobile ? "mobile-tabs" : "desktop-nav"} ${user?.rol === "admin" ? "admin-nav" : ""}`} aria-label="Navegación principal">
    {[["inicio", "⌂", "Inicio"], ["buscar", "⌕", "Buscar profesionales"], ["turnos", "▣", "Mis turnos"], ["cuenta", "◉", user ? "Mi cuenta" : "Ingresar"], ...(user?.rol === "admin" ? [["admin-usuarios", "♙", "Usuarios"], ["admin-profesionales", "⚕", "Profesionales"], ["admin-centros", "⌂", "Centros"], ["admin-resenas", "★", "Reseñas"], ["admin-estadisticas", "%", "Estadísticas"]] : [])].map(([id, icon, label]) => <button key={id} className={`nav-button ${page === id ? "selected" : ""}`} type="button" onClick={() => navigate(id)}><span aria-hidden="true">{icon}</span><span>{label}</span></button>)}
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
  const specialties = [...new Set(catalog.professionals.flatMap((person) => person.specs || [person.spec]))].slice(0, 6);
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

function Appointments({ appointments, catalog, user, onLogin, onReview, onCancel }) {
  const [reviewing, setReviewing] = useState(null), [busy, setBusy] = useState(false);
  if (!user) return <div className="page-content"><SectionHeading title="Mis turnos" subtitle="Ingresá para consultar tus solicitudes."/><div className="empty-panel"><button className="button-primary" onClick={onLogin}>Ingresar a mi cuenta</button></div></div>;
  const status = { solicitado: "Solicitado", confirmado: "Confirmado", rechazado: "Rechazado", atendido: "Atendido", cancelado: "Cancelado" };
  return <div className="page-content"><SectionHeading title="Mis turnos" subtitle="Consultá el estado de tus solicitudes y próximas visitas."/>
    {appointments.length ? <div className="appointment-list">{appointments.map((item) => { const person = catalog.professionals.find((row) => row.id === item.professionalId), center = catalog.centers.find((row) => row.id === item.centerId); return <article className="appointment-item" key={item.id}><div className="appointment-date-icon">▣</div><div className="appointment-details"><span className={`status-pill status-${item.status}`}>{status[item.status] || item.status}</span><h3>{person?.name || "Profesional"}</h3><p>{person?.spec || "Consulta"} · {center?.name || "Centro"}</p><small>{dateLabel(item.date)} · {item.time}</small>{item.status === "atendido" && !item.hasReview && <div className="review-compose"><button className="button-secondary" onClick={() => setReviewing(reviewing === item.id ? null : item.id)}>{reviewing === item.id ? "Cancelar reseña" : "Dejar reseña verificada"}</button>{reviewing === item.id && <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget); try { await onReview(item.id, Number(form.get("rating")), form.get("comment")); setReviewing(null); } catch (e) { window.alert(e.message); } finally { setBusy(false); } }}><label>Puntuación<select name="rating" defaultValue="5">{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} estrellas</option>)}</select></label><label>Comentario<textarea name="comment" minLength="5" maxLength="2000" required /></label><button className="button-primary" disabled={busy}>{busy ? "Publicando…" : "Publicar reseña"}</button></form>}</div>}{item.hasReview && <small>Ya publicaste una reseña para esta consulta.</small>}{["solicitado","confirmado"].includes(item.status) && <button className="button-secondary" onClick={() => window.confirm("?Quer?s cancelar este turno?") && onCancel(item.id)}>Cancelar turno</button>}</div></article>; })}</div> : <div className="empty-panel"><span>▣</span><h3>Todavía no tenés turnos</h3><p>Encontrá un profesional y elegí un horario.</p></div>}
  </div>;
}

function ProfessionalAgenda({ appointments, user, onLogin, onUpdate, onDocumentCreated }) {
  const [documentFor, setDocumentFor] = useState(null), [busy, setBusy] = useState(false);
  if (!user) return <div className="page-content"><SectionHeading title="Agenda profesional" subtitle="Ingresá para gestionar tus turnos."/><div className="empty-panel"><button className="button-primary" onClick={onLogin}>Ingresar</button></div></div>;
  const labels = { solicitado: "Solicitado", confirmado: "Confirmado", rechazado: "Rechazado", atendido: "Atendido" };
  return <div className="page-content"><SectionHeading title="Agenda profesional" subtitle="Gestioná las solicitudes y el estado de tus consultas."/>
    {appointments.length ? <div className="appointment-list">{appointments.map((item) => <article className="appointment-item" key={item.id}><div className="appointment-date-icon">▣</div><div className="appointment-details"><span className={`status-pill status-${item.status}`}>{labels[item.status] || item.status}</span><h3>{item.patient}</h3><p>{item.specialty} · {item.center}</p><small>{dateLabel(item.date)} · {item.time}</small><div className="appointment-actions">{item.status === "solicitado" && <><button className="button-primary" onClick={() => onUpdate(item.id, "confirmado")}>Confirmar</button><button className="button-secondary" onClick={() => onUpdate(item.id, "rechazado")}>Rechazar</button></>}{item.status === "confirmado" && <button className="button-primary" onClick={() => onUpdate(item.id, "atendido")}>Marcar atendido</button>}{item.status === "atendido" && <button className="button-secondary" onClick={() => setDocumentFor(documentFor === item.id ? null : item.id)}>Agregar resultado o documento</button>}</div>{documentFor === item.id && <form className="document-compose" onSubmit={async (event) => { event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget); try { await api.createDocument({ appointmentId: item.id, title: form.get("title"), type: form.get("type"), content: form.get("content") }); setDocumentFor(null); await onDocumentCreated(); } catch (e) { window.alert(e.message); } finally { setBusy(false); } }}><label>Título<input name="title" required minLength="2" maxLength="160" /></label><label>Tipo<input name="type" required minLength="2" maxLength="80" placeholder="Análisis, informe, indicación" /></label><label>Contenido<textarea name="content" required maxLength="50000" rows="5" /></label><button className="button-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar y notificar al paciente"}</button></form>}</div></article>)}</div> : <div className="empty-panel"><span>▣</span><h3>No hay turnos para gestionar</h3><p>Las nuevas solicitudes aparecerán aquí.</p></div>}
  </div>;
}

function Account({ user, error, onAuth, onLogout, flash, onRefreshCatalog }) {
  const [mode, setMode] = useState("login"), [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState([]), [documents, setDocuments] = useState([]), [document, setDocument] = useState(null), [loadError, setLoadError] = useState("");
  async function loadAccount() {
    try {
      const [n, d] = await Promise.all([api.getNotifications(), api.getDocuments()]); setNotifications(n.notifications); setDocuments(d.documents);
    } catch (e) { setLoadError(e.message); }
  }
  useEffect(() => { if (user) loadAccount(); }, [user?.id]);
  async function submit(event) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); try { await onAuth({ mode, name: data.get("name"), email: data.get("email"), password: data.get("password") }); } finally { setBusy(false); } }
  if (user) return <div className="page-content account-page"><SectionHeading title="Mi cuenta" subtitle="Tus datos, avisos y documentación autorizada."/><article className="account-profile"><span className="user-avatar large">{initials(user.nombre)}</span><div><p className="eyebrow">{user.rol.toUpperCase()}</p><h2>{user.nombre}</h2><p>{user.email}</p></div><button className="button-secondary" onClick={onLogout}>Cerrar sesión</button></article>
    <section className="content-card"><SectionHeading title="Notificaciones"/><div className="account-list">{notifications.length ? notifications.map((n) => <article className="account-row" key={n.id}><div><b>{n.titulo}</b><p>{n.mensaje}</p><small>{n.creada_en}</small></div>{!n.leida && <button className="button-secondary" onClick={async () => { await api.markNotificationRead(n.id); await loadAccount(); }}>Marcar leída</button>}</article>) : <p className="muted">Todavía no tenés avisos.</p>}</div></section>
    {user.rol === "paciente" && <section className="content-card"><SectionHeading title="Resultados y documentación" subtitle="Documentos asociados a tus consultas."/><div className="account-list">{documents.length ? documents.map((d) => <article className="account-row" key={d.id}><div><b>{d.titulo}</b><p>{d.tipo} · {d.profesional}</p><small>{d.creado_en}</small></div><button className="button-secondary" onClick={async () => { const result = await api.getDocument(d.id); setDocument(result.document); }}>Consultar</button></article>) : <p className="muted">Todavía no hay documentos asociados a tus consultas.</p>}</div>{document && <article className="document-detail"><button className="text-action" onClick={() => setDocument(null)}>Cerrar</button><h3>{document.titulo}</h3><p>{document.tipo} · {document.profesional} · {document.creado_en}</p><pre>{document.contenido}</pre></article>}</section>}
    {user.rol === "profesional" && <section className="content-card"><SectionHeading title="Documentación emitida"/><div className="account-list">{documents.length ? documents.map((d) => <article className="account-row" key={d.id}><div><b>{d.titulo}</b><p>{d.tipo}</p><small>{d.creado_en}</small></div><button className="button-secondary" onClick={async () => { const result = await api.getDocument(d.id); setDocument(result.document); }}>Consultar</button></article>) : <p className="muted">Todavía no cargaste documentos.</p>}</div>{document && <article className="document-detail"><button className="text-action" onClick={() => setDocument(null)}>Cerrar</button><h3>{document.titulo}</h3><pre>{document.contenido}</pre></article>}</section>}
    {user.rol === "profesional" && <ProfessionalTools flash={flash} onRefreshCatalog={onRefreshCatalog} />}
    {loadError && <p className="field-error">{loadError}</p>}</div>;
  return <div className="page-content account-page"><SectionHeading title="Tu espacio MediLink" subtitle="Ingresá o creá una cuenta para guardar tus solicitudes de turnos."/><section className="auth-card"><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Iniciar sesión</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Crear cuenta</button></div><form onSubmit={submit}>{mode === "register" && <label>Nombre y apellido<input name="name" autoComplete="name" minLength="2" maxLength="100" required placeholder="Tu nombre completo"/></label>}<label>Correo electrónico<input type="email" name="email" autoComplete="email" maxLength="254" required placeholder="nombre@correo.com"/></label><label>Contraseña<input type="password" name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength="10" maxLength="200" required placeholder="Mínimo 10 caracteres"/></label>{error && <p className="field-error" role="alert">{error}</p>}<button className="button-primary full-width" disabled={busy}>{busy ? "Procesando…" : mode === "register" ? "Crear cuenta de paciente" : "Ingresar"}</button></form></section></div>;
}

function AdminUsers({ currentUser, flash }) {
  const [users, setUsers] = useState([]), [professionals, setProfessionals] = useState([]), [error, setError] = useState("");
  async function load() { try { const [u, p] = await Promise.all([api.getAdminUsers(), api.getAdminProfessionals()]); setUsers(u.users); setProfessionals(p.professionals); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  const groups = [["admin", "Administradores"], ["profesional", "Profesionales"], ["paciente", "Pacientes"]];
  const linkedProfessionalIds = new Set(users.filter((u) => u.rol === "profesional" && u.profesional_id).map((u) => u.profesional_id));
  const unlinkedProfessionals = professionals.filter((p) => !linkedProfessionalIds.has(p.id));
  return <div className="admin-user-groups"><SectionHeading title="Usuarios y roles" subtitle="Las cuentas están agrupadas por rol. Podés cambiar el rol desde cada usuario."/>{groups.map(([role, title]) => { const members = users.filter((u) => u.rol === role); const total = role === "profesional" ? members.length + unlinkedProfessionals.length : members.length; return <section className="content-card" key={role}><SectionHeading title={`${title} (${total})`}/><div className="account-list">{members.map((u) => <AdminUserRow key={u.id} account={u} professionals={professionals} currentUser={currentUser} onSave={async (changes) => { try { await api.updateAdminUser(u.id, changes); await load(); flash("Cuenta actualizada."); } catch (e) { setError(e.message); } }} />)}{role === "profesional" && unlinkedProfessionals.map((p) => <article className="account-row" key={`profile-${p.id}`}><div><b>{p.nombre}</b><p>Perfil médico · ID {p.id} · {p.verificado ? "Verificado" : "Pendiente de verificación"} · Sin cuenta vinculada</p></div></article>)}{!total && <p className="muted">No hay cuentas con este rol.</p>}</div></section>; })}{error && <p className="field-error">{error}</p>}</div>;
}

function AdminProfessionals({ flash, onRefreshCatalog }) {
  const [professionals, setProfessionals] = useState([]), [error, setError] = useState("");
  async function load() { try { const result = await api.getAdminProfessionals(); setProfessionals(result.professionals); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  return <><section className="content-card"><SectionHeading title="Verificación profesional" subtitle="La insignia de perfil depende de esta verificación administrativa."/><div className="account-list">{professionals.map((p) => <article className="account-row" key={p.id}><div><b>{p.nombre}</b><p>ID {p.id} · {p.verificado ? "Verificado" : "Pendiente de verificación"}</p></div><button className="button-secondary" onClick={async () => { try { await api.verifyProfessional(p.id, !p.verificado); await load(); flash("Verificación actualizada."); } catch (e) { setError(e.message); } }}>{p.verificado ? "Quitar verificación" : "Verificar"}</button></article>)}</div>{error && <p className="field-error">{error}</p>}</section><AdminManagement section="professionals" flash={flash} onRefreshCatalog={onRefreshCatalog}/></>;
}

function AdminReviews({ flash }) {
  const [reviews, setReviews] = useState([]), [error, setError] = useState("");
  async function load() { try { const result = await api.getAdminReviews(); setReviews(result.reviews); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  return <section className="content-card"><SectionHeading title="Moderación de reseñas" subtitle="Publicá u ocultá reseñas verificadas."/><div className="account-list">{reviews.map((r) => <article className="account-row" key={r.id}><div><b>{r.autor} · {r.puntaje}/5 · {r.profesional}</b><p>{r.comentario}</p><small>{r.fecha} · {r.oculta ? "Oculta" : "Visible"}</small></div><button className="button-secondary" onClick={async () => { try { await api.moderateReview(r.id, !r.oculta); await load(); flash("Reseña actualizada."); } catch (e) { setError(e.message); } }}>{r.oculta ? "Publicar" : "Ocultar"}</button></article>)}</div>{error && <p className="field-error">{error}</p>}</section>;
}

function AdminStatistics() {
  const today = dateISO(new Date()), monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 29);
  const [from, setFrom] = useState(dateISO(monthAgo)), [to, setTo] = useState(today), [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load(event) {
    event?.preventDefault(); setBusy(true); setError("");
    try { setData(await api.getAdminStats(from, to)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  return <section className="content-card"><SectionHeading title="Estadísticas de uso" subtitle="Las búsquedas se cuentan sin guardar el texto consultado."/>
    <form className="admin-period-form" onSubmit={load}><label>Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required/></label><label>Hasta<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} required/></label><button className="button-secondary" disabled={busy}>{busy ? "Actualizando…" : "Aplicar período"}</button></form>
    {error && <p className="field-error">{error}</p>}{data && <><div className="stats-grid admin-stats-grid"><Stat value={data.summaries.searches} label="Búsquedas"/><Stat value={data.summaries.appointments} label="Solicitudes de turno"/><Stat value={data.summaries.reviews} label="Reseñas visibles"/><Stat value={data.summaries.users} label="Cuentas creadas"/></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fecha</th><th>Búsquedas</th><th>Turnos</th><th>Reseñas</th></tr></thead><tbody>{data.series.length ? data.series.map((row) => <tr key={row.day}><td>{row.day}</td><td>{row.searches}</td><td>{row.appointments}</td><td>{row.reviews}</td></tr>) : <tr><td colSpan="4">No hay actividad registrada en el período.</td></tr>}</tbody></table></div><section className="stats-percentages"><h3>Turnos por estado</h3><p className="muted">Porcentaje sobre el total de turnos del período seleccionado.</p>{data.byStatus.length ? <ul>{data.byStatus.map((row) => { const percentage = data.summaries.appointments ? (row.total / data.summaries.appointments) * 100 : 0; return <li key={row.estado}><span>{row.estado}</span><strong>{row.total} ({percentage.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)</strong></li>; })}</ul> : <p className="muted">Sin turnos en este período.</p>}</section></>}
  </section>;
}

function AdminManagement({ section = "all", flash, onRefreshCatalog, onRefreshAccount }) {
  const [centers, setCenters] = useState([]), [specialties, setSpecialties] = useState([]), [professionals, setProfessionals] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load() {
    try { const [centerData, catalog] = await Promise.all([api.getAdminCenters(), api.getCatalog()]); setCenters(centerData.centers.map((center) => ({ ...center, hours: centerData.hours.filter((row) => row.centro_id === center.id) }))); setSpecialties(catalog.specialties || []); setProfessionals(catalog.professionals || []); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function save(action) {
    setBusy(true); setError("");
    try { await action(); await load(); await onRefreshCatalog?.(); await onRefreshAccount?.(); flash("Cambios de administración guardados."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    {(section === "all" || section === "centers") && <section className="content-card"><SectionHeading title="Centros y horarios de atención" subtitle="Creá centros y mantené actualizados sus datos y horarios de apertura."/>
      <CenterForm key="new-center" busy={busy} onSave={(center) => save(() => api.createAdminCenter(center))}/>
      <div className="admin-center-list">{centers.map((center) => <CenterForm key={center.id} initial={center} busy={busy} onSave={(changes) => save(() => api.updateAdminCenter(center.id, changes))} onDelete={() => save(() => api.deleteAdminCenter(center.id))}/>)}</div>
    </section>}
    {(section === "all" || section === "professionals") && <section className="content-card"><SectionHeading title="Agregar profesional" subtitle="El perfil aparecerá en las búsquedas y tendrá agenda en los centros seleccionados."/>
      <ProfessionalCreateForm specialties={specialties} centers={centers} busy={busy} onSave={(details) => save(() => api.createAdminProfessional(details))}/>
      <SectionHeading title="Perfiles profesionales" subtitle="Actualizá especialidades, experiencia, ciudad y centros vinculados."/>
      <div className="admin-center-list">{professionals.map((professional) => <ProfessionalAdminEditor key={professional.id} initial={professional} specialties={specialties} centers={centers} busy={busy} onSave={(changes) => save(() => api.updateAdminProfessional(professional.id, changes))} onDelete={() => save(() => api.deleteAdminProfessional(professional.id))}/>)}</div>
    </section>}
    {error && <p className="field-error">{error}</p>}
  </>;
}

function CenterForm({ initial, busy, onSave, onDelete }) {
  const defaultHours = [{ label: "Lunes a viernes", days: [1,2,3,4,5], start: 8, end: 17 }];
  const [hours, setHours] = useState(initial?.hours?.length ? initial.hours.map((row) => ({ label: row.etiqueta, days: row.dias.split(",").map(Number), start: row.hora_desde, end: row.hora_hasta })) : defaultHours);
  const weekdays = [[1,"L"],[2,"M"],[3,"X"],[4,"J"],[5,"V"],[6,"S"],[0,"D"]];
  async function submit(event) { event.preventDefault(); const form = event.currentTarget, data = new FormData(form); await onSave({ name: data.get("name"), address: data.get("address"), city: data.get("city"), phone: data.get("phone"), note: data.get("note"), hours: hours.filter((row) => row.days.length).map((row) => ({ ...row, days: row.days })) }); if (!initial) { form.reset(); setHours(defaultHours); } }
  function updateHour(index, patch) { setHours((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  return <form className="admin-form center-editor" onSubmit={submit}><div className="admin-form-heading"><h3>{initial ? initial.nombre : "Nuevo centro"}</h3>{initial && <button type="button" className="button-danger" disabled={busy} onClick={() => window.confirm("¿Eliminar este centro? Solo se puede borrar si no tiene médicos ni turnos asociados.") && onDelete?.()}>Eliminar centro</button>}</div><div className="admin-form-grid"><label>Nombre<input name="name" defaultValue={initial?.nombre || ""} required minLength="2" maxLength="120"/></label><label>Dirección<input name="address" defaultValue={initial?.direccion || ""} required minLength="3" maxLength="180"/></label><label>Ciudad<input name="city" defaultValue={initial?.ciudad || ""} required minLength="2" maxLength="120"/></label><label>Teléfono<input name="phone" defaultValue={initial?.telefono || ""} required minLength="5" maxLength="40"/></label><label className="admin-wide">Nota<input name="note" defaultValue={initial?.nota || ""} maxLength="240"/></label></div>
    <div className="center-hours-editor"><b>Horarios semanales</b>{hours.map((row, index) => <div className="center-hours-row" key={index}><label>Etiqueta<input value={row.label} onChange={(e) => updateHour(index, { label: e.target.value })} required maxLength="80"/></label><div className="weekday-picker">{weekdays.map(([day,label]) => <label key={day}><input type="checkbox" checked={row.days.includes(day)} onChange={(e) => updateHour(index, { days: e.target.checked ? [...row.days, day] : row.days.filter((item) => item !== day) })}/>{label}</label>)}</div><label>Desde<input type="number" min="0" max="23" value={row.start} onChange={(e) => updateHour(index, { start: Number(e.target.value) })} required/></label><label>Hasta<input type="number" min="1" max="24" value={row.end} onChange={(e) => updateHour(index, { end: Number(e.target.value) })} required/></label><button type="button" className="button-secondary" disabled={hours.length <= 1} onClick={() => setHours((current) => current.filter((_, i) => i !== index))}>Quitar</button></div>)}<button type="button" className="text-action" onClick={() => setHours((current) => [...current, { label: "Nuevo horario", days: [], start: 9, end: 17 }])}>Agregar franja horaria</button></div><button className="button-primary" disabled={busy}>{initial ? "Guardar centro" : "Crear centro"}</button></form>;
}

function ProfessionalCreateForm({ specialties, centers, busy, onSave }) {
  const [centerIds, setCenterIds] = useState([]), [specialtyIds, setSpecialtyIds] = useState([]);
  async function submit(event) { event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ name: data.get("name"), city: data.get("city"), specialtyIds, experience: Number(data.get("experience")), centerIds }); event.currentTarget.reset(); setCenterIds([]); setSpecialtyIds([]); }
  return <form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label>Nombre y apellido<input name="name" required minLength="3" maxLength="120" placeholder="Dra. Nombre Apellido"/></label><label>Ciudad<input name="city" required minLength="2" maxLength="120"/></label><label>Años de experiencia<input name="experience" type="number" min="0" max="70" defaultValue="5" required/></label></div><fieldset className="center-checkboxes"><legend>Especialidades</legend>{specialties.map((item) => <label key={item.id}><input type="checkbox" checked={specialtyIds.includes(item.id)} onChange={(e) => setSpecialtyIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/>{item.name}</label>)}</fieldset><fieldset className="center-checkboxes"><legend>Centros de atención</legend>{centers.map((center) => <label key={center.id}><input type="checkbox" checked={centerIds.includes(center.id)} onChange={(e) => setCenterIds((current) => e.target.checked ? [...current, center.id] : current.filter((id) => id !== center.id))}/>{center.nombre}</label>)}</fieldset><button className="button-primary" disabled={busy || !centerIds.length || !specialtyIds.length}>Crear perfil profesional</button></form>;
}

function ProfessionalAdminEditor({ initial, specialties, centers, busy, onSave, onDelete }) {
  const [specialtyIds, setSpecialtyIds] = useState(specialties.filter((item) => (initial.specs || [initial.spec]).includes(item.name)).map((item) => item.id));
  const [centerIds, setCenterIds] = useState(initial.hosps || []);
  async function submit(event) { event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ name:data.get("name"), city:data.get("city"), experience:Number(data.get("experience")), specialtyIds, centerIds }); }
  return <form className="admin-form professional-editor" onSubmit={submit}><div className="admin-form-heading"><h3>{initial.name} · ID {initial.id}</h3><button type="button" className="button-danger" disabled={busy} onClick={() => window.confirm("¿Eliminar este perfil? Solo se puede borrar si no tiene cuenta, turnos ni documentos asociados.") && onDelete?.()}>Eliminar perfil</button></div><div className="admin-form-grid"><label>Nombre<input name="name" defaultValue={initial.name} required minLength="3" maxLength="120"/></label><label>Ciudad<input name="city" defaultValue={initial.city} required minLength="2" maxLength="120"/></label><label>Años de experiencia<input name="experience" type="number" min="0" max="70" defaultValue={initial.exp} required/></label></div><fieldset className="center-checkboxes"><legend>Especialidades</legend>{specialties.map((item) => <label key={item.id}><input type="checkbox" checked={specialtyIds.includes(item.id)} onChange={(e) => setSpecialtyIds((current) => e.target.checked ? [...current,item.id] : current.filter((id) => id !== item.id))}/>{item.name}</label>)}</fieldset><fieldset className="center-checkboxes"><legend>Centros</legend>{centers.map((center) => <label key={center.id}><input type="checkbox" checked={centerIds.includes(center.id)} onChange={(e) => setCenterIds((current) => e.target.checked ? [...current,center.id] : current.filter((id) => id !== center.id))}/>{center.nombre}</label>)}</fieldset><button className="button-secondary" disabled={busy || !specialtyIds.length || !centerIds.length}>Guardar perfil</button></form>;
}

function ProfessionalTools({ flash, onRefreshCatalog }) {
  const [profile, setProfile] = useState(null), [specialties, setSpecialties] = useState([]), [specialtyIds, setSpecialtyIds] = useState([]), [centers, setCenters] = useState([]), [rules, setRules] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const days = [[1,"Lunes"],[2,"Martes"],[3,"Miércoles"],[4,"Jueves"],[5,"Viernes"],[6,"Sábado"],[0,"Domingo"]];
  useEffect(() => { Promise.all([api.getProfessionalProfile(), api.getProfessionalSchedule()]).then(([p,s]) => {
    setProfile(p.profile); setSpecialtyIds(p.profile.specialtyIds || [p.profile.especialidad_id]); setSpecialties(p.specialties); setCenters(s.centers);
    const current = {};
    for (const center of s.centers) for (const [day] of days) current[`${center.id}:${day}`] = [];
    for (const row of s.schedule) { const key = `${row.centerId}:${row.day}`; current[key] = [...(current[key] || []), { ...row, key: `${key}:${row.start}:${Math.random()}` }]; }
    setRules(current);
  }).catch((e) => setError(e.message)); }, []);
  function updateBlock(key, blockKey, patch) { setRules((current) => ({ ...current, [key]: (current[key] || []).map((block) => block.key === blockKey ? { ...block, ...patch } : block) })); }
  function addBlock(centerId, day) { const key = `${centerId}:${day}`; setRules((current) => { const blocks=current[key] || [], start=blocks.length ? 14 : 9; return { ...current, [key]: [...blocks, { centerId, day, start, end:blocks.length ? 18 : 13, key:`${key}:${Date.now()}:${Math.random()}` }] }; }); }
  function removeBlock(key, blockKey) { setRules((current) => ({ ...current, [key]: (current[key] || []).filter((block) => block.key !== blockKey) })); }
  async function saveProfile(event) { event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); try { await api.updateProfessionalProfile({ name:data.get("name"), city:data.get("city"), specialtyIds, experience:Number(data.get("experience")) }); const result=await api.getProfessionalProfile(); setProfile(result.profile); setSpecialtyIds(result.profile.specialtyIds || [result.profile.especialidad_id]); setSpecialties(result.specialties); await onRefreshCatalog?.(); flash("Perfil profesional actualizado."); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function saveSchedule(event) { event.preventDefault(); setBusy(true); setError(""); try { const schedule=Object.values(rules).flat().map(({centerId,day,start,end}) => ({centerId,day,start:Number(start),end:Number(end)})); await api.updateProfessionalSchedule(schedule); flash("Agenda actualizada."); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  if (!profile) return <section className="content-card"><SectionHeading title="Mi perfil y agenda"/>{error ? <p className="field-error">{error}</p> : <p className="muted">Cargando perfil...</p>}</section>;
  return <><section className="content-card"><SectionHeading title="Mi perfil profesional" subtitle="Actualizá los datos visibles en las búsquedas."/><form className="admin-form" onSubmit={saveProfile}><div className="admin-form-grid"><label>Nombre<input name="name" defaultValue={profile.nombre} required minLength="3" maxLength="120"/></label><label>Ciudad<input name="city" defaultValue={profile.ciudad} required minLength="2" maxLength="120"/></label><label>Años de experiencia<input name="experience" type="number" min="0" max="70" defaultValue={profile.anios_experiencia} required/></label></div><fieldset className="center-checkboxes"><legend>Especialidades</legend>{specialties.map((item) => <label key={item.id}><input type="checkbox" checked={specialtyIds.includes(item.id)} onChange={(e) => setSpecialtyIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/>{item.nombre}</label>)}</fieldset><button className="button-primary" disabled={busy || !specialtyIds.length}>Guardar perfil</button></form></section>
    <section className="content-card"><SectionHeading title="Mi disponibilidad" subtitle="Agreg? uno o m?s bloques por d?a en cada centro vinculado."/>{centers.length ? <form className="admin-form" onSubmit={saveSchedule}>{centers.map((center) => <div className="schedule-center" key={center.id}><h3>{center.nombre}</h3>{days.map(([day,label]) => { const key=`${center.id}:${day}`, blocks=rules[key] || []; return <div className="schedule-day" key={key}><strong>{label}</strong><div className="schedule-blocks">{blocks.map((block) => <div className="schedule-row" key={block.key}><label>Desde<input type="number" min="0" max="23" value={block.start} onChange={(e) => updateBlock(key,block.key,{start:Number(e.target.value)})}/></label><label>Hasta<input type="number" min="1" max="24" value={block.end} onChange={(e) => updateBlock(key,block.key,{end:Number(e.target.value)})}/></label><button type="button" className="button-danger" onClick={() => removeBlock(key,block.key)}>Quitar</button></div>)}{!blocks.length && <span className="muted">Sin atenci?n</span>}<button type="button" className="text-action" onClick={() => addBlock(center.id,day)}>Agregar bloque</button></div></div>; })}</div>)}<button className="button-primary" disabled={busy}>Guardar agenda</button></form> : <p className="muted">Tu cuenta todav?a no est? vinculada a un centro.</p>}</section>{error && <p className="field-error">{error}</p>}</>;
}

function AdminUserRow({ account, professionals, currentUser, onSave }) {
  const [role, setRole] = useState(account.rol), [professionalId, setProfessionalId] = useState(account.profesional_id || ""), [busy, setBusy] = useState(false);
  const self = account.id === currentUser.id;
  return <article className="account-row admin-user-row"><div><b>{account.nombre}</b><p>{account.email} · {account.activo ? "Activo" : "Inactivo"}</p></div><label>Rol<select value={role} disabled={self} onChange={(e) => setRole(e.target.value)}><option value="paciente">Paciente</option><option value="profesional">Profesional</option><option value="admin">Administrador</option></select></label>{role === "profesional" && <label>Profesional<select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}><option value="">Seleccioná</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.nombre} · ID {p.id}</option>)}</select></label>}<button className="button-secondary" disabled={busy || self || (role === "profesional" && !professionalId)} onClick={async () => { setBusy(true); try { await onSave({ role, professionalId: role === "profesional" ? Number(professionalId) : null }); } catch (e) { window.alert(e.message); } finally { setBusy(false); } }}>{busy ? "Guardando…" : "Guardar rol"}</button><button className="button-secondary" disabled={busy || self} onClick={async () => { setBusy(true); try { await onSave({ active: !account.activo }); } catch (e) { window.alert(e.message); } finally { setBusy(false); } }}>{account.activo ? "Desactivar" : "Activar"}</button></article>;
}

createRoot(document.getElementById("root")).render(<App />);
