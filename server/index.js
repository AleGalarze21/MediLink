import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import { createServer as createViteServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.MEDILINK_DB_PATH || path.join(ROOT, "database", "medilink.db");
const PORT = Number(process.env.PORT || 3000);
const COOKIE_NAME = "medilink_session";
const SESSION_SECONDS = 12 * 60 * 60;
const PBKDF2_ROUNDS = 310_000;
const PRODUCTION = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.MEDILINK_SESSION_SECRET || (PRODUCTION ? null : crypto.randomBytes(32));
if (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error("Configurá MEDILINK_SESSION_SECRET con al menos 32 bytes antes de iniciar en producción.");
}

if (!fs.existsSync(DB_PATH)) {
  throw new Error(`No existe ${DB_PATH}. Verificá que exista database/medilink.db antes de iniciar MediLink.`);
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;");

function migrate() {
  db.exec(fs.readFileSync(path.join(ROOT, "database", "migrations.sql"), "utf8"));
  const columns = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
  const reviewColumns = columns("opiniones");
  if (!reviewColumns.has("turno_id")) db.exec("ALTER TABLE opiniones ADD COLUMN turno_id INTEGER REFERENCES turnos(id) ON DELETE SET NULL");
  if (!reviewColumns.has("oculta")) db.exec("ALTER TABLE opiniones ADD COLUMN oculta INTEGER NOT NULL DEFAULT 0 CHECK (oculta IN (0,1))");
  if (!columns("documentos_paciente").has("contenido")) db.exec("ALTER TABLE documentos_paciente ADD COLUMN contenido TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_opinion_turno ON opiniones(turno_id) WHERE turno_id IS NOT NULL");

  if (db.prepare("SELECT COUNT(*) AS n FROM horarios_profesional").get().n === 0) {
    const links = db.prepare("SELECT profesional_id, centro_id FROM profesional_centro").all();
    const hours = db.prepare("SELECT dias,hora_desde,hora_hasta FROM horarios_centro WHERE centro_id=?");
    const insert = db.prepare("INSERT OR IGNORE INTO horarios_profesional(profesional_id,centro_id,dia,hora_desde,hora_hasta) VALUES(?,?,?,?,?)");
    for (const link of links) {
      for (const row of hours.all(link.centro_id)) {
        for (const day of row.dias.split(",").map(Number)) insert.run(link.profesional_id, link.centro_id, day, row.hora_desde, row.hora_hasta);
      }
    }
  }
}

migrate();

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function cookieValue(req, key) {
  const part = (req.headers.cookie || "").split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${key}=`));
  return part ? decodeURIComponent(part.slice(key.length + 1)) : "";
}

function signSession(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${user.id}:${user.rol}:${issuedAt}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

function currentUser(req) {
  try {
    const [idText, role, issuedText, signature] = cookieValue(req, COOKIE_NAME).split(":");
    const id = Number(idText), issuedAt = Number(issuedText);
    if (!Number.isInteger(id) || !Number.isFinite(issuedAt) || Date.now() / 1000 - issuedAt > SESSION_SECONDS || issuedAt > Date.now() / 1000 + 60) return null;
    const payload = `${id}:${role}:${issuedAt}`;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    const left = Buffer.from(signature || ""), right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    return db.prepare("SELECT id,nombre,email,rol,profesional_id FROM usuarios WHERE id=? AND rol=? AND activo=1").get(id, role) || null;
  } catch { return null; }
}

function requirePatient(req) {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, "Iniciá sesión para solicitar un turno.");
  if (user.rol !== "paciente") { audit(user.id, "acceso_denegado", req.path); throw new ApiError(403, "Esta acción está disponible para cuentas de pacientes."); }
  return user;
}

function requireAppointmentManager(req) {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, "Iniciá sesión para gestionar turnos.");
  if (!["profesional", "admin"].includes(user.rol)) { audit(user.id, "acceso_denegado", req.path); throw new ApiError(403, "No tenés permisos para gestionar turnos."); }
  return user;
}

function requireAdmin(req) {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, "Iniciá sesión para continuar.");
  if (user.rol !== "admin") { audit(user.id, "acceso_denegado", req.path); throw new ApiError(403, "Esta acción requiere permisos de administrador."); }
  return user;
}

function audit(userId, action, entity, entityId = null) {
  db.prepare("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)")
    .run(userId || null, action, entity, entityId);
}

function secureCookieOptions() {
  return { httpOnly: true, sameSite: "strict", secure: PRODUCTION, maxAge: SESSION_SECONDS * 1000, path: "/" };
}

function notify(userId, event, title, message) {
  db.prepare("INSERT INTO notificaciones(usuario_id,evento,titulo,mensaje) VALUES(?,?,?,?) ON CONFLICT(evento) DO NOTHING")
    .run(userId, event, title, message);
}

function publicCatalog() {
  const centers = db.prepare("SELECT * FROM centros ORDER BY id").all().map((center) => ({
    id: center.id, name: center.nombre, addr: center.direccion, city: center.ciudad, phone: center.telefono, note: center.nota || "",
    hours: db.prepare("SELECT etiqueta,dias,hora_desde,hora_hasta,texto FROM horarios_centro WHERE centro_id=? ORDER BY id").all(center.id)
      .map((row) => ({ l: row.etiqueta, d: row.dias.split(",").map(Number), f: row.hora_desde, t: row.hora_hasta, x: row.texto })),
  }));
  const professionals = db.prepare("SELECT p.*, e.nombre AS especialidad FROM profesionales p JOIN especialidades e ON e.id=p.especialidad_id ORDER BY p.id").all().map((professional) => {
    const reviews = db.prepare("SELECT id,autor,puntaje,comentario,fecha,turno_id FROM opiniones WHERE profesional_id=? AND oculta=0 ORDER BY fecha DESC,id DESC").all(professional.id)
      .map((review) => ({ id: review.id, a: review.autor, r: review.puntaje, t: review.comentario, d: review.fecha, verified: review.turno_id !== null }));
    return {
      id: professional.id, name: professional.nombre, spec: professional.especialidad, city: professional.ciudad,
      hosps: db.prepare("SELECT centro_id FROM profesional_centro WHERE profesional_id=? ORDER BY centro_id").all(professional.id).map((row) => row.centro_id),
      exp: professional.anios_experiencia, bg: professional.color, verified: Boolean(professional.verificado), reviews,
    };
  });
  return { centers, professionals };
}

function slotsFor(professionalId, centerId, isoDate) {
  const centerRelation = db.prepare("SELECT 1 FROM profesional_centro WHERE profesional_id=? AND centro_id=?").get(professionalId, centerId);
  if (!centerRelation) throw new ApiError(404, "El profesional no atiende en ese centro.");
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  const hours = db.prepare("SELECT hora_desde,hora_hasta FROM horarios_profesional WHERE profesional_id=? AND centro_id=? AND dia=?").all(professionalId, centerId, day);
  const slots = new Set();
  for (const row of hours) for (let hour = row.hora_desde; hour < row.hora_hasta; hour++) slots.add(`${String(hour).padStart(2, "0")}:00`);
  const occupied = new Set(db.prepare("SELECT hora FROM turnos WHERE profesional_id=? AND centro_id=? AND fecha=? AND estado IN ('solicitado','confirmado','atendido')").all(professionalId, centerId, isoDate).map((row) => row.hora));
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (isoDate === localToday) {
    for (const slot of slots) if (slot <= `${String(now.getHours()).padStart(2, "0")}:00`) occupied.add(slot);
  }
  return [...slots].filter((slot) => !occupied.has(slot)).sort();
}

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" });
  next();
});
app.use(express.json({ limit: "64kb" }));
const authAttempts = new Map();
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/auth/") || !["POST"].includes(req.method)) return next();
  const key = `${req.ip}:${req.path}`, now = Date.now(), entry = authAttempts.get(key) || { count: 0, start: now };
  if (now - entry.start > 15 * 60 * 1000) { entry.count = 0; entry.start = now; }
  entry.count += 1; authAttempts.set(key, entry);
  if (entry.count > 20) return res.status(429).json({ error: "Demasiados intentos. Esperá unos minutos y volvé a probar." });
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "MediLink Node/Express" }));
app.get("/api/catalog", (_req, res) => res.json(publicCatalog()));
app.get("/api/auth/me", (req, res) => res.json({ user: currentUser(req) }));

app.post("/api/auth/register", (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    if (name.length < 2 || name.length > 100) throw new ApiError(400, "El nombre debe tener entre 2 y 100 caracteres.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError(400, "Ingresá un correo válido.");
    if (typeof password !== "string" || password.length < 10 || password.length > 200) throw new ApiError(400, "La contraseña debe tener al menos 10 caracteres.");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), PBKDF2_ROUNDS, 32, "sha256").toString("hex");
    const result = db.prepare("INSERT INTO usuarios(nombre,email,password_hash,password_salt,rol) VALUES(?,?,?,?,'paciente')").run(name, email, hash, salt);
    const user = db.prepare("SELECT id,nombre,email,rol,profesional_id FROM usuarios WHERE id=?").get(Number(result.lastInsertRowid));
    res.cookie(COOKIE_NAME, signSession(user), secureCookieOptions());
    notify(user.id, `usuario:${user.id}:bienvenida`, "Bienvenido a MediLink", "Tu cuenta de paciente ya está lista.");
    res.status(201).json({ user });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    const row = db.prepare("SELECT id,nombre,email,rol,profesional_id,password_hash,password_salt FROM usuarios WHERE email=? AND activo=1").get(email);
    if (!row || typeof password !== "string") throw new ApiError(401, "Correo o contraseña incorrectos.");
    const actual = crypto.pbkdf2Sync(password, Buffer.from(row.password_salt, "hex"), PBKDF2_ROUNDS, 32, "sha256");
    const expected = Buffer.from(row.password_hash, "hex");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new ApiError(401, "Correo o contraseña incorrectos.");
    const user = { id: row.id, nombre: row.nombre, email: row.email, rol: row.rol, profesional_id: row.profesional_id };
    res.cookie(COOKIE_NAME, signSession(user), secureCookieOptions());
    res.json({ user });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", (_req, res) => { res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict", secure: PRODUCTION, path: "/" }); res.json({ ok: true }); });

app.get("/api/availability/dates", (req, res, next) => {
  try {
    const professionalId = Number(req.query.professionalId), centerId = Number(req.query.centerId);
    if (!Number.isInteger(professionalId) || !Number.isInteger(centerId)) throw new ApiError(400, "Indicá profesional y centro válidos.");
    const dates = [], start = new Date(); start.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < 30 && dates.length < 12; offset++) {
      const candidate = new Date(start); candidate.setDate(start.getDate() + offset);
      const value = dateISO(candidate);
      if (slotsFor(professionalId, centerId, value).length) dates.push(value);
    }
    res.json({ dates });
  } catch (error) { next(error); }
});

app.get("/api/availability/summary", (_req, res) => {
  const professionals = db.prepare("SELECT id FROM profesionales ORDER BY id").all();
  const centersFor = db.prepare("SELECT centro_id FROM profesional_centro WHERE profesional_id=?");
  const availableProfessionalIds = [];
  const start = new Date(); start.setHours(12, 0, 0, 0);
  for (const professional of professionals) {
    let available = false;
    for (const link of centersFor.all(professional.id)) {
      for (let offset = 0; offset < 14 && !available; offset++) {
        const candidate = new Date(start); candidate.setDate(start.getDate() + offset);
        if (slotsFor(professional.id, link.centro_id, dateISO(candidate)).length) available = true;
      }
      if (available) break;
    }
    if (available) availableProfessionalIds.push(professional.id);
  }
  res.json({ days: 14, professionalIds: availableProfessionalIds });
});

app.get("/api/availability", (req, res, next) => {
  try {
    const professionalId = Number(req.query.professionalId), centerId = Number(req.query.centerId), isoDate = String(req.query.date || "");
    if (!Number.isInteger(professionalId) || professionalId < 1 || !Number.isInteger(centerId) || centerId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new ApiError(400, "Indicá profesional, centro y fecha válidos.");
    const requested = new Date(`${isoDate}T12:00:00`), today = new Date(); today.setHours(0, 0, 0, 0);
    if (Number.isNaN(requested.getTime()) || dateISO(requested) !== isoDate || requested < today) throw new ApiError(400, "La fecha ya pasó o no es válida.");
    const limit = new Date(today); limit.setDate(limit.getDate() + 90);
    if (requested > limit) throw new ApiError(400, "La agenda está disponible hasta 90 días.");
    res.json({ date: isoDate, slots: slotsFor(professionalId, centerId, isoDate) });
  } catch (error) { next(error); }
});

app.get("/api/appointments", (req, res, next) => {
  try {
    const user = requirePatient(req);
    const rows = db.prepare("SELECT t.*,p.nombre AS profesional,e.nombre AS especialidad,c.nombre AS centro,EXISTS(SELECT 1 FROM opiniones o WHERE o.turno_id=t.id) AS tiene_resena FROM turnos t JOIN profesionales p ON p.id=t.profesional_id JOIN especialidades e ON e.id=p.especialidad_id JOIN centros c ON c.id=t.centro_id WHERE t.paciente_id=? ORDER BY t.fecha,t.hora").all(user.id);
    res.json({ appointments: rows.map((row) => ({ id: row.id, professionalId: row.profesional_id, centerId: row.centro_id, date: row.fecha, time: row.hora, status: row.estado, hasReview: Boolean(row.tiene_resena), professional: row.profesional, specialty: row.especialidad, center: row.centro })) });
  } catch (error) { next(error); }
});

app.get("/api/appointments/manage", (req, res, next) => {
  try {
    const user = requireAppointmentManager(req);
    const query = `SELECT t.*, u.nombre AS paciente, u.email AS paciente_email,
      p.nombre AS profesional, e.nombre AS especialidad, c.nombre AS centro
      FROM turnos t
      JOIN usuarios u ON u.id=t.paciente_id
      JOIN profesionales p ON p.id=t.profesional_id
      JOIN especialidades e ON e.id=p.especialidad_id
      JOIN centros c ON c.id=t.centro_id
      ${user.rol === "profesional" ? "WHERE t.profesional_id=?" : ""}
      ORDER BY t.fecha, t.hora`;
    const rows = user.rol === "profesional"
      ? db.prepare(query).all(user.profesional_id)
      : db.prepare(query).all();
    res.json({ appointments: rows.map((row) => ({
      id: row.id, patientId: row.paciente_id, patient: row.paciente, patientEmail: row.paciente_email,
      professionalId: row.profesional_id, centerId: row.centro_id, date: row.fecha, time: row.hora,
      status: row.estado, professional: row.profesional, specialty: row.especialidad, center: row.centro,
    })) });
  } catch (error) { next(error); }
});

app.post("/api/appointments", (req, res, next) => {
  try {
    const user = requirePatient(req);
    const professionalId = Number(req.body.professionalId), centerId = Number(req.body.centerId), isoDate = String(req.body.date || ""), time = String(req.body.time || "");
    if (!Number.isInteger(professionalId) || !Number.isInteger(centerId) || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !/^(?:[01]\d|2[0-3]):00$/.test(time)) throw new ApiError(400, "Profesional, centro, fecha y hora son obligatorios.");
    const requested = new Date(`${isoDate}T12:00:00`), today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 90);
    if (Number.isNaN(requested.getTime()) || dateISO(requested) !== isoDate || requested < today || requested > limit) throw new ApiError(400, "Elegí una fecha válida dentro de los próximos 90 días.");
    if (!slotsFor(professionalId, centerId, isoDate).includes(time)) throw new ApiError(409, "Ese horario ya no está disponible. Elegí otro.");
    const result = db.prepare("INSERT INTO turnos(paciente_id,profesional_id,centro_id,fecha,hora) VALUES(?,?,?,?,?)").run(user.id, professionalId, centerId, isoDate, time);
    const professional = db.prepare("SELECT nombre FROM profesionales WHERE id=?").get(professionalId);
    notify(user.id, `turno:${result.lastInsertRowid}:solicitado`, "Solicitud registrada", `Tu solicitud con ${professional.nombre} quedó pendiente de confirmación.`);
    res.status(201).json({ appointmentId: Number(result.lastInsertRowid), status: "solicitado" });
  } catch (error) { next(error); }
});

app.patch("/api/appointments/:id/status", (req, res, next) => {
  try {
    const user = requireAppointmentManager(req);
    const appointmentId = Number(req.params.id);
    const nextStatus = String(req.body.status || "");
    if (!Number.isInteger(appointmentId) || !["confirmado", "rechazado", "atendido"].includes(nextStatus)) {
      throw new ApiError(400, "El estado del turno no es válido.");
    }
    const appointment = db.prepare("SELECT id,paciente_id,profesional_id,estado FROM turnos WHERE id=?").get(appointmentId);
    if (!appointment) throw new ApiError(404, "No se encontró el turno.");
    if (user.rol === "profesional" && appointment.profesional_id !== user.profesional_id) {
      audit(user.id, "acceso_denegado", "turno", appointmentId);
      throw new ApiError(403, "No podés modificar este turno.");
    }
    const allowed = { solicitado: ["confirmado", "rechazado"], confirmado: ["atendido"] };
    if (!allowed[appointment.estado]?.includes(nextStatus)) {
      throw new ApiError(409, `No se puede pasar de ${appointment.estado} a ${nextStatus}.`);
    }
    db.prepare("UPDATE turnos SET estado=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?").run(nextStatus, appointmentId);
    audit(user.id, `turno_estado:${appointment.estado}->${nextStatus}`, "turno", appointmentId);
    const messages = {
      confirmado: ["Turno confirmado", "Tu solicitud de turno fue confirmada."],
      rechazado: ["Turno rechazado", "Tu solicitud de turno fue rechazada."],
      atendido: ["Consulta atendida", "Tu turno fue marcado como atendido."],
    };
    const [title, message] = messages[nextStatus];
    notify(appointment.paciente_id, `turno:${appointmentId}:${nextStatus}`, title, message);
    res.json({ appointmentId, status: nextStatus });
  } catch (error) { next(error); }
});

app.get("/api/notifications", (req, res, next) => {
  try {
    const user = currentUser(req);
    if (!user) throw new ApiError(401, "Iniciá sesión para consultar tus notificaciones.");
    const rows = db.prepare("SELECT id,evento,titulo,mensaje,leida,creada_en FROM notificaciones WHERE usuario_id=? ORDER BY creada_en DESC,id DESC LIMIT 100").all(user.id);
    res.json({ notifications: rows });
  } catch (error) { next(error); }
});

app.patch("/api/notifications/:id", (req, res, next) => {
  try {
    const user = currentUser(req), id = Number(req.params.id);
    if (!user) throw new ApiError(401, "Iniciá sesión para continuar.");
    if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "Notificación no válida.");
    const result = db.prepare("UPDATE notificaciones SET leida=1 WHERE id=? AND usuario_id=?").run(id, user.id);
    if (!result.changes) throw new ApiError(404, "No se encontró la notificación.");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/reviews", (req, res, next) => {
  try {
    const user = requirePatient(req);
    const appointmentId = Number(req.body.appointmentId), rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isInteger(appointmentId) || appointmentId < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5 || comment.length > 2000) {
      throw new ApiError(400, "La reseña debe incluir una puntuación y un comentario de entre 5 y 2000 caracteres.");
    }
    const appointment = db.prepare("SELECT id,profesional_id,estado FROM turnos WHERE id=? AND paciente_id=?").get(appointmentId, user.id);
    if (!appointment) { audit(user.id, "acceso_denegado", "resena_turno", appointmentId); throw new ApiError(404, "No se encontró ese turno."); }
    if (appointment.estado !== "atendido") throw new ApiError(409, "Solo podés reseñar un turno atendido.");
    const result = db.prepare("INSERT INTO opiniones(profesional_id,autor,puntaje,comentario,turno_id) VALUES(?,?,?,?,?)")
      .run(appointment.profesional_id, "Paciente verificado", rating, comment, appointmentId);
    res.status(201).json({ reviewId: Number(result.lastInsertRowid) });
  } catch (error) { next(error); }
});

app.get("/api/documents", (req, res, next) => {
  try {
    const user = currentUser(req);
    if (!user) throw new ApiError(401, "Iniciá sesión para consultar documentación.");
    if (user.rol === "paciente") {
      const rows = db.prepare("SELECT d.id,d.titulo,d.tipo,d.creado_en,p.nombre AS profesional FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id WHERE d.paciente_id=? ORDER BY d.creado_en DESC,d.id DESC").all(user.id);
      return res.json({ documents: rows });
    }
    if (user.rol === "profesional") {
      const rows = db.prepare("SELECT d.id,d.titulo,d.tipo,d.creado_en,p.nombre AS profesional FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id WHERE d.profesional_id=? ORDER BY d.creado_en DESC,d.id DESC").all(user.profesional_id);
      return res.json({ documents: rows });
    }
    const rows = db.prepare("SELECT d.id,d.titulo,d.tipo,d.creado_en,p.nombre AS profesional FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id ORDER BY d.creado_en DESC,d.id DESC LIMIT 200").all();
    res.json({ documents: rows });
  } catch (error) { next(error); }
});

app.get("/api/documents/:id", (req, res, next) => {
  try {
    const user = currentUser(req), id = Number(req.params.id);
    if (!user) throw new ApiError(401, "Iniciá sesión para consultar documentación.");
    if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "Documento no válido.");
    const document = db.prepare("SELECT d.*,p.nombre AS profesional FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id WHERE d.id=?").get(id);
    if (!document) throw new ApiError(404, "No se encontró el documento.");
    const allowed = user.rol === "admin" || (user.rol === "paciente" && document.paciente_id === user.id) || (user.rol === "profesional" && document.profesional_id === user.profesional_id);
    if (!allowed) { audit(user.id, "acceso_denegado", "documento", id); throw new ApiError(403, "No tenés permiso para consultar este documento."); }
    res.json({ document: { id: document.id, titulo: document.titulo, tipo: document.tipo, creado_en: document.creado_en, profesional: document.profesional, contenido: document.contenido } });
  } catch (error) { next(error); }
});

app.post("/api/documents", (req, res, next) => {
  try {
    const user = currentUser(req);
    if (!user) throw new ApiError(401, "Iniciá sesión para cargar documentación.");
    if (!['profesional', 'admin'].includes(user.rol)) { audit(user.id, "acceso_denegado", req.path); throw new ApiError(403, "Solo el profesional responsable puede cargar documentación."); }
    const appointmentId = Number(req.body.appointmentId);
    const title = String(req.body.title || "").trim(), type = String(req.body.type || "").trim(), content = String(req.body.content || "").trim();
    if (!Number.isInteger(appointmentId) || appointmentId < 1 || title.length < 2 || title.length > 160 || type.length < 2 || type.length > 80 || content.length < 1 || content.length > 50000) {
      throw new ApiError(400, "Completá turno, título, tipo y contenido (máximo 50.000 caracteres).");
    }
    const appointment = db.prepare("SELECT id,paciente_id,profesional_id,estado FROM turnos WHERE id=?").get(appointmentId);
    if (!appointment) throw new ApiError(404, "No se encontró el turno.");
    if (user.rol === "profesional" && appointment.profesional_id !== user.profesional_id) { audit(user.id, "acceso_denegado", "documento_turno", appointmentId); throw new ApiError(403, "Solo podés cargar documentos de tus propios turnos."); }
    if (appointment.estado !== "atendido") throw new ApiError(409, "La documentación se asocia a consultas atendidas.");
    const result = db.prepare("INSERT INTO documentos_paciente(paciente_id,profesional_id,turno_id,titulo,tipo,ubicacion,contenido) VALUES(?,?,?,?,?,?,?)")
      .run(appointment.paciente_id, appointment.profesional_id, appointment.id, title, type, "texto", content);
    audit(user.id, "documento_creado", "documento", Number(result.lastInsertRowid));
    notify(appointment.paciente_id, `documento:${result.lastInsertRowid}:creado`, "Nuevo resultado disponible", `Se agregó “${title}” a tu documentación.`);
    res.status(201).json({ documentId: Number(result.lastInsertRowid) });
  } catch (error) { next(error); }
});

app.get("/api/admin/users", (req, res, next) => {
  try {
    requireAdmin(req);
    res.json({ users: db.prepare("SELECT id,nombre,email,rol,profesional_id,activo,creado_en FROM usuarios ORDER BY creado_en DESC,id DESC LIMIT 500").all() });
  } catch (error) { next(error); }
});

app.patch("/api/admin/users/:id", (req, res, next) => {
  try {
    const admin = requireAdmin(req), id = Number(req.params.id);
    const target = db.prepare("SELECT id,rol,profesional_id,activo FROM usuarios WHERE id=?").get(id);
    if (!Number.isInteger(id) || id < 1 || !target) throw new ApiError(404, "No se encontró el usuario.");
    const active = req.body.active;
    const role = req.body.role;
    if (active !== undefined && typeof active !== "boolean") throw new ApiError(400, "Estado no válido.");
    if (role !== undefined && !["paciente", "profesional", "admin"].includes(role)) throw new ApiError(400, "Rol no válido.");
    const nextActive = active === undefined ? Boolean(target.activo) : active;
    const nextRole = role === undefined ? target.rol : role;
    const professionalId = nextRole === "profesional" ? Number(req.body.professionalId ?? target.profesional_id) : null;
    if (nextRole === "profesional" && (!Number.isInteger(professionalId) || !db.prepare("SELECT 1 FROM profesionales WHERE id=?").get(professionalId))) throw new ApiError(400, "Vinculá una cuenta profesional a un profesional existente.");
    if (admin.id === id && (!nextActive || nextRole !== "admin")) throw new ApiError(409, "No podés desactivar ni cambiar tu propio rol.");
    if (target.rol === "admin" && target.activo && (!nextActive || nextRole !== "admin") && db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol='admin' AND activo=1").get().n <= 1) throw new ApiError(409, "Debe quedar al menos un administrador activo.");
    const result = db.prepare("UPDATE usuarios SET activo=?,rol=?,profesional_id=? WHERE id=?").run(nextActive ? 1 : 0, nextRole, professionalId, id);
    if (!result.changes) throw new ApiError(404, "No se encontró el usuario.");
    audit(admin.id, `usuario_actualizado:${target.rol}->${nextRole}:${nextActive ? "activo" : "inactivo"}`, "usuario", id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/reviews", (req, res, next) => {
  try {
    requireAdmin(req);
    const rows = db.prepare("SELECT o.id,o.autor,o.puntaje,o.comentario,o.fecha,o.oculta,p.nombre AS profesional FROM opiniones o JOIN profesionales p ON p.id=o.profesional_id ORDER BY o.fecha DESC,o.id DESC LIMIT 500").all();
    res.json({ reviews: rows });
  } catch (error) { next(error); }
});

app.get("/api/admin/professionals", (req, res, next) => {
  try {
    requireAdmin(req);
    res.json({ professionals: db.prepare("SELECT id,nombre,verificado FROM profesionales ORDER BY nombre").all() });
  } catch (error) { next(error); }
});

app.patch("/api/admin/professionals/:id", (req, res, next) => {
  try {
    const admin = requireAdmin(req), id = Number(req.params.id), verified = req.body.verified;
    if (!Number.isInteger(id) || id < 1 || typeof verified !== "boolean") throw new ApiError(400, "Indicá un profesional y un estado válido.");
    const result = db.prepare("UPDATE profesionales SET verificado=? WHERE id=?").run(verified ? 1 : 0, id);
    if (!result.changes) throw new ApiError(404, "No se encontró el profesional.");
    audit(admin.id, verified ? "profesional_verificado" : "profesional_no_verificado", "profesional", id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.patch("/api/admin/reviews/:id", (req, res, next) => {
  try {
    const admin = requireAdmin(req), id = Number(req.params.id), hidden = req.body.hidden;
    if (!Number.isInteger(id) || id < 1 || typeof hidden !== "boolean") throw new ApiError(400, "Indicá una reseña y un estado válido.");
    const result = db.prepare("UPDATE opiniones SET oculta=? WHERE id=?").run(hidden ? 1 : 0, id);
    if (!result.changes) throw new ApiError(404, "No se encontró la reseña.");
    audit(admin.id, hidden ? "resena_ocultada" : "resena_publicada", "opinion", id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.use("/api", (_req, _res, next) => next(new ApiError(404, "Ruta de API no encontrada.")));

if (PRODUCTION) {
  app.use(express.static(path.join(ROOT, "dist")));
  app.use("/shared", express.static(path.join(ROOT, "shared")));
  app.use("/web/css", express.static(path.join(ROOT, "web", "css")));
  app.use("/mobile/css", express.static(path.join(ROOT, "mobile", "css")));
  app.get("*splat", (req, res) => {
    const page = req.path.startsWith("/mobile") ? "mobile/index.html" : req.path.startsWith("/web") ? "web/index.html" : "index.html";
    res.sendFile(path.join(ROOT, "dist", page));
  });
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, hmr: { port: PORT + 1 } }, appType: "custom", root: ROOT });
  app.get(["/", "/index.html", "/web", "/web/", "/web/index.html", "/mobile", "/mobile/", "/mobile/index.html"], async (req, res, next) => {
    const page = req.path.startsWith("/mobile") ? "mobile/index.html" : req.path.startsWith("/web") ? "web/index.html" : "index.html";
    try {
      const source = fs.readFileSync(path.join(ROOT, page), "utf8");
      const html = await vite.transformIndexHtml(req.originalUrl, source);
      res.status(200).type("html").send(html);
    } catch (error) { next(error); }
  });
  app.use(vite.middlewares);
  app.use((error, _req, _res, next) => vite.ssrFixStacktrace(error) || next(error));
}

app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) return res.status(error.status).json({ error: error.message });
  if (error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.errcode === 2067 || /UNIQUE constraint failed/i.test(error?.message || "")) return res.status(409).json({ error: "Ya existe una cuenta con ese correo o ese horario acaba de reservarse." });
  console.error(error);
  res.status(500).json({ error: "No se pudo completar la operación." });
});

app.listen(PORT, "127.0.0.1", () => console.log(`MediLink React + Express en http://127.0.0.1:${PORT}`));

function createUpcomingReminders() {
  const now = new Date(), until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const localDateTime = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  const rows = db.prepare("SELECT t.id,t.paciente_id,t.fecha,t.hora,p.nombre AS profesional FROM turnos t JOIN profesionales p ON p.id=t.profesional_id WHERE t.estado='confirmado'").all();
  const insert = db.prepare("INSERT INTO notificaciones(usuario_id,evento,titulo,mensaje) VALUES(?,?,?,?) ON CONFLICT(evento) DO NOTHING");
  for (const row of rows) {
    const scheduled = new Date(`${row.fecha}T${row.hora}:00`);
    if (scheduled > now && scheduled <= until) insert.run(row.paciente_id, `turno:${row.id}:recordatorio`, "Recordatorio de turno", `Próximamente tenés un turno con ${row.profesional} el ${row.fecha} a las ${row.hora}.`);
  }
}
createUpcomingReminders();
setInterval(createUpcomingReminders, 15 * 60 * 1000).unref();

function dateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
