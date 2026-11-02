# MediLink — Conectando tu salud

MediLink permite buscar profesionales, conocer sus centros de atención y solicitar turnos desde web o móvil.

## Requisitos y ejecución

- Node.js 22.13 o superior (incluye SQLite integrado).

Desde la carpeta del proyecto:

```bash
npm install
npm run dev
```

Abrí `http://127.0.0.1:3000/`. La portada ofrece las versiones web y móvil; también podés entrar en `/web/index.html` o `/mobile/index.html`.

Para compilar y ejecutar como servidor de producción local:

```bash
npm run build
npm start
```

React envía peticiones con `fetch` y `async/await` a Express. Express entrega la API y accede a `database/medilink.db` con el módulo SQLite integrado de Node. La interfaz actual incluye búsqueda y filtros, perfiles, consulta de disponibilidad, cuentas de pacientes y turnos.

## Organización

```text
index.html             Portada
web/index.html         Aplicación web React
mobile/index.html      Aplicación móvil React
src/main.jsx           Componentes y formularios React
src/api.js             Peticiones HTTP con fetch
src/app.css            Estilos de la aplicación
server/index.js        API Express y acceso a SQLite
database/schema.sql    Esquema principal
database/migrations.sql Extensiones aditivas del MVP
database/seed.sql      Datos de ejemplo
shared/js/              Interfaz JavaScript anterior, conservada como prototipo
```

La migración de la base se ejecuta al iniciar Express y no la recrea. Para recrear manualmente una base de demostración se puede ejecutar `python database/crear_base.py`; este comando borra y vuelve a crear el archivo SQLite.

Para crear el primer administrador en una instalación nueva, ejecutá `npm run create:admin -- admin@dominio.com Nombre Apellido`. El comando genera una contraseña inicial aleatoria y la muestra una sola vez. Guardala en un lugar seguro. El administrador puede luego activar cuentas, asignar roles y moderar reseñas desde «Mi cuenta».

## Modelo de datos

El esquema principal incluye especialidades, profesionales, centros, horarios, relación profesional-centro, especialidades múltiples por profesional y opiniones. Las migraciones añaden usuarios, turnos, disponibilidad por profesional, eventos anónimos de búsqueda, notificaciones, documentos de demostración y registro de acciones administrativas.

## Funciones de administración y agenda

- Los profesionales pueden actualizar su perfil, administrar varias especialidades y configurar uno o varios bloques horarios por día y centro.
- Los administradores pueden crear, editar y borrar con seguridad centros y perfiles profesionales, administrar horarios y vínculos, gestionar usuarios, verificar perfiles y moderar reseñas. La eliminación se bloquea si hay cuentas, turnos o documentos asociados.
- El panel administrativo muestra búsquedas, turnos, reseñas y altas de cuentas por período. Las búsquedas se cuentan sin almacenar el texto ingresado.
- Los pacientes pueden cancelar turnos solicitados o confirmados; el horario vuelve a estar disponible.
- La base de demostración incluye un profesional adicional por cada especialidad y reseñas ficticias de 3, 4 y 5 estrellas. No son opiniones clínicas reales.

## Alcance y límites

- Los profesionales, centros, horarios y opiniones iniciales son datos de ejemplo.
- El registro público crea cuentas de paciente; las contraseñas se almacenan con PBKDF2.
- Los avisos de recordatorio se generan dentro de las 24 horas previas a un turno confirmado mientras el servidor está activo.
- La API local escucha solo en `127.0.0.1`. No la expongas a internet ni uses datos médicos reales.
- Los documentos están protegidos en el prototipo, pero no se manejan archivos clínicos reales.
- Para producción definí `MEDILINK_SESSION_SECRET` con un valor aleatorio de al menos 32 bytes y serví el sitio bajo HTTPS; el servidor marca la cookie como `Secure` en producción.
- Antes de un despliegue real se necesitan copias de seguridad y revisión de seguridad y privacidad.
