-- Consultas de ejemplo para mostrar en el TFI (sqlite3 medilink.db < consultas_ejemplo.sql)
.headers on
.mode column

-- 1) Ranking de profesionales mejor valorados
SELECT nombre, especialidad, promedio, cantidad_opiniones
FROM vista_profesionales_resumen
ORDER BY promedio DESC, cantidad_opiniones DESC;

-- 2) Dónde atiende cada profesional
SELECT p.nombre AS profesional, c.nombre AS centro, c.telefono
FROM profesional_centro pc
JOIN profesionales p ON p.id = pc.profesional_id
JOIN centros c       ON c.id = pc.centro_id
ORDER BY p.nombre;

-- 3) Profesionales de una especialidad (ej: Cardiología)
SELECT p.nombre, p.ciudad, p.anios_experiencia
FROM profesionales p
JOIN especialidades e ON e.id = p.especialidad_id
WHERE e.nombre = 'Cardiología';

-- 4) Horarios de cada centro
SELECT c.nombre, h.etiqueta, h.texto
FROM horarios_centro h JOIN centros c ON c.id = h.centro_id
ORDER BY c.nombre, h.id;

-- 5) Últimas opiniones de un profesional (ej: id 1)
SELECT autor, puntaje, comentario, fecha
FROM opiniones WHERE profesional_id = 1
ORDER BY fecha DESC;
