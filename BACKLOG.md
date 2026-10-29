# MediLink - Backlog del proyecto

Este documento transforma las 12 historias de usuario en tareas de trabajo para GitHub.

## Cómo trabajar con este backlog

- Crear un Issue por cada historia de usuario.
- Usar las tareas y criterios de aceptación como checklist.
- Trabajar en ramas con nombres como `feature/hu-01-busqueda`.
- Cerrar el Issue solamente cuando todos sus criterios estén cumplidos.
- Mantener `main` estable y trabajar mediante Pull Requests.

## Prioridades y fases

### MVP para pacientes

Estas historias forman el primer flujo funcional de MediLink:

1. HU-01 - Buscar profesionales
2. HU-02 - Consultar perfil profesional
3. HU-03 - Solicitar un turno
4. HU-04 - Gestionar turnos
5. HU-06 - Valorar y reseñar
6. HU-07 - Recibir notificaciones

### Segunda etapa

- HU-05 - Consultar resultados y documentación.
- HU-08 - Administrar el sistema.
- HU-09 - Consultar estadísticas.
- HU-10 - Administrar perfil profesional.
- HU-11 - Gestionar centros y agenda.
- HU-12 - Proteger accesos y permisos.

> Aunque HU-04, HU-08, HU-10 y HU-11 corresponden a profesionales o administradores, son necesarias para que el flujo del paciente funcione correctamente.

---

## HU-01 - Buscar profesionales

**Como** paciente, **quiero** buscar profesionales por nombre, especialidad, hospital o ciudad **para** encontrar rápidamente al profesional que necesito.

- **Prioridad original:** 1200
- **Estimación:** 3 días / 12 horas
- **Responsable original:** Ledesma Cristian
- **Dependencias:** Ninguna

### Criterios de aceptación

- [ ] Buscar por nombre y mostrar resultados relevantes.
- [ ] Buscar por especialidad y mostrar coincidencias.
- [ ] Buscar por hospital o ciudad.
- [ ] Combinar filtros y actualizar correctamente los resultados.
- [ ] Mostrar un estado claro cuando no existan resultados.
- [ ] Funcionar en web y móvil.

## HU-02 - Consultar perfil profesional

**Como** paciente, **quiero** consultar el perfil de un profesional **para** conocer su especialidad, centros, horarios, teléfono, experiencia y valoraciones.

- **Prioridad original:** 1100
- **Estimación:** 4 días / 16 horas
- **Responsable original:** Palacios Francisco
- **Dependencias:** HU-01

### Criterios de aceptación

- [ ] Abrir un perfil desde los resultados de búsqueda.
- [ ] Mostrar especialidad, experiencia y datos de contacto.
- [ ] Mostrar centros y horarios de atención.
- [ ] Mostrar valoraciones y reseñas.
- [ ] Informar claramente cuando el perfil no esté disponible.

## HU-03 - Solicitar un turno

**Como** paciente, **quiero** solicitar un turno en un horario disponible **para** organizar mi consulta.

- **Prioridad original:** 1000
- **Estimación:** 5 días / 20 horas
- **Responsable original:** Galarze Albornoz
- **Dependencias:** HU-02

### Criterios de aceptación

- [ ] Seleccionar profesional, centro, fecha y horario.
- [ ] Mostrar únicamente horarios disponibles.
- [ ] Registrar la solicitud con estado `Solicitado`.
- [ ] Confirmar al paciente que la solicitud fue registrada.
- [ ] Evitar reservar dos veces el mismo horario.

## HU-04 - Gestionar turnos

**Como** profesional, **quiero** confirmar, rechazar y marcar como atendido un turno **para** gestionar mi agenda y conservar el estado trazable.

- **Prioridad original:** 950
- **Estimación:** 4 días / 16 horas
- **Responsable original:** Ledesma Cristian
- **Dependencias:** HU-03

### Criterios de aceptación

- [ ] Ver pedidos y próximos turnos en la agenda.
- [ ] Confirmar o rechazar una solicitud.
- [ ] Marcar como atendido un turno realizado.
- [ ] Evitar cambios de estado inválidos.
- [ ] Mostrar el estado actualizado al paciente.

## HU-05 - Consultar resultados

**Como** paciente, **quiero** consultar resultados y documentación autorizada **para** acceder a la información de mi atención.

- **Prioridad original:** 900
- **Estimación:** 5 días / 20 horas
- **Responsable original:** Palacios Francisco
- **Dependencias:** HU-04

### Criterios de aceptación

- [ ] Mostrar documentos vinculados a la atención del paciente.
- [ ] Permitir la consulta solamente a usuarios autorizados.
- [ ] Mostrar fecha y profesional asociado.
- [ ] Informar cuando no exista documentación.

## HU-06 - Valorar y reseñar

**Como** paciente, **quiero** valorar y reseñar una consulta atendida **para** compartir mi experiencia con otros pacientes.

- **Prioridad original:** 850
- **Estimación:** 4 días / 16 horas
- **Responsable original:** Galarze Albornoz
- **Dependencias:** HU-04

### Criterios de aceptación

- [ ] Habilitar la reseña solamente después de marcar el turno como atendido.
- [ ] Registrar puntaje y comentario.
- [ ] Identificar la opinión como consulta verificada.
- [ ] Evitar más de una reseña para el mismo turno.
- [ ] Validar y escapar el contenido ingresado por el usuario.

