# MediLink - Plan de trabajo para 3 integrantes

## Objetivo del equipo

Construir el MVP paciente completo:

`buscar profesional -> ver perfil -> elegir horario -> solicitar turno -> consultar turno -> reseñar`

Cada integrante trabaja en su propia rama y crea un Pull Request hacia `mvp-paciente`.

## Integrante 1 - Interfaz del paciente

### Responsabilidad

Experiencia visual y navegación de pacientes en web y móvil.

### Historias

- HU-01: buscar profesionales.
- HU-02: consultar perfil profesional.
- Parte visual de HU-03: selección de centro, fecha y horario.
- Adaptación del logo y diseño definitivo.

### Archivos principales

- `index.html`
- `web/index.html`
- `mobile/index.html`
- `web/css/web.css`
- `mobile/css/mobile.css`
- `shared/css/base.css`
- `shared/js/views.js` para la presentación.

### Rama sugerida

```text
feature/interfaz-paciente
```

## Integrante 2 - Turnos y agenda

### Responsabilidad

Flujo de turnos y disponibilidad de profesionales.

### Historias

- HU-03: solicitar un turno.
- HU-04: gestionar turnos.
- HU-11: gestionar centros y agenda.

### Entregas

- Estados: `Solicitado`, `Confirmado`, `Rechazado`, `Atendido`.
- Validación para no duplicar horarios.
- Agenda del profesional.
- Disponibilidad por centro, fecha y horario.

### Archivos principales

- `database/schema.sql`
- `database/seed.sql`
- `database/crear_base.py`
- `shared/js/helpers.js` para la lógica provisional.
- Backend de turnos cuando se cree.

### Rama sugerida

```text
feature/turnos-agenda
```

## Integrante 3 - Datos, seguridad y comunicación

### Responsabilidad

Persistencia, usuarios, permisos y funciones posteriores al turno.

### Historias

- HU-05: consultar resultados y documentación.
- HU-06: valorar y reseñar.
- HU-07: recibir notificaciones.
- HU-12: proteger accesos y permisos.

### Entregas

- Usuarios y autenticación.
- Roles: paciente, profesional y administrador.
- Reseñas verificadas solamente para turnos atendidos.
- Notificaciones de solicitudes y cambios de estado.
- Acceso protegido a documentación sensible.

### Archivos principales

- `database/schema.sql`
- `database/export_data.py`
- Backend y API.
- `shared/js/data.js` únicamente mediante el exportador.

### Rama sugerida

```text
feature/datos-seguridad
```

## Trabajo compartido posterior

Cuando el MVP paciente esté funcionando, repartir las historias restantes:

- HU-08: administración del sistema.
- HU-09: estadísticas.
- HU-10: perfil del profesional.

Estas historias pueden dividirse entre los mismos tres integrantes según quién termine primero su bloque.

## Reglas de integración

1. No modificar directamente `main`.
2. Usar `mvp-paciente` como rama de integración del MVP.
3. Crear Pull Requests pequeños, por historia o función.
4. Avisar antes de modificar un archivo que otro integrante esté usando.
5. Si se modifica la base de datos, documentar el cambio y regenerar `shared/js/data.js`.
6. Probar web y móvil antes de solicitar revisión.
7. Cada Pull Request debe indicar qué historia resuelve y qué criterios de aceptación cumple.

## Primeras tareas por integrante

### Integrante 1

- Revisar y mejorar la pantalla de búsqueda.
- Adaptar el logo definitivo.
- Revisar el perfil profesional en web y móvil.

### Integrante 2

- Revisar la solicitud de turno implementada en `mvp-paciente`.
- Probar fechas, horarios y duplicados.
- Preparar los estados futuros del turno.

### Integrante 3

- Diseñar las tablas de usuarios, turnos y notificaciones.
- Definir permisos por rol.
- Preparar la persistencia real para reemplazar `localStorage`.
