-- =====================================================================
--  MediLink — Esquema de base de datos (SQLite)
--  Plataforma de búsqueda y valoración de profesionales de la salud
-- =====================================================================
PRAGMA foreign_keys = ON;

DROP VIEW  IF EXISTS vista_profesionales_resumen;
DROP TABLE IF EXISTS opiniones;
DROP TABLE IF EXISTS profesional_centro;
DROP TABLE IF EXISTS horarios_centro;
DROP TABLE IF EXISTS profesionales;
DROP TABLE IF EXISTS centros;
DROP TABLE IF EXISTS especialidades;

-- Especialidades médicas (Cardiología, Pediatría, ...)
CREATE TABLE especialidades (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL UNIQUE
);

-- Hospitales, clínicas y centros de atención
CREATE TABLE centros (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    direccion  TEXT NOT NULL,
    ciudad     TEXT NOT NULL,
    telefono   TEXT NOT NULL,          -- para llamar y sacar turno
    nota       TEXT                    -- ej: "Guardia las 24 hs"
);

-- Franjas horarias de cada centro (un centro puede tener varias)
-- dias: números separados por coma, 0 = domingo ... 6 = sábado
CREATE TABLE horarios_centro (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id    INTEGER NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
    etiqueta     TEXT    NOT NULL,     -- "Lunes a viernes"
    dias         TEXT    NOT NULL,     -- "1,2,3,4,5"
    hora_desde   INTEGER NOT NULL CHECK (hora_desde BETWEEN 0 AND 23),
    hora_hasta   INTEGER NOT NULL CHECK (hora_hasta BETWEEN 1 AND 24),
    texto        TEXT    NOT NULL,     -- "07:00 – 20:00"
    CHECK (hora_hasta > hora_desde)
);

-- Profesionales de la salud
CREATE TABLE profesionales (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT    NOT NULL,
    especialidad_id   INTEGER NOT NULL REFERENCES especialidades(id),
    ciudad            TEXT    NOT NULL,
    anios_experiencia INTEGER NOT NULL CHECK (anios_experiencia >= 0),
    verificado        INTEGER NOT NULL DEFAULT 1 CHECK (verificado IN (0,1)),
    color             TEXT    NOT NULL DEFAULT 'green' CHECK (color IN ('green','blue','mint'))
);

-- Cuentas de acceso. El registro público crea solamente pacientes.
CREATE TABLE usuarios (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT NOT NULL,
    email             TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash     TEXT NOT NULL,
    password_salt     TEXT NOT NULL,
    rol               TEXT NOT NULL CHECK (rol IN ('paciente','profesional','admin')),
    profesional_id    INTEGER UNIQUE REFERENCES profesionales(id) ON DELETE CASCADE,
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((rol = 'profesional' AND profesional_id IS NOT NULL) OR (rol != 'profesional' AND profesional_id IS NULL))
);

-- Relación muchos a muchos: un profesional atiende en varios centros
-- y un centro tiene varios profesionales
CREATE TABLE profesional_centro (
    profesional_id INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    centro_id      INTEGER NOT NULL REFERENCES centros(id)       ON DELETE CASCADE,
    PRIMARY KEY (profesional_id, centro_id)
);

-- Disponibilidad propia de cada profesional; separada del horario de apertura del centro.
CREATE TABLE horarios_profesional (
    profesional_id INTEGER NOT NULL,
    centro_id      INTEGER NOT NULL,
    dia            INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
    hora_desde     INTEGER NOT NULL CHECK (hora_desde BETWEEN 0 AND 23),
    hora_hasta     INTEGER NOT NULL CHECK (hora_hasta BETWEEN 1 AND 24),
    FOREIGN KEY (profesional_id, centro_id) REFERENCES profesional_centro(profesional_id, centro_id) ON DELETE CASCADE,
    PRIMARY KEY (profesional_id, centro_id, dia, hora_desde),
    CHECK (hora_hasta > hora_desde)
);

-- Solicitudes de turnos y trazabilidad de sus estados.
CREATE TABLE turnos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profesional_id  INTEGER NOT NULL REFERENCES profesionales(id),
    centro_id       INTEGER NOT NULL REFERENCES centros(id),
    fecha           TEXT NOT NULL,
    hora            TEXT NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','confirmado','rechazado','atendido','cancelado')),
    creado_en       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesional_id, centro_id) REFERENCES profesional_centro(profesional_id, centro_id)
);
CREATE UNIQUE INDEX uq_turno_horario_activo
    ON turnos(profesional_id, centro_id, fecha, hora)
    WHERE estado IN ('solicitado','confirmado','atendido');

CREATE TABLE notificaciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento      TEXT NOT NULL UNIQUE,
    titulo      TEXT NOT NULL,
    mensaje     TEXT NOT NULL,
    leida       INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
    creada_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documentos_paciente (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profesional_id  INTEGER NOT NULL REFERENCES profesionales(id),
    turno_id        INTEGER REFERENCES turnos(id) ON DELETE SET NULL,
    titulo          TEXT NOT NULL,
    tipo            TEXT NOT NULL,
    ubicacion       TEXT NOT NULL,
    contenido       TEXT NOT NULL DEFAULT '',
    creado_en       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registro_admin (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion      TEXT NOT NULL,
    entidad     TEXT NOT NULL,
    entidad_id  INTEGER,
    creado_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Opiniones de los pacientes
CREATE TABLE opiniones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    profesional_id  INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    autor           TEXT    NOT NULL DEFAULT 'Anónimo',
    puntaje         INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      TEXT    NOT NULL,
    fecha           TEXT    NOT NULL DEFAULT (date('now')),  -- AAAA-MM-DD
    turno_id        INTEGER UNIQUE REFERENCES turnos(id) ON DELETE SET NULL,
    oculta          INTEGER NOT NULL DEFAULT 0 CHECK (oculta IN (0,1))
);

CREATE INDEX idx_prof_especialidad ON profesionales(especialidad_id);
CREATE INDEX idx_opiniones_prof    ON opiniones(profesional_id);
CREATE INDEX idx_prof_centro_c     ON profesional_centro(centro_id);
CREATE INDEX idx_horarios_centro   ON horarios_centro(centro_id);
CREATE INDEX idx_horarios_profesional ON horarios_profesional(profesional_id, centro_id, dia);
CREATE INDEX idx_turnos_paciente ON turnos(paciente_id, fecha, hora);
CREATE INDEX idx_turnos_profesional ON turnos(profesional_id, fecha, hora);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, creada_en);
CREATE INDEX idx_documentos_paciente ON documentos_paciente(paciente_id, creado_en);

-- Promedio y cantidad de opiniones por profesional (lo usan búsqueda y ranking)
CREATE VIEW vista_profesionales_resumen AS
SELECT  p.id,
        p.nombre,
        e.nombre                              AS especialidad,
        p.ciudad,
        p.anios_experiencia,
        COUNT(o.id)                           AS cantidad_opiniones,
        ROUND(COALESCE(AVG(o.puntaje), 0), 1) AS promedio
FROM profesionales p
JOIN especialidades e  ON e.id = p.especialidad_id
LEFT JOIN opiniones o  ON o.profesional_id = p.id
GROUP BY p.id;
