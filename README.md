# Atracciones Front - Microservicios

Frontend Vue/Vite adaptado para la solucion de microservicios de Atracciones.

## Flujo principal

- La ruta `/` ahora redirige a `/cliente`.
- El catalogo y el detalle de atracciones son publicos.
- Si el usuario quiere reservar, la vista de detalle le pide iniciar sesion o registrarse.
- El registro crea primero la cuenta en `ms-identidad` y luego el perfil en `ms-clientes`.
- Si el usuario tiene rol `ADMIN`, despues del login se redirige a `/admin`.

## Variables de entorno

Si usas el API Gateway, basta con una sola variable:

```env
VITE_API_URL=http://localhost:5080/api/v1
```

Si no usas gateway, el front puede apuntar directo a los puertos locales de los microservicios:

```env
VITE_IDENTIDAD_API_URL=http://localhost:5012/api/v1
VITE_CLIENTES_API_URL=http://localhost:5167/api/v1
VITE_ATRACCIONES_API_URL=http://localhost:5265/api/v1
VITE_RESERVAS_API_URL=http://localhost:5231/api/v1
VITE_FACTURACION_API_URL=http://localhost:5023/api/v1
```

Puedes copiar `.env.example` a `.env` si necesitas cambiar puertos o URLs.

## Ejecutar

```powershell
npm install
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

## Build

```powershell
npm run build
```

## Middleware / seguridad

En el frontend hay dos piezas:

- `src/router/index.js`: guard de rutas. Solo protege `/admin`; `/cliente` y el detalle son publicos.
- `src/services/api.js`: interceptor Axios. Si existe `user.token` en `localStorage`, agrega `Authorization: Bearer <token>` en cada request.

El middleware fuerte vive en backend:

- Cada microservicio usa `AddAuthentication().AddJwtBearer(...)`.
- Los controladores protegidos usan `[Authorize]`.
- Los endpoints publicos de Booking usan `[AllowAnonymous]`.

Asi el frontend mejora la experiencia, pero la seguridad real no depende del navegador.
