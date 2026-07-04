-- ============================================================
-- Schema para Virtual Closet en Supabase (Postgres)
-- Ejecutar completo en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists clothes (
  id bigint generated always as identity primary key,
  name text not null,
  brand text,
  store text,
  category text not null check (category in
    ('tops','bottoms','jackets','shoes','accessories','dresses','bags','sportswear')),
  color text default 'Otro',
  gender text check (gender in ('mujer','hombre','unisex')) default 'unisex',
  image_url text,
  purchase_url text,
  price numeric,
  status text default 'clean' check (status in ('clean','dirty','lent')),
  style text default 'Casual' check (style in ('Formal','Casual','Deportivo','Eventos de Ocasión')),
  is_catalog boolean default false,
  created_at timestamptz default now()
);

create table if not exists outfits (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists outfit_items (
  outfit_id bigint references outfits(id) on delete cascade,
  clothing_id bigint references clothes(id) on delete cascade,
  primary key (outfit_id, clothing_id)
);

create table if not exists calendar (
  id bigint generated always as identity primary key,
  day_of_week text unique not null check (day_of_week in
    ('lunes','martes','miércoles','jueves','viernes','sábado','domingo')),
  outfit_id bigint references outfits(id) on delete set null
);

insert into calendar (day_of_week)
values ('lunes'),('martes'),('miércoles'),('jueves'),('viernes'),('sábado'),('domingo')
on conflict (day_of_week) do nothing;

-- Índices útiles para las consultas más comunes de la app
create index if not exists idx_clothes_category on clothes(category);
create index if not exists idx_clothes_status on clothes(status);
create index if not exists idx_clothes_gender on clothes(gender);
create index if not exists idx_clothes_is_catalog on clothes(is_catalog);
