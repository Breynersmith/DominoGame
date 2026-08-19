-- Domino Club — Migración 0002: columnas de salas + partidas + chat en tiempo real
-- (modelo Edge Functions / Supabase Realtime).

-- Columnas adicionales en `salas` para el broadcast de estado por Realtime.
alter table public.salas add column if not exists snapshot jsonb;
alter table public.salas add column if not exists aviso jsonb;
alter table public.salas add column if not exists ultimo_cambio bigint;

-- Partidas: estado de la partida en JSON (manos, tablero, turno, pozo), jugadores
-- (incluye bots con esBot=true), opciones y resultado final.
create table if not exists public.partidas (
  codigo text primary key references public.salas(codigo) on delete cascade,
  opciones jsonb not null,
  estado jsonb not null,
  jugadores jsonb not null,
  apuesta integer not null default 0,
  pagada integer not null default 0,
  humanos_inicio integer not null default 0,
  resultado jsonb,
  creado_en bigint not null,
  actualizado_en bigint not null
);

create table if not exists public.chat_mensajes (
  id bigserial primary key,
  sala_id text not null references public.salas(codigo) on delete cascade,
  usuario_id bigint not null references public.perfiles(id) on delete cascade,
  nombre text not null,
  color text not null,
  foto text,
  texto text not null,
  ts bigint not null
);
create index if not exists idx_chat_mensajes_sala on public.chat_mensajes (sala_id, id desc);

-- Realtime: el estado vive en Postgres y los clientes se suscriben a cambios.
-- Se desactiva RLS en estas tablas para que `postgres_changes` entregue los
-- payloads completos (la fila entera incluye las manos de todos los jugadores;
-- el modelo original ya emitía el estado completo por socket, así que no hay
-- regresión de privacidad). Los cambios solo los originan las Edge Functions.
alter table public.salas disable row level security;
alter table public.partidas disable row level security;
alter table public.chat_mensajes disable row level security;
alter table public.sala_jugadores disable row level security;

-- Replica identity FULL: Realtime envía la fila nueva completa en UPDATE.
alter table public.salas replica identity full;
alter table public.partidas replica identity full;
alter table public.chat_mensajes replica identity full;
alter table public.sala_jugadores replica identity full;

-- Suscribir las tablas a la publicación de Realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salas') then
    alter publication supabase_realtime add table public.salas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidas') then
    alter publication supabase_realtime add table public.partidas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_mensajes') then
    alter publication supabase_realtime add table public.chat_mensajes;
  end if;
end $$;