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

-- Relación muchos a muchos: un profesional atiende en varios centros
-- y un centro tiene varios profesionales
CREATE TABLE profesional_centro (
    profesional_id INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    centro_id      INTEGER NOT NULL REFERENCES centros(id)       ON DELETE CASCADE,
    PRIMARY KEY (profesional_id, centro_id)
);

-- Opiniones de los pacientes
CREATE TABLE opiniones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    profesional_id  INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    autor           TEXT    NOT NULL DEFAULT 'Anónimo',
    puntaje         INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      TEXT    NOT NULL,
    fecha           TEXT    NOT NULL DEFAULT (date('now'))   -- AAAA-MM-DD
);

CREATE INDEX idx_prof_especialidad ON profesionales(especialidad_id);
CREATE INDEX idx_opiniones_prof    ON opiniones(profesional_id);
CREATE INDEX idx_prof_centro_c     ON profesional_centro(centro_id);
CREATE INDEX idx_horarios_centro   ON horarios_centro(centro_id);

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
