-- Extensiones para cuentas, turnos, avisos y documentación de pacientes.
-- Se puede ejecutar varias veces; el servidor añade turno_id a opiniones
-- en bases preexistentes cuando esa columna todavía no está presente.

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('paciente','profesional','admin')),
    profesional_id INTEGER UNIQUE REFERENCES profesionales(id) ON DELETE CASCADE,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((rol = 'profesional' AND profesional_id IS NOT NULL) OR (rol != 'profesional' AND profesional_id IS NULL))
);

CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profesional_id INTEGER NOT NULL REFERENCES profesionales(id),
    centro_id INTEGER NOT NULL REFERENCES centros(id),
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','confirmado','rechazado','atendido','cancelado')),
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesional_id, centro_id) REFERENCES profesional_centro(profesional_id, centro_id)
);

CREATE TABLE IF NOT EXISTS horarios_profesional (
    profesional_id INTEGER NOT NULL,
    centro_id INTEGER NOT NULL,
    dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
    hora_desde INTEGER NOT NULL CHECK (hora_desde BETWEEN 0 AND 23),
    hora_hasta INTEGER NOT NULL CHECK (hora_hasta BETWEEN 1 AND 24),
    FOREIGN KEY (profesional_id, centro_id) REFERENCES profesional_centro(profesional_id, centro_id) ON DELETE CASCADE,
    PRIMARY KEY (profesional_id, centro_id, dia, hora_desde),
    CHECK (hora_hasta > hora_desde)
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
    creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_paciente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profesional_id INTEGER NOT NULL REFERENCES profesionales(id),
    turno_id INTEGER REFERENCES turnos(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    contenido TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registro_admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL,
    entidad_id INTEGER,
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Añadidas también en CREATE TABLE para instalaciones nuevas; el servidor
-- incorpora estas columnas con una migración segura en bases existentes.

CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_horario_activo
    ON turnos(profesional_id, centro_id, fecha, hora)
    WHERE estado IN ('solicitado','confirmado','atendido');
CREATE INDEX IF NOT EXISTS idx_turnos_paciente ON turnos(paciente_id, fecha, hora);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional ON turnos(profesional_id, fecha, hora);
CREATE INDEX IF NOT EXISTS idx_horarios_profesional ON horarios_profesional(profesional_id, centro_id, dia);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, creada_en);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON documentos_paciente(paciente_id, creado_en);
