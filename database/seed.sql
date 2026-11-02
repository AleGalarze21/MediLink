-- =====================================================================
--  MediLink — Datos de ejemplo (teléfonos, direcciones y opiniones ficticios)
-- =====================================================================
PRAGMA foreign_keys = ON;

-- Especialidades
INSERT INTO especialidades (id, nombre) VALUES
  (1, 'Cardiología'),
  (2, 'Pediatría'),
  (3, 'Dermatología'),
  (4, 'Clínica Médica'),
  (5, 'Traumatología'),
  (6, 'Ginecología'),
  (7, 'Oftalmología');

-- Centros de atención
INSERT INTO centros (id, nombre, direccion, ciudad, telefono, nota) VALUES
  (1, 'Hospital San Martín', 'Av. Belgrano 1200', 'San Miguel de Tucumán', '0381 555-0101', 'Guardia las 24 hs'),
  (2, 'Clínica del Norte', 'Av. Mate de Luna 2450', 'Yerba Buena', '0381 555-0102', NULL),
  (3, 'Sanatorio Central', '24 de Septiembre 800', 'San Miguel de Tucumán', '0381 555-0103', 'Domingos solo guardia'),
  (4, 'Hospital de Niños', 'Av. Mitre 950', 'San Miguel de Tucumán', '0381 555-0104', 'Guardia pediátrica 24 hs'),
  (5, 'Centro de Salud Belgrano', 'Av. Roca 300', 'Concepción', '0381 555-0105', NULL);

-- Horarios de los centros (dias: 0=domingo ... 6=sábado)
INSERT INTO horarios_centro (centro_id, etiqueta, dias, hora_desde, hora_hasta, texto) VALUES
  (1, 'Lunes a viernes', '1,2,3,4,5', 7, 20, '07:00 – 20:00'),
  (1, 'Sábados', '6', 8, 13, '08:00 – 13:00'),
  (2, 'Lunes a viernes', '1,2,3,4,5', 8, 19, '08:00 – 19:00'),
  (2, 'Sábados', '6', 9, 13, '09:00 – 13:00'),
  (3, 'Lunes a sábado', '1,2,3,4,5,6', 7, 21, '07:00 – 21:00'),
  (4, 'Lunes a viernes', '1,2,3,4,5', 7, 18, '07:00 – 18:00'),
  (5, 'Lunes a viernes', '1,2,3,4,5', 8, 16, '08:00 – 16:00');

-- Profesionales
INSERT INTO profesionales (id, nombre, especialidad_id, ciudad, anios_experiencia, verificado, color) VALUES
  (1, 'Dr. Juan Pérez', 1, 'San Miguel de Tucumán', 18, 1, 'blue'),
  (2, 'Dra. Marisa Suárez', 1, 'Yerba Buena', 12, 1, 'mint'),
  (3, 'Dr. Roberto Gómez', 1, 'Tafí Viejo', 25, 1, 'green'),
  (4, 'Dra. Lucía Fernández', 2, 'San Miguel de Tucumán', 9, 1, 'mint'),
  (5, 'Dr. Martín Acosta', 3, 'Yerba Buena', 11, 1, 'blue'),
  (6, 'Dra. Carla Núñez', 4, 'Concepción', 7, 1, 'green'),
  (7, 'Dr. Ezequiel Ramos', 5, 'San Miguel de Tucumán', 14, 1, 'blue'),
  (8, 'Dra. Valentina Ríos', 6, 'Yerba Buena', 10, 1, 'mint'),
  (9, 'Dr. Ignacio Molina', 7, 'Tafí Viejo', 16, 1, 'green');

-- Dónde atiende cada profesional
INSERT INTO profesional_centro (profesional_id, centro_id) VALUES
  (1, 1),
  (2, 2),
  (2, 3),
  (3, 3),
  (4, 4),
  (5, 2),
  (6, 5),
  (7, 1),
  (8, 2),
  (9, 3);

