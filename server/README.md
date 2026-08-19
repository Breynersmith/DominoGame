# Domino Club — Servidor

Backend del juego: **Node + Express + Supabase (Postgres + Auth + Storage) + Socket.IO + JWT**.

## Requisitos
- Node.js 20+ (probado con Node 22)
- Un proyecto [Supabase](https://supabase.com) (base de datos Postgres, Auth y Storage)

## Puesta en marcha

1. Crea un proyecto en Supabase.
2. Ejecuta el esquema en el editor SQL (o `supabase db push`): `supabase/migrations/0001_inicial.sql`.
3. Copia `server/.env` con las credenciales del proyecto:

```bash
cd server
cp .env .env.local        # y rellena DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
                          # SUPABASE_SERVICE_ROLE_KEY y SUPABASE_JWT_SECRET
npm install
npm run dev               # arranca con tsx watch (recarga automática)
```

Por defecto escucha en `http://localhost:3001`. Configuración vía variables de entorno:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (defecto `3001`) |
| `DATABASE_URL` | Cadena de conexión de Supabase Postgres |
| `SUPABASE_URL` | URL del proyecto Supabase (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Clave anónima (API Keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de rol de servicio (solo backend, **nunca** en el cliente) |
| `SUPABASE_JWT_SECRET` | Secreto JWT del proyecto (Settings → API) para validar los tokens |
| `SUPABASE_BUCKET` | Bucket de Storage (defecto `domino`); se crea solo si falta |
| `JWT_SECRET` | Se conserva solo por compatibilidad (ya no firma tokens) |
| `REGISTRO_PERMISIVO` | `1` activa el registro de pruebas (solo pide nombre) |

### Registro de pruebas

Con `REGISTRO_PERMISIVO=1` (o `NODE_ENV=development`, que es el valor de `npm run dev`) el endpoint `POST /auth/registro` **solo exige `nombre`**: el resto de campos (email, teléfono, contraseña, fecha de nacimiento, país, pregunta de seguridad…) se rellenan con valores por defecto y **no se pide verificación SMS**. En `NODE_ENV=production` (o `test`) el registro vuelve a ser estricto.

Scripts: `npm run dev`, `npm run build` (compila a `dist/`), `npm run start`, `npm run typecheck`, `npm test`.

## Conectar la app Expo

La app del cliente apunta al servidor mediante la variable de entorno `EXPO_PUBLIC_API_URL` (defecto `http://localhost:3001`). Para probar en un dispositivo físico usa la IP de tu máquina:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:3001 npx expo start
```

Con el servidor encendido, el registro/login, la billetera, los amigos y las salas en línea (Socket.IO) funcionan contra el backend; sin conexión, la app funciona en modo local.

## Arquitectura

```
server/
  src/
    index.ts            # entrada: HTTP + Socket.IO + bootstrap (esquema y buckets)
    app.ts              # factory de la app Express
    db.ts               # acceso a Supabase Postgres (`pg`): esquema + billetera
    supabase.ts         # clientes Auth/Storage de Supabase, verificación de JWT
    auth.ts             # hash de contraseñas/OTP, middleware requiereAuth
    routes/             # REST
      auth.ts           # registro / login (2FA) / recuperar (con Supabase Auth)
      usuarios.ts       # perfil, editar (foto → Storage), buscar
      billetera.ts      # saldo, transacciones, recargar
      amigos.ts         # lista, agregar, eliminar
      notificaciones.ts # listar, marcar leídas, borrar
      disputas.ts       # soporte / disputas
      salas.ts          # crear, listar, consultar salas
      kyc.ts            # verificación de identidad (KYC, selfie → Storage)
      pagos.ts          # métodos de pago (solo datos enmascarados)
    sockets/
      salaManager.ts    # partidas en tiempo real autoritativas
    game/               # motor de dominó (mismo que el cliente)
  supabase/migrations/  # SQL de esquema para ejecutar en Supabase
  tests/                # vitest + supertest + socket.io-client (requieren Supabase)
```

## Supabase: Auth y Storage

- **Auth**: los usuarios viven en `auth.users` de Supabase. El backend crea cuentas con la API de servicio (`admin.createUser`) y emite sesiones con `signInWithPassword`. Los tokens que devuelve son JWT de Supabase; el servidor los valida con `SUPABASE_JWT_SECRET` (middleware `requiereAuth` y handshake de Socket.IO). El perfil de juego (nombre, saldo, color, racha…) está en la tabla `perfiles`, ligada a `auth.users(id)` por `auth_uid`.
- **Storage**: la foto de perfil (`PUT /usuarios/yo`) y la selfie del KYC (`POST /kyc`) se suben al bucket público `domino` y se guarda la URL pública en la base de datos (ya no se almacena base64).

## API REST

Todos los endpoints protegidos requieren el header `Authorization: Bearer <token>` (excepto `/health` y `/auth/*`).

### Autenticación (registro seguro con verificación por SMS)

El registro exige verificar el teléfono con un código OTP (envío por SMS a través del proveedor configurado en `SMS_PROVIDER`; si no hay proveedor, el endpoint devuelve el código en `demo: true` para desarrollo).

- `POST /auth/sms/enviar` `{ telefono }` → genera un OTP de 6 dígitos con validez de 10 minutos.
- `POST /auth/sms/verificar` `{ telefono, codigo }` → marca el teléfono como verificado.
- `POST /auth/registro` `{ nombre, nombreCompleto, email, telefono, password, color?, fechaNacimiento, pais, terminosAceptados, codigoOtp, preguntaSeguridad, respuestaSeguridad, dosFactores? }` → `201 { token, usuario }` (saldo inicial 1000). Valida email, teléfono, contraseña fuerte (mín. 8 con letras y números), mayoría de edad (18+), país y aceptación de términos; el OTP se consume al usarse. La cuenta se crea en Supabase Auth y el perfil en `perfiles`.
- `POST /auth/login` `{ identificador, password }` → `200 { token, usuario }`. Si el usuario tiene 2FA activo devuelve `200 { requiere2fa: true, telefonoEnmascarado, demo, codigo? }` sin token; hay que completar con `POST /auth/login/2fa`.
- `POST /auth/login/2fa` `{ identificador, codigo }` → valida el OTP enviado al teléfono y devuelve `{ token, usuario }`.
- `POST /auth/recuperar` — dos vías, ambas cambian la contraseña **solo** tras verificar la identidad:
  - `{ telefono, codigoOtp, nuevoPassword }` (por SMS),
  - `{ identificador, preguntaSeguridad, respuestaSeguridad, nuevoPassword }` (por pregunta de seguridad).

Preguntas de seguridad válidas: `nombre_mascota`, `ciudad_nacimiento`, `comida_favorita`, `nombre_colegio`.

Los endpoints de `/auth/*` están limitados por IP (anti fuerza bruta): `sms/enviar` (3/min), `sms/verificar` (5/min), `registro` (5/min), `login` (10/min), `login/2fa` (5/min) y `recuperar` (5/min); al superarse responden `429 { error: 'demasiadas_peticiones' }`.

### Verificación de identidad (KYC)

- `POST /kyc` `{ tipoDocumento, numeroDocumento, selfie }` → `202 { estado: 'pendiente' }`. Tipos: `dni`, `nie`, `pasaporte`; número de 5-20 caracteres alfanuméricos/guion; selfie en base64 `data:image/...` (máx. ~3 MB), que se sube a Supabase Storage. Limitado a 3 envíos/hora.
- `GET /kyc` → estado de la verificación (`no_enviado | pendiente | aprobado | rechazado`) y datos del envío.

### Métodos de pago (opcionales)

Solo se guardan datos enmascarados; nunca datos completos de tarjeta/cuenta.

- `GET /pagos` → `{ pagos: [{ id, tipo, datosEnmascarados, predeterminada }] }`
- `POST /pagos` `{ tipo, datosEnmascarados }` → `201`. Tipos: `tarjeta`, `paypal`, `cripto`; máx. 5 métodos.
- `DELETE /pagos/:id`
- `POST /pagos/:id/predeterminada` → marca el método por defecto

### Usuarios
- `GET /usuarios/yo` → perfil + saldo + transacciones
- `PUT /usuarios/yo` `{ nombre?, color?, foto? }` → edita perfil (la foto en data URI se sube a Storage)
- `GET /usuarios/buscar?q=` → usuarios que coinciden (excluye a uno mismo)
- `GET /usuarios/por-nombre/:nombre` → ficha de un usuario (para agregar amigos)

### Billetera
- `GET /billetera` → `{ saldo, transacciones }`
- `POST /billetera/recargar` `{ monto }` → recarga y registra `{ saldo, transacciones }`

### Amigos
- `GET /amigos` · `POST /amigos` `{ nombre }` · `DELETE /amigos/:nombre` (relación bidireccional)

### Notificaciones
- `GET /notificaciones` · `POST /notificaciones/:id/leida` · `POST /notificaciones/leer-todas` · `DELETE /notificaciones`

### Disputas / soporte
- `POST /disputas` `{ mensaje }` · `GET /disputas`

### Salas
- `POST /salas` `{ nombre, apuesta }` → `201 { sala: { codigo, ... } }` (crea la sala y mete al anfitrión)
- `GET /salas` → salas en espera · `GET /salas/:codigo` → detalle

## Partidas en tiempo real (Socket.IO)

El cliente se conecta con el JWT de Supabase en el handshake: `io(url, { auth: { token } })`.

### Eventos cliente → servidor
- `sala:unirse` `{ codigo }`
- `sala:salir`
- `sala:empezar` `{ codigo, robarPozo }` (solo el anfitrión)
- `partida:jugar` `{ codigo, fichaId, extremo: 'izquierdo'|'derecho' }`
- `partida:robar` `{ codigo }`
- `partida:pasar` `{ codigo }`

### Eventos servidor → cliente
- `sala:actualizada` — lista de jugadores y estado de la sala
- `partida:empezada` — `{ jugadores, opciones, apuesta }`
- `partida:estado` — `{ estado }` (estado autoritativo del motor)
- `partida:terminada` — `{ estado, apuesta, pot, pagos }` donde `pagos` es un mapa `usuarioId -> { tipo: 'ganancia'|'reembolso'|'perdida', monto }` para cada jugador humano
- `sala:error` — `{ error }`

### Reglas de la sala
- El anfitrión crea la sala (REST) y comparte el código; hasta 4 jugadores humanos.
- Con 1 jugador humano se añade un bot para llegar al mínimo de 2; los bots juegan solos (roban/pasan automáticamente).
- Al empezar, cada humano paga su apuesta (`apuesta` × nº de humanos al pozo). Si un humano gana recibe el pozo; si gana un bot o hay empate, todos los humanos recuperan su apuesta.
- Si un jugador se desconecta en mitad de la partida, su asiento pasa a un bot que continúa jugando.

### Nota de diseño
Por simplicidad de la fase 1, `partida:estado` envía las manos completas de todos los jugadores a cada participante (no se ocultan las fichas de los rivales). Cuando el objetivo sea competitivo, habrá que personalizar el estado por jugador en el servidor.

## Tests

```bash
npm test
```

Los tests se ejecutan contra una base de datos Supabase real: configúrala con las variables de entorno anteriores (mínimo `DATABASE_URL` y las `SUPABASE_*`). Sin ellas, la suite se salta (49 tests). Cubren auth, billetera, amigos, salas y las partidas en tiempo real con `supertest` y `socket.io-client`; cada test parte de una base limpia.
