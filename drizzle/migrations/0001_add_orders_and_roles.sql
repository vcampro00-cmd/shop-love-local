-- Rôles applicatifs (jamais sur profiles/users)
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Own roles readable" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Commandes
create type public.order_status as enum ('nouveau', 'prepare', 'envoye', 'livre', 'annule');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid not null,
  customer_email text not null,
  name text not null,
  phone text not null,
  address text not null,
  postal_code text not null,
  notes text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null,
  total numeric(10,2) not null,
  status public.order_status not null default 'nouveau',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_created_idx on public.orders (created_at desc);

grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.orders enable row level security;

create policy "Customers place their own orders" on public.orders
  for insert to authenticated with check (customer_id = auth.uid());

create policy "Customers read their own orders" on public.orders
  for select to authenticated using (customer_id = auth.uid());

create policy "Admins read all orders" on public.orders
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins update orders" on public.orders
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

-- Le compte du propriétaire devient administrateur automatiquement à l'inscription
create or replace function public.assign_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'vcampro00@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end
$$;

create trigger user_roles_owner_after_insert after insert on auth.users
  for each row execute function public.assign_owner_admin();
