"""Servidor local de MediLink. Solo usa la biblioteca estándar de Python."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "database" / "medilink.db"
MIGRATIONS = ROOT / "database" / "migrations.sql"
SESSION_SECRET = (os.environ.get("MEDILINK_SESSION_SECRET") or "").encode("utf-8") or secrets.token_bytes(32)
SESSION_COOKIE = "medilink_session"
SESSION_SECONDS = 60 * 60 * 12
PBKDF2_ROUNDS = 310_000
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_STATIC_ROOTS = {"web", "mobile", "shared"}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def connect_db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 10000")
    return con


def migrate() -> None:
    if not DB_PATH.exists():
        raise RuntimeError("No existe database/medilink.db. Creala con python database/crear_base.py")
    with connect_db() as con:
        con.executescript(MIGRATIONS.read_text(encoding="utf-8"))
        opinion_columns = {row[1] for row in con.execute("PRAGMA table_info(opiniones)")}
        if "turno_id" not in opinion_columns:
            con.execute("ALTER TABLE opiniones ADD COLUMN turno_id INTEGER REFERENCES turnos(id) ON DELETE SET NULL")
        if "oculta" not in opinion_columns:
            con.execute("ALTER TABLE opiniones ADD COLUMN oculta INTEGER NOT NULL DEFAULT 0 CHECK (oculta IN (0,1))")
        document_columns = {row[1] for row in con.execute("PRAGMA table_info(documentos_paciente)")}
        if "contenido" not in document_columns:
            con.execute("ALTER TABLE documentos_paciente ADD COLUMN contenido TEXT NOT NULL DEFAULT ''")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_opinion_turno ON opiniones(turno_id) WHERE turno_id IS NOT NULL")
        if con.execute("SELECT COUNT(*) FROM horarios_profesional").fetchone()[0] == 0:
            links = con.execute("SELECT profesional_id, centro_id FROM profesional_centro ORDER BY profesional_id, centro_id").fetchall()
            for link in links:
                center_hours = con.execute("SELECT dias, hora_desde, hora_hasta FROM horarios_centro WHERE centro_id=?", (link["centro_id"],)).fetchall()
                for center_hour in center_hours:
                    for day in center_hour["dias"].split(","):
                        con.execute("INSERT OR IGNORE INTO horarios_profesional(profesional_id,centro_id,dia,hora_desde,hora_hasta) VALUES(?,?,?,?,?)", (link["profesional_id"], link["centro_id"], int(day), center_hour["hora_desde"], center_hour["hora_hasta"]))


def hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return digest.hex(), salt.hex()


def verify_password(password: str, password_hash: str, salt_hex: str) -> bool:
    actual, _ = hash_password(password, salt_hex)
    return hmac.compare_digest(actual, password_hash)


def signed_session(user_id: int, role: str, issued: int) -> str:
    payload = f"{user_id}:{role}:{issued}"
    signature = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def read_session(token: str) -> dict | None:
    try:
        user_raw, role, issued_raw, signature = token.split(":", 3)
        user_id, issued = int(user_raw), int(issued_raw)
        payload = f"{user_id}:{role}:{issued}"
        expected = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected) or time.time() - issued > SESSION_SECONDS or issued > time.time() + 60:
            return None
        with connect_db() as con:
            row = con.execute("SELECT id, nombre, email, rol, profesional_id FROM usuarios WHERE id=? AND activo=1", (user_id,)).fetchone()
        if not row or row["rol"] != role:
            return None
        return dict(row)
    except (ValueError, TypeError):
        return None


def catalog_data(con: sqlite3.Connection) -> dict:
    centers = []
    for center in con.execute("SELECT * FROM centros ORDER BY id"):
        hours = [
            {"l": row["etiqueta"], "d": [int(day) for day in row["dias"].split(",")], "f": row["hora_desde"], "t": row["hora_hasta"], "x": row["texto"]}
            for row in con.execute("SELECT * FROM horarios_centro WHERE centro_id=? ORDER BY id", (center["id"],))
        ]
        centers.append({"id": center["id"], "name": center["nombre"], "addr": center["direccion"], "city": center["ciudad"], "phone": center["telefono"], "hours": hours, "note": center["nota"] or ""})

    professionals = []
    query = """SELECT p.*, e.nombre AS especialidad FROM profesionales p
               JOIN especialidades e ON e.id=p.especialidad_id ORDER BY p.id"""
    for prof in con.execute(query):
        center_ids = [row[0] for row in con.execute("SELECT centro_id FROM profesional_centro WHERE profesional_id=? ORDER BY centro_id", (prof["id"],))]
        reviews = [
            {"id": row["id"], "a": row["autor"], "r": row["puntaje"], "t": row["comentario"], "d": row["fecha"], "verified": row["turno_id"] is not None}
            for row in con.execute("SELECT id, autor, puntaje, comentario, fecha, turno_id FROM opiniones WHERE profesional_id=? AND oculta=0 ORDER BY fecha DESC, id DESC", (prof["id"],))
        ]
        professionals.append({"id": prof["id"], "name": prof["nombre"], "spec": prof["especialidad"], "city": prof["ciudad"], "hosps": center_ids, "exp": prof["anios_experiencia"], "bg": prof["color"], "verified": bool(prof["verificado"]), "reviews": reviews})
    return {"centers": centers, "professionals": professionals}


def hours_for(con: sqlite3.Connection, professional_id: int, center_id: int, day: int) -> list[sqlite3.Row]:
    rows = con.execute(
        """SELECT h.hora_desde, h.hora_hasta, h.dias FROM horarios_centro h
           JOIN profesional_centro pc ON pc.centro_id=h.centro_id
           WHERE pc.profesional_id=? AND h.centro_id=?""",
        (professional_id, center_id),
    ).fetchall()
    return [row for row in rows if day in [int(item) for item in row["dias"].split(",")]]


def valid_slots(con: sqlite3.Connection, professional_id: int, center_id: int, date_value: date) -> list[str]:
    day = date_value.weekday() + 1 if date_value.weekday() < 6 else 0
    rows = con.execute("SELECT hora_desde,hora_hasta FROM horarios_profesional WHERE profesional_id=? AND centro_id=? AND dia=?", (professional_id, center_id, day)).fetchall()
    slots = set()
    for row in rows:
        for hour in range(row["hora_desde"], row["hora_hasta"]):
            slots.add(f"{hour:02d}:00")
    return sorted(slots)


def notify(con: sqlite3.Connection, user_id: int, event: str, title: str, message: str) -> None:
    con.execute(
        "INSERT INTO notificaciones(usuario_id, evento, titulo, mensaje) VALUES(?,?,?,?) ON CONFLICT(evento) DO NOTHING",
        (user_id, event, title, message),
    )


class MediLinkHandler(BaseHTTPRequestHandler):
    server_version = "MediLinkLocal/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def json_response(self, status: int, payload: dict, headers: list[tuple[str, str]] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in headers or []:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def body_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError(400, "Longitud de solicitud inválida.")
        if length < 0 or length > 1_000_000:
            raise ApiError(413, "La solicitud supera el tamaño permitido.")
        try:
            value = json.loads(self.rfile.read(length) or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(400, "El cuerpo debe ser JSON válido.")
        if not isinstance(value, dict):
            raise ApiError(400, "El cuerpo JSON debe ser un objeto.")
        return value

    def current_user(self) -> dict | None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(SESSION_COOKIE)
        return read_session(morsel.value) if morsel else None

    def require_user(self, roles: set[str] | None = None) -> dict:
        user = self.current_user()
        if not user:
            raise ApiError(401, "Iniciá sesión para continuar.")
        if roles and user["rol"] not in roles:
            raise ApiError(403, "Tu cuenta no tiene permiso para esta acción.")
        return user

    def guard_origin(self) -> None:
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host"):
            raise ApiError(403, "Origen de solicitud no permitido.")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                with connect_db() as con:
                    self.api_get(con, parsed.path, parse_qs(parsed.query))
            except ApiError as exc:
                self.json_response(exc.status, {"error": exc.message})
            except sqlite3.Error as exc:
                print("Database error:", exc, file=sys.stderr)
                self.json_response(500, {"error": "No se pudo completar la operación."})
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        self.guard_origin()
        try:
            payload = self.body_json()
            with connect_db() as con:
                self.api_post(con, urlparse(self.path).path, payload)
        except ApiError as exc:
            self.json_response(exc.status, {"error": exc.message})
        except sqlite3.IntegrityError:
            self.json_response(409, {"error": "El registro entra en conflicto con datos existentes."})
        except sqlite3.Error as exc:
            print("Database error:", exc, file=sys.stderr)
            self.json_response(500, {"error": "No se pudo completar la operación."})

    def do_PATCH(self) -> None:
        self.guard_origin()
        try:
            payload = self.body_json()
            with connect_db() as con:
                self.api_patch(con, urlparse(self.path).path, payload)
        except ApiError as exc:
            self.json_response(exc.status, {"error": exc.message})
        except sqlite3.IntegrityError:
            self.json_response(409, {"error": "El cambio entra en conflicto con datos existentes."})
        except sqlite3.Error as exc:
            print("Database error:", exc, file=sys.stderr)
            self.json_response(500, {"error": "No se pudo completar la operación."})

    def do_DELETE(self) -> None:
        self.guard_origin()
        self.json_response(405, {"error": "Método no permitido."})

    def api_get(self, con: sqlite3.Connection, path: str, query: dict) -> None:
        if path == "/api/health":
            self.json_response(200, {"ok": True, "service": "MediLink"})
        elif path == "/api/catalog":
            self.json_response(200, catalog_data(con))
        elif path == "/api/auth/me":
            self.json_response(200, {"user": self.current_user()})
        elif path == "/api/availability":
            try:
                prof_id = int(query.get("professionalId", [""])[0])
                center_id = int(query.get("centerId", [""])[0])
                requested = date.fromisoformat(query.get("date", [""])[0])
            except (ValueError, TypeError):
                raise ApiError(400, "Indicá profesional, centro y fecha válidos.")
            if requested < date.today():
                raise ApiError(400, "La fecha ya pasó.")
            if requested > date.today() + timedelta(days=90):
                raise ApiError(400, "La agenda está disponible hasta 90 días.")
            if not con.execute("SELECT 1 FROM profesional_centro WHERE profesional_id=? AND centro_id=?", (prof_id, center_id)).fetchone():
                raise ApiError(404, "El profesional no atiende en ese centro.")
            slots = valid_slots(con, prof_id, center_id, requested)
            occupied = {row[0] for row in con.execute("SELECT hora FROM turnos WHERE profesional_id=? AND centro_id=? AND fecha=? AND estado IN ('solicitado','confirmado','atendido')", (prof_id, center_id, requested.isoformat()))}
            if requested == date.today():
                current_hour = datetime.now().strftime("%H:00")
                slots = [slot for slot in slots if slot > current_hour]
            self.json_response(200, {"date": requested.isoformat(), "slots": [slot for slot in slots if slot not in occupied]})
        elif path == "/api/appointments":
            user = self.require_user()
            if user["rol"] == "paciente":
                rows = con.execute("""SELECT t.*, p.nombre AS profesional, e.nombre AS especialidad, c.nombre AS centro,
                    EXISTS(SELECT 1 FROM opiniones o WHERE o.turno_id=t.id) AS tiene_resena
                    FROM turnos t JOIN profesionales p ON p.id=t.profesional_id JOIN especialidades e ON e.id=p.especialidad_id
                    JOIN centros c ON c.id=t.centro_id WHERE t.paciente_id=? ORDER BY t.fecha, t.hora""", (user["id"],)).fetchall()
            elif user["rol"] == "profesional":
                rows = con.execute("""SELECT t.*, p.nombre AS profesional, e.nombre AS especialidad, c.nombre AS centro, u.nombre AS paciente,
                    EXISTS(SELECT 1 FROM opiniones o WHERE o.turno_id=t.id) AS tiene_resena
                    FROM turnos t JOIN profesionales p ON p.id=t.profesional_id JOIN especialidades e ON e.id=p.especialidad_id
                    JOIN centros c ON c.id=t.centro_id JOIN usuarios u ON u.id=t.paciente_id
                    WHERE t.profesional_id=? ORDER BY t.fecha, t.hora""", (user["profesional_id"],)).fetchall()
            else:
                rows = con.execute("""SELECT t.*, p.nombre AS profesional, e.nombre AS especialidad, c.nombre AS centro, u.nombre AS paciente,
                    EXISTS(SELECT 1 FROM opiniones o WHERE o.turno_id=t.id) AS tiene_resena
                    FROM turnos t JOIN profesionales p ON p.id=t.profesional_id JOIN especialidades e ON e.id=p.especialidad_id
                    JOIN centros c ON c.id=t.centro_id JOIN usuarios u ON u.id=t.paciente_id ORDER BY t.fecha, t.hora""").fetchall()
            self.json_response(200, {"appointments": [dict(row) for row in rows]})
        elif path == "/api/notifications":
            user = self.require_user()
            if user["rol"] == "paciente":
                tomorrow = (date.today() + timedelta(days=1)).isoformat()
                upcoming = con.execute("SELECT id, profesional_id FROM turnos WHERE paciente_id=? AND fecha=? AND estado='confirmado'", (user["id"], tomorrow)).fetchall()
                for item in upcoming:
                    prof = con.execute("SELECT nombre FROM profesionales WHERE id=?", (item["profesional_id"],)).fetchone()
                    notify(con, user["id"], f"recordatorio:{item['id']}", "Recordatorio de turno", f"Mañana tenés un turno con {prof['nombre']}.")
            rows = con.execute("SELECT id, evento, titulo, mensaje, leida, creada_en FROM notificaciones WHERE usuario_id=? ORDER BY creada_en DESC, id DESC", (user["id"],)).fetchall()
            self.json_response(200, {"notifications": [dict(row) for row in rows]})
        elif path == "/api/documents":
            user = self.require_user({"paciente", "admin"})
            patient_id = user["id"] if user["rol"] == "paciente" else int(query.get("patientId", ["0"])[0])
            rows = con.execute("""SELECT d.id, d.titulo, d.tipo, d.creado_en, p.nombre AS profesional
                FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id
                WHERE d.paciente_id=? ORDER BY d.creado_en DESC""", (patient_id,)).fetchall()
            self.json_response(200, {"documents": [dict(row) for row in rows]})
        elif re.fullmatch(r"/api/documents/\d+", path):
            user = self.require_user({"paciente", "admin"})
            document_id = int(path.rsplit("/", 1)[1])
            sql = """SELECT d.id,d.paciente_id,d.titulo,d.tipo,d.contenido,d.creado_en,p.nombre AS profesional
                     FROM documentos_paciente d JOIN profesionales p ON p.id=d.profesional_id WHERE d.id=?"""
            params = [document_id]
            if user["rol"] == "paciente":
                sql += " AND d.paciente_id=?"
                params.append(user["id"])
            row = con.execute(sql, params).fetchone()
            if not row:
                raise ApiError(404, "No encontramos ese documento para tu cuenta.")
            document = dict(row)
            document.pop("paciente_id", None)
            self.json_response(200, {"document": document})
        elif path == "/api/admin/stats":
            self.require_user({"admin"})
            stats = {
                "patients": con.execute("SELECT COUNT(*) FROM usuarios WHERE rol='paciente'").fetchone()[0],
                "professionals": con.execute("SELECT COUNT(*) FROM profesionales").fetchone()[0],
                "appointments": con.execute("SELECT COUNT(*) FROM turnos").fetchone()[0],
                "reviews": con.execute("SELECT COUNT(*) FROM opiniones WHERE oculta=0").fetchone()[0],
            }
            self.json_response(200, stats)
        elif path == "/api/admin/users":
            self.require_user({"admin"})
            rows = con.execute("SELECT id, nombre, email, rol, profesional_id, activo, creado_en FROM usuarios ORDER BY creado_en DESC").fetchall()
            self.json_response(200, {"users": [dict(row) for row in rows]})
        elif path == "/api/admin/reviews":
            self.require_user({"admin"})
            rows = con.execute("""SELECT o.id,o.profesional_id,p.nombre AS profesional,o.autor,o.puntaje,o.comentario,o.fecha,
                o.turno_id,o.oculta FROM opiniones o JOIN profesionales p ON p.id=o.profesional_id ORDER BY o.fecha DESC,o.id DESC""").fetchall()
            self.json_response(200, {"reviews": [dict(row) for row in rows]})
        else:
            raise ApiError(404, "Ruta de API no encontrada.")

    def api_post(self, con: sqlite3.Connection, path: str, payload: dict) -> None:
        if path == "/api/auth/register":
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            password = payload.get("password", "")
            if len(name) < 2 or len(name) > 100:
                raise ApiError(400, "El nombre debe tener entre 2 y 100 caracteres.")
            if not EMAIL_RE.fullmatch(email) or len(email) > 254:
                raise ApiError(400, "Ingresá un correo válido.")
            if not isinstance(password, str) or len(password) < 10 or len(password) > 200:
                raise ApiError(400, "La contraseña debe tener al menos 10 caracteres.")
            password_hash, salt = hash_password(password)
            try:
                cur = con.execute("INSERT INTO usuarios(nombre,email,password_hash,password_salt,rol) VALUES(?,?,?,?,'paciente')", (name, email, password_hash, salt))
            except sqlite3.IntegrityError:
                raise ApiError(409, "Ya existe una cuenta con ese correo.")
            con.commit()
            self.login_response(con, cur.lastrowid)
        elif path == "/api/auth/login":
            email = str(payload.get("email", "")).strip().lower()
            password = payload.get("password", "")
            row = con.execute("SELECT id, password_hash, password_salt FROM usuarios WHERE email=? AND activo=1", (email,)).fetchone()
            if not row or not isinstance(password, str) or not verify_password(password, row["password_hash"], row["password_salt"]):
                raise ApiError(401, "Correo o contraseña incorrectos.")
            self.login_response(con, row["id"])
        elif path == "/api/auth/logout":
            self.json_response(200, {"ok": True}, [("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict")])
        elif path == "/api/appointments":
            user = self.require_user({"paciente"})
            try:
                prof_id, center_id = int(payload.get("professionalId")), int(payload.get("centerId"))
                requested = date.fromisoformat(str(payload.get("date", "")))
            except (ValueError, TypeError):
                raise ApiError(400, "Profesional, centro y fecha son obligatorios.")
            slot = str(payload.get("time", ""))
            if requested < date.today() or requested > date.today() + timedelta(days=90):
                raise ApiError(400, "Elegí una fecha dentro de los próximos 90 días.")
            if not re.fullmatch(r"(?:[01]\d|2[0-3]):00", slot):
                raise ApiError(400, "El horario no es válido.")
            if slot not in valid_slots(con, prof_id, center_id, requested):
                raise ApiError(400, "Ese horario no pertenece al horario de atención.")
            if requested == date.today() and slot <= datetime.now().strftime("%H:%M"):
                raise ApiError(400, "Ese horario ya pasó.")
            try:
                cur = con.execute("INSERT INTO turnos(paciente_id,profesional_id,centro_id,fecha,hora) VALUES(?,?,?,?,?)", (user["id"], prof_id, center_id, requested.isoformat(), slot))
            except sqlite3.IntegrityError:
                raise ApiError(409, "Ese horario acaba de ser reservado. Elegí otro.")
            prof = con.execute("SELECT nombre FROM profesionales WHERE id=?", (prof_id,)).fetchone()
            notify(con, user["id"], f"turno:{cur.lastrowid}:solicitado", "Solicitud registrada", f"Tu solicitud con {prof['nombre']} quedó pendiente de confirmación.")
            con.commit()
            self.json_response(201, {"appointmentId": cur.lastrowid, "status": "solicitado"})
        elif path == "/api/professionals/me/availability":
            user = self.require_user({"profesional", "admin"})
            professional_id = user["profesional_id"] if user["rol"] == "profesional" else payload.get("professionalId")
            try:
                professional_id = int(professional_id)
            except (ValueError, TypeError):
                raise ApiError(400, "Indicá un profesional válido.")
            schedule = payload.get("schedule")
            if not isinstance(schedule, list) or len(schedule) > 60:
                raise ApiError(400, "La agenda debe ser una lista de hasta 60 franjas.")
            normalized = []
            for item in schedule:
                try:
                    center_id, day = int(item["centerId"]), int(item["day"])
                    hour_from, hour_to = int(item["fromHour"]), int(item["toHour"])
                except (KeyError, ValueError, TypeError):
                    raise ApiError(400, "Cada franja necesita centro, día y horas válidas.")
                if not 0 <= day <= 6 or not 0 <= hour_from <= 23 or not 1 <= hour_to <= 24 or hour_to <= hour_from:
                    raise ApiError(400, "Revisá los días y horas de disponibilidad.")
                if not con.execute("SELECT 1 FROM profesional_centro WHERE profesional_id=? AND centro_id=?", (professional_id, center_id)).fetchone():
                    raise ApiError(400, "El profesional no atiende en uno de los centros indicados.")
                normalized.append((professional_id, center_id, day, hour_from, hour_to))
            con.execute("DELETE FROM horarios_profesional WHERE profesional_id=?", (professional_id,))
            con.executemany("INSERT INTO horarios_profesional(profesional_id,centro_id,dia,hora_desde,hora_hasta) VALUES(?,?,?,?,?)", normalized)
            con.execute("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)", (user["id"], "actualizar_disponibilidad", "profesionales", professional_id))
            con.commit()
            self.json_response(200, {"ok": True, "franjas": len(normalized)})
        elif path == "/api/reviews":
            user = self.require_user({"paciente"})
            try:
                appointment_id = int(payload.get("appointmentId"))
                rating = int(payload.get("rating"))
            except (ValueError, TypeError):
                raise ApiError(400, "Turno y puntuación son obligatorios.")
            comment = str(payload.get("comment", "")).strip()
            if not 1 <= rating <= 5 or not 3 <= len(comment) <= 1000:
                raise ApiError(400, "La puntuación debe ser de 1 a 5 y el comentario de 3 a 1000 caracteres.")
            appointment = con.execute("SELECT id, profesional_id, estado FROM turnos WHERE id=? AND paciente_id=?", (appointment_id, user["id"])).fetchone()
            if not appointment:
                raise ApiError(404, "No encontramos ese turno en tu cuenta.")
            if appointment["estado"] != "atendido":
                raise ApiError(409, "Podés reseñar solamente un turno atendido.")
            try:
                cur = con.execute("INSERT INTO opiniones(profesional_id,autor,puntaje,comentario,turno_id) VALUES(?,?,?,?,?)", (appointment["profesional_id"], user["nombre"], rating, comment, appointment_id))
            except sqlite3.IntegrityError:
                raise ApiError(409, "Ese turno ya tiene una reseña.")
            con.commit()
            self.json_response(201, {"reviewId": cur.lastrowid, "verified": True})
        elif path == "/api/documents":
            user = self.require_user({"profesional", "admin"})
            try:
                appointment_id = int(payload.get("appointmentId"))
            except (ValueError, TypeError):
                raise ApiError(400, "El turno asociado es obligatorio.")
            title = str(payload.get("title", "")).strip()
            kind = str(payload.get("type", "")).strip()
            content = str(payload.get("content", "")).strip()
            if not 3 <= len(title) <= 120 or not 2 <= len(kind) <= 60 or not 3 <= len(content) <= 20000:
                raise ApiError(400, "Completá título, tipo y contenido dentro de los límites indicados.")
            appointment = con.execute("SELECT * FROM turnos WHERE id=? AND estado='atendido'", (appointment_id,)).fetchone()
            if not appointment:
                raise ApiError(409, "Solo se pueden adjuntar resultados a un turno atendido.")
            if user["rol"] == "profesional" and user["profesional_id"] != appointment["profesional_id"]:
                raise ApiError(403, "Ese turno pertenece a otro profesional.")
            cur = con.execute("INSERT INTO documentos_paciente(paciente_id,profesional_id,turno_id,titulo,tipo,ubicacion,contenido) VALUES(?,?,?,?,?,'database',?)", (appointment["paciente_id"], appointment["profesional_id"], appointment_id, title, kind, content))
            notify(con, appointment["paciente_id"], f"documento:{cur.lastrowid}", "Nuevo resultado disponible", f"Se agregó documentación de tu consulta: {title}.")
            con.execute("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)", (user["id"], "agregar_documento", "documentos_paciente", cur.lastrowid))
            con.commit()
            self.json_response(201, {"documentId": cur.lastrowid})
        else:
            raise ApiError(404, "Ruta de API no encontrada.")

    def api_patch(self, con: sqlite3.Connection, path: str, payload: dict) -> None:
        match = re.fullmatch(r"/api/appointments/(\d+)/status", path)
        if match:
            user = self.require_user({"profesional", "admin"})
            appointment_id = int(match.group(1))
            new_status = payload.get("status")
            if new_status not in {"confirmado", "rechazado", "atendido"}:
                raise ApiError(400, "Estado de turno no válido.")
            row = con.execute("SELECT * FROM turnos WHERE id=?", (appointment_id,)).fetchone()
            if not row:
                raise ApiError(404, "No encontramos ese turno.")
            if user["rol"] == "profesional" and user["profesional_id"] != row["profesional_id"]:
                raise ApiError(403, "Este turno pertenece a otro profesional.")
            allowed = {"solicitado": {"confirmado", "rechazado"}, "confirmado": {"atendido"}}
            if new_status not in allowed.get(row["estado"], set()):
                raise ApiError(409, "El cambio de estado no corresponde al flujo del turno.")
            con.execute("UPDATE turnos SET estado=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?", (new_status, appointment_id))
            notify(con, row["paciente_id"], f"turno:{appointment_id}:{new_status}", "Actualización de turno", f"El estado de tu turno cambió a {new_status}.")
            con.execute("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)", (user["id"], f"turno_{new_status}", "turnos", appointment_id))
            con.commit()
            self.json_response(200, {"id": appointment_id, "status": new_status})
            return
        match = re.fullmatch(r"/api/notifications/(\d+)", path)
        if match:
            user = self.require_user()
            cur = con.execute("UPDATE notificaciones SET leida=1 WHERE id=? AND usuario_id=?", (int(match.group(1)), user["id"]))
            if cur.rowcount == 0:
                raise ApiError(404, "No encontramos ese aviso.")
            con.commit()
            self.json_response(200, {"ok": True})
            return
        match = re.fullmatch(r"/api/admin/reviews/(\d+)", path)
        if match:
            user = self.require_user({"admin"})
            hidden = payload.get("hidden")
            if not isinstance(hidden, bool):
                raise ApiError(400, "El campo hidden debe ser verdadero o falso.")
            review_id = int(match.group(1))
            cur = con.execute("UPDATE opiniones SET oculta=? WHERE id=?", (int(hidden), review_id))
            if cur.rowcount == 0:
                raise ApiError(404, "No encontramos esa reseña.")
            con.execute("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)", (user["id"], "moderar_resena", "opiniones", review_id))
            con.commit()
            self.json_response(200, {"ok": True, "hidden": hidden})
            return
        match = re.fullmatch(r"/api/admin/users/(\d+)", path)
        if match:
            user = self.require_user({"admin"})
            active = payload.get("active")
            target_id = int(match.group(1))
            if not isinstance(active, bool):
                raise ApiError(400, "El campo active debe ser verdadero o falso.")
            if target_id == user["id"] and not active:
                raise ApiError(409, "No podés desactivar tu propia cuenta.")
            cur = con.execute("UPDATE usuarios SET activo=? WHERE id=?", (int(active), target_id))
            if cur.rowcount == 0:
                raise ApiError(404, "No encontramos esa cuenta.")
            con.execute("INSERT INTO registro_admin(usuario_id,accion,entidad,entidad_id) VALUES(?,?,?,?)", (user["id"], "activar_cuenta" if active else "desactivar_cuenta", "usuarios", target_id))
            con.commit()
            self.json_response(200, {"ok": True, "active": active})
            return
        raise ApiError(404, "Ruta de API no encontrada.")

    def login_response(self, con: sqlite3.Connection, user_id: int) -> None:
        row = con.execute("SELECT id, nombre, email, rol, profesional_id FROM usuarios WHERE id=?", (user_id,)).fetchone()
        token = signed_session(row["id"], row["rol"], int(time.time()))
        cookie = f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Strict"
        self.json_response(200, {"user": dict(row)}, [("Set-Cookie", cookie)])

    def serve_static(self, path: str) -> None:
        if path in {"", "/"}:
            candidate = ROOT / "index.html"
        else:
            parts = [unquote(piece) for piece in path.lstrip("/").split("/")]
            if not parts or parts[0] not in ALLOWED_STATIC_ROOTS:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            candidate = ROOT.joinpath(*parts)
        try:
            resolved = candidate.resolve(strict=True)
            if not resolved.is_file() or ROOT not in resolved.parents or resolved.suffix.lower() not in {".html", ".css", ".js", ".png", ".jpg", ".svg", ".ico"}:
                raise FileNotFoundError
            body = resolved.read_bytes()
        except (OSError, RuntimeError):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        if resolved.suffix.lower() in {".html", ".css", ".js", ".svg"}:
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def provision_user(email: str, name: str, role: str, professional_id: int | None) -> None:
    if role not in {"admin", "profesional"}:
        raise SystemExit("El rol debe ser admin o profesional.")
    if role == "profesional" and professional_id is None:
        raise SystemExit("Para crear una cuenta profesional, indicá su id de profesional.")
    from getpass import getpass
    first = getpass("Contraseña (mínimo 10 caracteres): ")
    second = getpass("Repetir contraseña: ")
    if first != second or len(first) < 10:
        raise SystemExit("Las contraseñas no coinciden o son demasiado cortas.")
    digest, salt = hash_password(first)
    migrate()
    with connect_db() as con:
        con.execute("INSERT INTO usuarios(nombre,email,password_hash,password_salt,rol,profesional_id) VALUES(?,?,?,?,?,?)", (name.strip(), email.strip().lower(), digest, salt, role, professional_id))
    print(f"Cuenta {role} creada para {email}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local para MediLink")
    parser.add_argument("--host", default="127.0.0.1", help="Dirección de escucha; por defecto solo esta computadora")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--create-user", nargs=3, metavar=("ROL", "NOMBRE", "EMAIL"), help="Crear cuenta admin/profesional de forma interactiva")
    parser.add_argument("--professional-id", type=int, help="Id requerido al crear cuenta profesional")
    args = parser.parse_args()
    if args.create_user:
        role, name, email = args.create_user
        provision_user(email, name, role, args.professional_id)
        return
    migrate()
    httpd = ThreadingHTTPServer((args.host, args.port), MediLinkHandler)
    print(f"MediLink listo en http://{args.host}:{args.port}")
    print("La sesión es local; detené el servidor con Ctrl+C.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
