# MediLink — Conectando tu salud

Plataforma de búsqueda y valoración de profesionales de la salud.
Esta carpeta tiene la **versión web**, la **versión móvil** y la **base de datos SQLite**.

## Cómo abrirlo

Para usar la API, las cuentas y los turnos guardados en SQLite, ejecutá desde la carpeta principal:

```powershell
python server.py
```

Después abrí `http://127.0.0.1:8000/` y elegí web o móvil. Python ya incluye las dependencias necesarias. Si abrís los HTML directamente, queda disponible el prototipo local con turnos guardados solo en ese navegador.

El servidor escucha en `127.0.0.1` por defecto, para uso local. No lo expongas a internet ni cargues datos médicos reales: es un prototipo académico sin despliegue endurecido ni almacenamiento documental de producción.

### Crear cuentas de demostración para roles internos

El registro público crea cuentas de paciente. Para crear de forma interactiva una cuenta de administración:

```powershell
python server.py --create-user admin "Administración MediLink" admin@example.test
```

Para una cuenta profesional, indicá el id existente del profesional:

```powershell
python server.py --create-user profesional "Dr. Juan Pérez" profesional@example.test --professional-id 1
```

El programa solicita la contraseña sin mostrarla en pantalla. La API usa estas cuentas para comprobar permisos y transiciones de turnos.

## Estructura

```
medilink/
├── index.html              Portada con acceso a las dos versiones
├── README.md
├── server.py               API local, cuentas y permisos
│
├── database/               Base de datos (SQLite)
│   ├── medilink.db         La base ya creada y con datos de ejemplo
│   ├── schema.sql          Tablas, relaciones, restricciones e índices
│   ├── seed.sql            Datos de ejemplo
│   ├── consultas_ejemplo.sql   Consultas SQL útiles (para el TFI)
│   ├── crear_base.py       Recrea medilink.db desde schema.sql + seed.sql
│   └── export_data.py      Pasa los datos de la base a shared/js/data.js
│
├── shared/                 Lo que usan las dos versiones
│   ├── css/base.css        Colores, tipografía, tarjetas, botones
│   ├── img/logo.png        Logo de MediLink
│   └── js/
│       ├── data.js         Datos (GENERADO desde la base, no editar a mano)
│       ├── icons.js        Íconos y colores de avatar
│       ├── helpers.js      Promedios, horarios "abierto ahora", fechas, avisos
│       ├── views.js        Pantallas: inicio, búsqueda, ranking, centros, perfil
│       ├── api.js          Conexión opcional con el servidor local
│       └── app.js          Arranque y navegación
│
├── web/
│   ├── index.html          Versión web (menú lateral, portada, grillas)
│   └── css/web.css         Estilos propios de la web
│
└── mobile/
    ├── index.html          Versión móvil (marco de celular, barra inferior)
    └── css/mobile.css      Estilos propios del móvil
```

La web y el móvil comparten la misma lógica (`shared/js`) y la misma base de datos.
Solo cambian el `index.html` y el CSS propio de cada una.

## Modelo de datos

```mermaid
erDiagram
    ESPECIALIDADES ||--o{ PROFESIONALES : "tiene"
    PROFESIONALES  ||--o{ PROFESIONAL_CENTRO : "atiende en"
    CENTROS        ||--o{ PROFESIONAL_CENTRO : "tiene"
    CENTROS        ||--o{ HORARIOS_CENTRO : "abre en"
    PROFESIONAL_CENTRO ||--o{ HORARIOS_PROFESIONAL : "define disponibilidad"
    PROFESIONALES  ||--o{ OPINIONES : "recibe"
    USUARIOS       ||--o{ TURNOS : "solicita"
    PROFESIONALES  ||--o{ TURNOS : "atiende"
    CENTROS        ||--o{ TURNOS : "recibe"
    USUARIOS       ||--o{ NOTIFICACIONES : "recibe"
    USUARIOS       ||--o{ DOCUMENTOS_PACIENTE : "consulta"

    ESPECIALIDADES { int id PK  text nombre }
    CENTROS { int id PK  text nombre  text direccion  text ciudad  text telefono  text nota }
    HORARIOS_CENTRO { int id PK  int centro_id FK  text etiqueta  text dias  int hora_desde  int hora_hasta  text texto }
    PROFESIONALES { int id PK  text nombre  int especialidad_id FK  text ciudad  int anios_experiencia  int verificado  text color }
    PROFESIONAL_CENTRO { int profesional_id FK  int centro_id FK }
    HORARIOS_PROFESIONAL { int profesional_id FK  int centro_id FK  int dia  int hora_desde  int hora_hasta }
    USUARIOS { int id PK  text nombre  text email  text password_hash  text rol  int profesional_id FK  int activo }
    TURNOS { int id PK  int paciente_id FK  int profesional_id FK  int centro_id FK  text fecha  text hora  text estado }
    OPINIONES { int id PK  int profesional_id FK  int turno_id FK  text autor  int puntaje  text comentario  text fecha  int oculta }
    NOTIFICACIONES { int id PK  int usuario_id FK  text evento  text titulo  text mensaje  int leida }
    DOCUMENTOS_PACIENTE { int id PK  int paciente_id FK  int profesional_id FK  int turno_id FK  text titulo  text tipo  text contenido }
```

- `profesional_centro` resuelve la relación **muchos a muchos**: un profesional atiende en varios centros y un centro tiene varios profesionales.
- `puntaje` solo acepta valores de 1 a 5 (`CHECK`).
- La vista `vista_profesionales_resumen` calcula el promedio y la cantidad de opiniones de cada profesional.

## Cómo actualizar los datos

1. Editá `database/seed.sql` (o modificá `medilink.db` con un programa como *DB Browser for SQLite*).
2. Si editaste `seed.sql`, recreá la base:
   ```
   cd database
   python crear_base.py
   ```
3. Pasá los datos a la web y al móvil:
   ```
   python export_data.py
   ```
4. Recargá la página.

## Limitaciones actuales

- Los teléfonos, direcciones, horarios y opiniones son **datos de ejemplo**.
- Al abrir los archivos directamente se usa `shared/js/data.js` y el modo de demostración del navegador.
- Con `python server.py`, el catálogo, las cuentas, solicitudes de turnos, estados, reseñas verificadas y notificaciones se conectan a SQLite. La migración es aditiva y se aplica al iniciar; no recrea la base.
- Los documentos de resultados se representan en esta etapa como metadatos protegidos; no hay carga/almacenamiento de archivos clínicos.
- Las cuentas son locales para el prototipo. Antes de un despliegue real hacen falta HTTPS, gestión de secretos, controles contra abuso, copias de seguridad, almacenamiento clínico seguro y revisión de privacidad.