-- Ampliación ficticia: un profesional nuevo por especialidad y reseñas de 3, 4 y 5 estrellas.
INSERT OR IGNORE INTO profesionales (id, nombre, especialidad_id, ciudad, anios_experiencia, verificado, color) VALUES
  (10, 'Dra. Elena Quiroga', 1, 'San Miguel de Tucumán', 8, 1, 'mint'),
  (11, 'Dr. Nicolás Herrera', 2, 'San Miguel de Tucumán', 6, 1, 'blue'),
  (12, 'Dra. Paula Benítez', 3, 'Yerba Buena', 9, 1, 'green'),
  (13, 'Dr. Sebastián Roldán', 4, 'Concepción', 13, 1, 'blue'),
  (14, 'Dra. Mariana Sosa', 5, 'San Miguel de Tucumán', 7, 1, 'mint'),
  (15, 'Dr. Tomás Medina', 6, 'Yerba Buena', 11, 1, 'green'),
  (16, 'Dra. Camila Torres', 7, 'San Miguel de Tucumán', 5, 1, 'blue');

INSERT OR IGNORE INTO profesional_especialidad (profesional_id, especialidad_id)
SELECT id, especialidad_id FROM profesionales;

INSERT OR IGNORE INTO profesional_centro (profesional_id, centro_id) VALUES
  (10,1),(11,4),(12,2),(13,5),(14,1),(15,2),(16,3);

INSERT OR IGNORE INTO horarios_profesional (profesional_id, centro_id, dia, hora_desde, hora_hasta) VALUES
  (10,1,1,9,16),(10,1,2,9,16),(10,1,3,9,16),(10,1,4,9,16),(10,1,5,9,16),
  (11,4,1,8,16),(11,4,2,8,16),(11,4,3,8,16),(11,4,4,8,16),(11,4,5,8,16),
  (12,2,1,8,16),(12,2,2,8,16),(12,2,3,8,16),(12,2,4,8,16),(12,2,5,8,16),
  (13,5,1,9,15),(13,5,2,9,15),(13,5,3,9,15),(13,5,4,9,15),(13,5,5,9,15),
  (14,1,1,8,16),(14,1,3,8,16),(14,1,5,8,16),
  (15,2,1,9,16),(15,2,2,9,16),(15,2,3,9,16),(15,2,4,9,16),(15,2,5,9,16),
  (16,3,1,8,18),(16,3,2,8,18),(16,3,3,8,18),(16,3,4,8,18),(16,3,5,8,18),(16,3,6,8,13);

-- Opiniones ficticias de ejemplo; no están vinculadas a turnos atendidos.
WITH v(profesional_id,autor,puntaje,comentario,fecha) AS (VALUES
  (10,'Laura C.',3,'La consulta fue correcta, aunque hubo demora.','2026-10-12'),(10,'Pablo M.',4,'Escuchó mis dudas y explicó los pasos con claridad.','2026-10-20'),(10,'Marta R.',5,'Muy buena atención y trato amable.','2026-10-28'),
  (11,'Sofía D.',3,'Buena atención, la espera podría mejorar.','2026-10-13'),(11,'Andrés P.',4,'Fue paciente y claro con mi hijo.','2026-10-21'),(11,'Carla B.',5,'Excelente trato, mi hijo estuvo tranquilo.','2026-10-29'),
  (12,'Nora G.',3,'La consulta fue útil, pero algo breve.','2026-10-14'),(12,'Iván L.',4,'Revisó todo con cuidado y respondió mis preguntas.','2026-10-22'),(12,'Rocío F.',5,'Muy profesional y amable.','2026-10-30'),
  (13,'Marcos T.',3,'Buena orientación para continuar el tratamiento.','2026-10-15'),(13,'Julia N.',4,'Explicó con claridad el plan de recuperación.','2026-10-23'),(13,'Emanuel V.',5,'Atención excelente y muy completa.','2026-10-31'),
  (14,'Belén A.',3,'La atención fue buena, con algo de demora.','2026-10-16'),(14,'Diego S.',4,'Me indicó ejercicios y respondió mis consultas.','2026-10-24'),(14,'Micaela R.',5,'Muy dedicada durante toda la consulta.','2026-11-01'),
  (15,'Ana P.',3,'La consulta estuvo bien y fue puntual.','2026-10-17'),(15,'Gustavo E.',4,'Me sentí cómodo y bien informado.','2026-10-25'),(15,'Florencia M.',5,'Excelente atención, muy respetuoso.','2026-11-01'),
  (16,'Ramiro C.',3,'Correcta atención, aunque la espera fue larga.','2026-10-18'),(16,'Noelia H.',4,'Fue minuciosa y respondió todas mis preguntas.','2026-10-26'),(16,'Santiago D.',5,'Muy buena experiencia, clara y profesional.','2026-11-02')
)
INSERT INTO opiniones (profesional_id, autor, puntaje, comentario, fecha)
SELECT v.profesional_id, v.autor, v.puntaje, v.comentario, v.fecha FROM v
WHERE NOT EXISTS (SELECT 1 FROM opiniones o WHERE o.profesional_id=v.profesional_id AND o.autor=v.autor AND o.comentario=v.comentario);