## HU-07 - Recibir notificaciones

**Como** paciente, **quiero** recibir notificaciones de confirmaciones y recordatorios **para** enterarme a tiempo de los eventos de mi atención.

- **Prioridad original:** 800
- **Estimación:** 3 días / 12 horas
- **Responsable original:** Ledesma Cristian
- **Dependencias:** HU-03 y HU-04

### Criterios de aceptación

- [ ] Notificar la creación y el cambio de estado de un turno.
- [ ] Enviar recordatorios de consultas próximas.
- [ ] Mostrar el historial de avisos.
- [ ] No duplicar notificaciones para el mismo evento.

## HU-08 - Administrar el sistema

**Como** administrador, **quiero** controlar usuarios, centros, profesionales, turnos y reseñas **para** mantener la calidad y confiabilidad del sistema.

- **Prioridad original:** 750
- **Estimación:** 6 días / 24 horas
- **Responsable original:** Palacios Francisco
- **Dependencias:** HU-01 a HU-07

### Criterios de aceptación

- [ ] Consultar registros según los permisos del administrador.
- [ ] Verificar y actualizar usuarios y profesionales.
- [ ] Moderar reseñas y revisar estados de turnos.
- [ ] Registrar los cambios administrativos.

## HU-09 - Consultar estadísticas

**Como** administrador, **quiero** consultar estadísticas de uso de MediLink **para** evaluar el funcionamiento y orientar decisiones.

- **Prioridad original:** 700
- **Estimación:** 4 días / 16 horas
- **Responsable original:** Galarze Albornoz
- **Dependencias:** HU-08

### Criterios de aceptación

- [ ] Mostrar cantidad de búsquedas, turnos y valoraciones.
- [ ] Filtrar indicadores por período.
- [ ] Presentar datos legibles y consistentes.
- [ ] Informar cuando no existan datos para el período.

## HU-10 - Administrar perfil profesional

**Como** profesional, **quiero** actualizar mis datos, especialidades y experiencia **para** mantener mi perfil confiable y vigente.

- **Prioridad original:** 650
- **Estimación:** 4 días / 16 horas
- **Responsable original:** Ledesma Cristian
- **Dependencias:** HU-02 y HU-08

### Criterios de aceptación

- [ ] Editar datos personales y profesionales autorizados.
- [ ] Agregar o quitar especialidades según permisos.
- [ ] Guardar cambios y reflejarlos en el perfil público.
- [ ] Validar campos obligatorios.

## HU-11 - Gestionar centros y agenda

**Como** centro o profesional, **quiero** administrar centros de atención, horarios y disponibilidad **para** ofrecer turnos coherentes con la atención real.

- **Prioridad original:** 600
- **Estimación:** 5 días / 20 horas
- **Responsable original:** Palacios Francisco
- **Dependencias:** HU-03 y HU-10

### Criterios de aceptación

- [ ] Registrar y actualizar datos de un centro.
- [ ] Definir días, horarios y disponibilidad.
- [ ] Relacionar profesionales con centros válidos.
- [ ] No ofrecer turnos fuera de la agenda configurada.

## HU-12 - Proteger accesos y permisos

**Como** administrador, **quiero** aplicar permisos según el rol y proteger la documentación **para** evitar accesos indebidos a información sensible.

- **Prioridad original:** 550
- **Estimación:** 5 días / 20 horas
- **Responsable original:** Galarze Albornoz
- **Dependencias:** HU-05 y HU-08

### Criterios de aceptación

- [ ] Restringir cada función según el rol del usuario.
- [ ] Permitir documentos solamente a pacientes y roles autorizados.
- [ ] Bloquear accesos sin autenticación válida.
- [ ] Registrar intentos y cambios relevantes de permisos.

---

## Reparto sugerido para tres integrantes

### Integrante 1 - Experiencia del paciente

- HU-01: búsqueda.
- HU-02: perfil profesional.
- HU-03: flujo de solicitud de turno.
- Interfaces web y móvil para pacientes.

### Integrante 2 - Profesionales y agenda

- HU-04: gestión de turnos.
- HU-10: perfil profesional.
- HU-11: centros, horarios y disponibilidad.
- Agenda y estados de turnos.

### Integrante 3 - Plataforma y seguridad

- HU-05: resultados y documentación.
- HU-07: notificaciones.
- HU-08: administración.
- HU-09: estadísticas.
- HU-12: autenticación, roles y permisos.

### Trabajo compartido

- HU-06: reseñas.
- Modelo de datos y API.
- Pruebas de aceptación.
- Documentación y presentación del TFI.

## Primer Sprint recomendado

1. Confirmar el repositorio y la estrategia de ramas.
2. Crear el modelo de datos para usuarios, profesionales, centros y turnos.
3. Implementar HU-01 en web y móvil.
4. Implementar HU-02 sobre los resultados de búsqueda.
5. Preparar pruebas de aceptación para HU-01 y HU-02.
6. Crear Pull Requests y revisar el trabajo entre compañeros.

## Flujo principal del MVP

`Paciente busca profesional -> consulta perfil -> elige centro y horario -> solicita turno -> recibe confirmación -> consulta el turno en la aplicación`
