/* ════════════════════════════════════════════════════════════════
   IANNA CRM — services/supabase.service.js
   Servicio Supabase: esquema SQL y conexión. La sincronización real de datos se implementará en fases futuras.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// SUPABASE SCHEMA (documentado, listo para copiar y ejecutar)
// ================================================================
const SUPABASE_SCHEMA = `-- Valle de Aragón CRM v3 — Esquema PostgreSQL para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- TABLA: desarrollos (multi-proyecto)
create table if not exists desarrollos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  empresa text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- TABLA: usuarios
create table if not exists usuarios (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  correo text unique not null,
  rol text not null check (rol in ('gerente','asesor')),
  telefono text,
  activo boolean default true,
  avatar text,
  desarrollo_id uuid references desarrollos(id),
  fecha_alta timestamptz default now(),
  created_at timestamptz default now()
);

-- TABLA: parametros (alimenta toda la cotización)
create table if not exists parametros (
  id uuid primary key default uuid_generate_v4(),
  desarrollo_id uuid references desarrollos(id),
  clave text not null,
  valor text not null,
  descripcion text,
  updated_at timestamptz default now(),
  unique(desarrollo_id, clave)
);

-- TABLA: modelos
create table if not exists modelos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  precio numeric(14,2) default 0,
  construccion numeric(8,2) default 0,
  recamaras int default 0,
  banos numeric(4,1) default 0,
  descripcion text,
  activo boolean default true,
  desarrollo_id uuid references desarrollos(id),
  created_at timestamptz default now()
);

-- TABLA: inventario
create table if not exists inventario (
  id uuid primary key default uuid_generate_v4(),
  clave text not null,
  manzana int not null,
  lote int not null,
  estado text not null default 'Disponible' check (estado in ('Disponible','Apartado','Vendido')),
  terreno numeric(10,2) not null,
  excedente numeric(10,2) default 0,
  precio_m2 numeric(10,2) default 9000,
  plusvalia numeric(12,2) default 0,
  valor_terreno numeric(14,2),
  tipo_ubicacion text default '—',
  desarrollo_id uuid references desarrollos(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TABLA: inventario_historial (auditoría de cambios de lote)
create table if not exists inventario_historial (
  id uuid primary key default uuid_generate_v4(),
  lote_id uuid references inventario(id),
  estado_anterior text,
  estado_nuevo text,
  usuario_id uuid references usuarios(id),
  nota text,
  created_at timestamptz default now()
);

-- TABLA: prospectos
create table if not exists prospectos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  telefono text not null,
  correo text,
  fuente text,
  estado_civil text,
  presupuesto numeric(14,2) default 0,
  enganche numeric(14,2) default 0,
  ingresos numeric(14,2) default 0,
  estatus text default 'Nuevo',
  comentarios text,
  asesor_id uuid references usuarios(id),
  desarrollo_id uuid references desarrollos(id),
  fecha_registro timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TABLA: seguimientos
create table if not exists seguimientos (
  id uuid primary key default uuid_generate_v4(),
  prospecto_id uuid references prospectos(id) on delete cascade,
  tipo text not null,
  nota text,
  estatus_cambio text,
  usuario_id uuid references usuarios(id),
  created_at timestamptz default now()
);

-- TABLA: recordatorios
create table if not exists recordatorios (
  id uuid primary key default uuid_generate_v4(),
  prospecto_id uuid references prospectos(id) on delete cascade,
  tipo text not null,
  fecha date not null,
  hora time,
  nota text,
  estado text default 'pendiente' check (estado in ('pendiente','completado')),
  usuario_id uuid references usuarios(id),
  created_at timestamptz default now()
);

-- TABLA: apartados
create table if not exists apartados (
  id uuid primary key default uuid_generate_v4(),
  prospecto_id uuid references prospectos(id),
  lote_id uuid references inventario(id),
  modelo_id uuid references modelos(id),
  asesor_id uuid references usuarios(id),
  fecha_apartado date not null,
  monto_enganche numeric(14,2) default 0,
  valor_operacion numeric(14,2) default 0,
  construccion_adicional_desc text,
  construccion_adicional_m2 numeric(8,2) default 0,
  construccion_adicional_val numeric(14,2) default 0,
  estatus text default 'Activo' check (estatus in ('Activo','Venta','Cancelado')),
  desarrollo_id uuid references desarrollos(id),
  created_at timestamptz default now()
);

-- TABLA: auditoria
create table if not exists auditoria (
  id uuid primary key default uuid_generate_v4(),
  tabla text not null,
  accion text not null,
  usuario_id uuid,
  datos_antes jsonb,
  datos_despues jsonb,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY (RLS)
alter table prospectos enable row level security;
alter table seguimientos enable row level security;
alter table recordatorios enable row level security;
alter table apartados enable row level security;

-- Política: asesor solo ve sus prospectos
create policy "asesor_own_prospectos" on prospectos
  for all using (
    asesor_id = (select id from usuarios where correo = auth.email())
    or
    (select rol from usuarios where correo = auth.email()) = 'gerente'
  );

-- Índices para performance
create index if not exists idx_prospectos_asesor on prospectos(asesor_id);
create index if not exists idx_prospectos_estatus on prospectos(estatus);
create index if not exists idx_seguimientos_prospecto on seguimientos(prospecto_id);
create index if not exists idx_apartados_asesor on apartados(asesor_id);
create index if not exists idx_inventario_estado on inventario(estado);

-- ══════════════════════════════════════════════════
-- TABLA: kanban_historial (movimientos drag & drop)
-- ══════════════════════════════════════════════════
create table if not exists kanban_historial (
  id uuid primary key default uuid_generate_v4(),
  prospecto_id uuid references prospectos(id) on delete cascade,
  estatus_anterior text,
  estatus_nuevo text not null,
  usuario_id uuid references usuarios(id),
  comentario text,
  created_at timestamptz default now()
);
create index if not exists idx_kanban_prospecto on kanban_historial(prospecto_id);

-- ══════════════════════════════════════════════════
-- TABLA: lotes_division_historial (auditoría de subdivisiones)
-- ══════════════════════════════════════════════════
create table if not exists lotes_division_historial (
  id uuid primary key default uuid_generate_v4(),
  lote_origen_clave text not null,
  lote_origen_terreno numeric(12,3),
  lote_origen_excedente numeric(12,3),
  lote_origen_valor numeric(14,4),
  fracciones jsonb not null, -- [{clave, terreno, excedente, valor}]
  usuario_id uuid references usuarios(id),
  motivo text,
  desarrollo_id uuid references desarrollos(id),
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════
-- TABLA: cotizaciones (vinculadas al prospecto)
-- ══════════════════════════════════════════════════
create table if not exists cotizaciones (
  id uuid primary key default uuid_generate_v4(),
  prospecto_id uuid references prospectos(id),
  version int default 1,
  nombre_cliente text,
  modelo_id uuid references modelos(id),
  clave_lote text references inventario(clave),
  -- Superficies (3 decimales obligatorio)
  terreno_m2 numeric(12,3),
  excedente_m2 numeric(12,3),
  excedente_constr_m2 numeric(12,3) default 0,
  accesorios_m2 numeric(12,3) default 0,
  -- Valores (precision completa)
  valor_vivienda numeric(16,4),
  valor_excedente_terreno numeric(16,4) default 0,
  valor_excedente_constr numeric(16,4) default 0,
  valor_accesorios numeric(16,4) default 0,
  valor_plusvalia numeric(16,4) default 0,
  valor_total_vivienda numeric(16,4),
  gastos_operacion jsonb, -- array de gastos calculados
  total_gastos numeric(16,4),
  cliente_necesita numeric(16,4),
  -- Pagos
  credito_monto numeric(16,4) default 0,
  credito_institucion text,
  apartado numeric(16,4) default 0,
  descuento numeric(16,4) default 0,
  pago_adicional numeric(16,4) default 0,
  desembolso numeric(16,4),
  -- Plan de pagos
  num_mensualidades int default 0,
  fecha_primer_pago date,
  mensualidad numeric(16,4) default 0,
  -- Metadata
  recibo text,
  comentarios text,
  asesor_id uuid references usuarios(id),
  desarrollo_id uuid references desarrollos(id),
  parametros_snapshot jsonb, -- snapshot de parámetros al momento
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_cotizaciones_prospecto on cotizaciones(prospecto_id);
create index if not exists idx_cotizaciones_asesor on cotizaciones(asesor_id);

-- Trigger para versioning automático
create or replace function increment_cotizacion_version()
returns trigger as $$
begin
  NEW.version := (select coalesce(max(version),0)+1 from cotizaciones where prospecto_id=NEW.prospecto_id);
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

create trigger trg_cotizacion_version
  before insert on cotizaciones
  for each row execute function increment_cotizacion_version();

-- ══════════════════════════════════════════════════
-- TABLAS: WhatsApp CRM (Cloud API de Meta)
-- ══════════════════════════════════════════════════
create table if not exists wa_conversaciones (
  id uuid primary key default uuid_generate_v4(),
  wa_conversation_id text unique, -- ID de Meta
  prospecto_id uuid references prospectos(id),
  telefono text not null,
  nombre_contacto text,
  asesor_id uuid references usuarios(id),
  estado text default 'abierta' check (estado in ('abierta','resuelta','esperando','archivada')),
  etiquetas text[] default '{}',
  ultima_interaccion timestamptz default now(),
  no_leidos int default 0,
  desarrollo_id uuid references desarrollos(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wa_conv_asesor on wa_conversaciones(asesor_id);
create index if not exists idx_wa_conv_prospecto on wa_conversaciones(prospecto_id);
create index if not exists idx_wa_conv_tel on wa_conversaciones(telefono);

create table if not exists wa_mensajes (
  id uuid primary key default uuid_generate_v4(),
  wa_message_id text unique, -- ID de Meta (para deduplicación)
  conversacion_id uuid references wa_conversaciones(id) on delete cascade,
  tipo text not null check (tipo in ('entrante','saliente','nota_interna','sistema')),
  tipo_contenido text default 'texto' check (tipo_contenido in ('texto','imagen','audio','video','documento','ubicacion','contacto')),
  contenido text,
  url_archivo text, -- URL en Supabase Storage
  nombre_archivo text,
  tamano_archivo int,
  duracion_audio int, -- segundos
  leido boolean default false,
  fecha_enviado timestamptz,
  fecha_entregado timestamptz,
  fecha_leido timestamptz,
  usuario_id uuid references usuarios(id), -- si es saliente/nota
  wa_status text, -- sent, delivered, read, failed
  metadata jsonb, -- datos extra de Meta
  created_at timestamptz default now()
);
create index if not exists idx_wa_msg_conv on wa_mensajes(conversacion_id);
create index if not exists idx_wa_msg_fecha on wa_mensajes(fecha_enviado);

create table if not exists wa_asignacion_historial (
  id uuid primary key default uuid_generate_v4(),
  conversacion_id uuid references wa_conversaciones(id),
  asesor_anterior_id uuid references usuarios(id),
  asesor_nuevo_id uuid references usuarios(id),
  motivo text,
  regla_automatica text, -- round_robin, carga, proyecto, origen
  usuario_asigno_id uuid references usuarios(id),
  created_at timestamptz default now()
);

-- RLS para WhatsApp (asesor solo ve sus conversaciones)
alter table wa_conversaciones enable row level security;
alter table wa_mensajes enable row level security;

create policy "wa_conv_asesor_own" on wa_conversaciones
  for all using (
    asesor_id = (select id from usuarios where correo = auth.email())
    or (select rol from usuarios where correo = auth.email()) = 'gerente'
  );

create policy "wa_msg_via_conv" on wa_mensajes
  for all using (
    conversacion_id in (select id from wa_conversaciones)
  );

-- ══════════════════════════════════════════════════
-- TABLA: parametros_gastos (gastos de operación configurables)
-- ══════════════════════════════════════════════════
create table if not exists parametros_gastos (
  id uuid primary key default uuid_generate_v4(),
  desarrollo_id uuid references desarrollos(id),
  nombre text not null,
  tipo text not null check (tipo in ('fijo','pct_vivienda','pct_credito')),
  valor numeric(12,6) not null,
  activo boolean default true,
  orden int default 0,
  created_at timestamptz default now()
);

create table if not exists instituciones_financieras (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  activo boolean default true,
  orden int default 0,
  desarrollo_id uuid references desarrollos(id)
);

-- Actualizar inventario para soportar 3 decimales obligatorios
alter table inventario alter column terreno type numeric(12,3);
alter table inventario alter column excedente type numeric(12,3);
-- Agregar columna para m² construcción
alter table inventario add column if not exists construccion_m2 numeric(12,3) default 0;`;

