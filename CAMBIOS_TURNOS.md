# Cambios realizados en MediLink

## Turnos y agenda

- Se mantuvo React como interfaz principal.
- Se utiliza Node.js con Express para el servidor y la API.
- Se pueden solicitar turnos desde el perfil de un profesional.
- Se consulta la disponibilidad por centro, fecha y horario.
- Se muestran los centros donde atiende cada profesional.
- Se muestran los horarios de atención de los centros.
- Los profesionales pueden consultar su agenda.
- Los profesionales pueden confirmar, rechazar y marcar como atendidos los turnos.
- Se agregaron validaciones de permisos según el rol del usuario.
- Se envían notificaciones al paciente cuando cambia el estado del turno.

## Archivos principales modificados

- `server/index.js`: API Express, agenda y cambios de estado.
- `src/api.js`: funciones para consultar y actualizar turnos.
- `src/main.jsx`: interfaz React para pacientes y profesionales.
- `src/app.css`: ajuste visual de los botones de la agenda.
- `database/medilink.db`: datos locales de prueba.

## Cómo levantar el servidor

Desde la carpeta raíz del proyecto:

```bash
npm install
npm run dev
```

En PowerShell, si `npm run dev` está bloqueado por la política de scripts, usar:

```powershell
npm.cmd run dev
```

Luego abrir:

```text
http://127.0.0.1:3000/
```

## Cómo detener el servidor

En la terminal donde está ejecutándose, presionar:

```text
Ctrl+C
```

## Cuenta profesional local de prueba

```text
Correo: doctor.prueba@medilink.local
Contraseña: Doctor12345!
```

Esta cuenta es únicamente para pruebas locales y no debe utilizarse en producción.
