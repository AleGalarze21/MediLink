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
server.py              API anterior en Python, conservada como prototipo
shared/js/              Interfaz JavaScript anterior, conservada como prototipo
```

La migración de la base se ejecuta al iniciar Express y no la recrea. Para recrear manualmente una base de demostración se puede ejecutar `python database/crear_base.py`; este comando borra y vuelve a crear el archivo SQLite.

## Modelo de datos

El esquema principal incluye especialidades, profesionales, centros, horarios, relación profesional-centro y opiniones. Las migraciones añaden usuarios, turnos, disponibilidad por profesional, notificaciones, documentos de demostración y registro de acciones administrativas.

## Alcance y límites

- Los profesionales, centros, horarios y opiniones iniciales son datos de ejemplo.
- El registro público crea cuentas de paciente; las contraseñas se almacenan con PBKDF2.
- La API local escucha solo en `127.0.0.1`. No la expongas a internet ni uses datos médicos reales.
- Los documentos están protegidos en el prototipo, pero no se manejan archivos clínicos reales.
- Antes de un despliegue real se necesitan HTTPS, secretos persistentes, controles contra abuso, copias de seguridad y revisión de seguridad y privacidad.