-- Opiniones de pacientes
INSERT INTO opiniones (profesional_id, autor, puntaje, comentario, fecha) VALUES
  (1, 'Marta L.', 5, 'Excelente atención, muy claro con las explicaciones.', '2026-09-24'),
  (1, 'Diego R.', 5, 'Puntual y atento, me tranquilizó mucho.', '2026-09-08'),
  (1, 'Sofía T.', 4, 'Muy buen profesional, la espera fue larga.', '2026-08-09'),
  (2, 'Carlos M.', 5, 'Muy buena predisposición y trato humano.', '2026-09-17'),
  (2, 'Lorena V.', 4, 'Explica todo con paciencia.', '2026-08-09'),
  (2, 'Pedro A.', 4, 'Buena atención en ambos lugares.', '2026-06-10'),
  (3, 'Elena G.', 5, 'El mejor cardiólogo que consulté.', '2026-10-01'),
  (3, 'Raúl S.', 5, 'Muy profesional, 25 años de experiencia se notan.', '2026-09-08'),
  (3, 'Ana P.', 5, 'Me solucionó lo que otros no pudieron.', '2026-07-10'),
  (4, 'Julia B.', 5, 'Muy paciente con los chicos, mi hija se sintió cómoda.', '2026-09-24'),
  (4, 'Martín C.', 5, 'Súper amable y clara.', '2026-09-08'),
  (4, 'Romina D.', 4, 'Muy buena, aunque cuesta conseguir turno.', '2026-08-09'),
  (5, 'Nadia F.', 4, 'Diagnóstico rápido y preciso.', '2026-09-08'),
  (5, 'Luis H.', 5, 'Resolvió mi problema de piel en pocas visitas.', '2026-08-09'),
  (5, 'Camila O.', 4, 'Buen trato, consultorio ordenado.', '2026-07-10'),
  (6, 'Rosa T.', 4, 'Atención cálida y clara.', '2026-09-17'),
  (6, 'Hugo N.', 4, 'Muy dedicada con cada paciente.', '2026-08-09'),
  (6, 'Silvia E.', 5, 'Me escuchó con calma, excelente.', '2026-05-11'),
  (7, 'Franco Q.', 5, 'Resolvió mi lesión rápido.', '2026-09-24'),
  (7, 'Paula R.', 4, 'Muy bueno, me explicó la rehabilitación.', '2026-09-08'),
  (7, 'Iván K.', 4, 'Recomendable.', '2026-07-10'),
  (8, 'Agustina M.', 5, 'Muy profesional y respetuosa.', '2026-10-01'),
  (8, 'Gisela L.', 5, 'Te hace sentir cómoda en todo momento.', '2026-09-08'),
  (8, 'Belén C.', 4, 'Excelente atención.', '2026-08-09'),
  (9, 'Oscar D.', 4, 'Buen trato y explicación detallada.', '2026-09-08'),
  (9, 'Marina J.', 5, 'Muy minucioso con los estudios.', '2026-08-09'),
  (9, 'Tomás W.', 4, 'Atento y puntual.', '2026-06-10');
