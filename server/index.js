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
const SESSION_SECRET = process.env.MEDILINK_SESSION_SECRET || crypto.randomBytes(32);
const PRODUCTION = process.argv.includes("--production") || process.env.NODE_ENV === "production";

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
  if (user.rol !== "paciente") throw new ApiError(403, "Esta acción está disponible para cuentas de pacientes.");
  return user;
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
    res.cookie(COOKIE_NAME, signSession(user), { httpOnly: true, sameSite: "strict", maxAge: SESSION_SECONDS * 1000, path: "/" });
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
    res.cookie(COOKIE_NAME, signSession(user), { httpOnly: true, sameSite: "strict", maxAge: SESSION_SECONDS * 1000, path: "/" });
    res.json({ user });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", (_req, res) => { res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict", path: "/" }); res.json({ ok: true }); });

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
    db.prepare("INSERT INTO notificaciones(usuario_id,evento,titulo,mensaje) VALUES(?,?,?,?) ON CONFLICT(evento) DO NOTHING").run(user.id, `turno:${result.lastInsertRowid}:solicitado`, "Solicitud registrada", `Tu solicitud con ${professional.nombre} quedó pendiente de confirmación.`);
    res.status(201).json({ appointmentId: Number(result.lastInsertRowid), status: "solicitado" });
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

function dateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
