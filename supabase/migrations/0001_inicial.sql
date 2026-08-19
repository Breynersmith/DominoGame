-- Domino Club — Migración inicial para Supabase
-- Ejecutar en el editor SQL del proyecto Supabase (o mediante `supabase db push`).
-- Espeja el esquema de server/src/db.ts (ESQUEMA_SQL).

create table if not exists public.perfiles (
  id bigserial primary key,
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  nombre text not null,
  nombre_completo text not null default '',
  email text,
  telefono text,
  fecha_nacimiento text,
  pais text not null default '',
  terminos_aceptados_en bigint,
  pregunta_seguridad text,
  respuesta_seguridad_hash text,
  dos_factores integer not null default 0,
  kyc_estado text not null default 'no_enviado',
  kyc_tipo_documento text,
  kyc_numero_documento text,
  kyc_selfie_url text,
  kyc_enviado_en bigint,
  kyc_revisado_en bigint,
  color text not null default '#006c49',
  cuenta_verificada integer not null default 0,
  saldo integer not null default 1000,
  victorias integer not null default 0,
  derrotas integer not null default 0,
  racha integer not null default 0,
  foto_url text,
  creado_en bigint not null
);
create unique index if not exists idx_perfiles_nombre on public.perfiles (lower(nombre));
create unique index if not exists idx_perfiles_email on public.perfiles (email) where email is not null;
create unique index if not exists idx_perfiles_telefono on public.perfiles (telefono) where telefono is not null;

create table if not exists public.codigos_otp (
  id bigserial primary key,
  telefono text not null default '',
  email text,
  codigo_hash text not null,
  verificado integer not null default 0,
  consumido integer not null default 0,
  expira_en bigint not null,
  creado_en bigint not null
);

create table if not exists public.sessions_pendientes (
  auth_uid uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  creado_en bigint not null
);

create table if not exists public.metodos_pago (
  id bigserial primary key,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  datos_enmascarados text not null,
  predeterminada integer not null default 0,
  creado_en bigint not null
);

create table if not exists public.transacciones (
  id bigserial primary key,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  monto integer not null,
  descripcion text not null default '',
  creado_en bigint not null
);

create table if not exists public.amigos (
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  amigo_id bigint not null references public.perfiles(id) on delete cascade,
  creado_en bigint not null,
  primary key (usuario_id, amigo_id)
);

create table if not exists public.notificaciones (
  id bigserial primary key,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  titulo text not null,
  cuerpo text not null,
  leida integer not null default 0,
  creado_en bigint not null
);

create table if not exists public.disputas (
  id bigserial primary key,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  mensaje text not null,
  estado text not null default 'abierta',
  creado_en bigint not null
);

create table if not exists public.salas (
  codigo text primary key,
  nombre text not null,
  apuesta integer not null default 0,
  host_id bigint not null,
  estado text not null default 'espera',
  creado_en bigint not null
);

create table if not exists public.sala_jugadores (
  sala_id text not null references public.salas(codigo) on delete cascade,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  creado_en bigint not null,
  primary key (sala_id, usuario_id)
);

-- Nota: crear también el bucket público `domino` (Settings → Storage) para
-- fotos de perfil y selfies KYC; el servidor lo crea solo si falta.
