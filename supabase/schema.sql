-- ============================================================
-- PriceScout — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── 1. USER PROFILES ────────────────────────────────────────
-- Extends Supabase Auth (auth.users) with extra fields
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. SEARCH HISTORY ───────────────────────────────────────
create table if not exists public.search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  query       text not null,
  platforms   text[] not null,          -- e.g. ["amazon","flipkart"]
  result_count int default 0,
  searched_at timestamptz default now()
);

create index if not exists idx_search_history_user on public.search_history(user_id);
create index if not exists idx_search_history_query on public.search_history(query);

-- ── 3. RESULT CACHE ─────────────────────────────────────────
-- Stores raw API results so repeat searches skip RapidAPI
create table if not exists public.result_cache (
  id          uuid primary key default gen_random_uuid(),
  cache_key   text unique not null,     -- md5(query + sorted platforms)
  query       text not null,
  platforms   text[] not null,
  results     jsonb not null,           -- full API response object
  hit_count   int default 1,
  cached_at   timestamptz default now(),
  expires_at  timestamptz default (now() + interval '6 hours')
);

create index if not exists idx_cache_key  on public.result_cache(cache_key);
create index if not exists idx_cache_exp  on public.result_cache(expires_at);

-- ── 4. WISHLISTS ────────────────────────────────────────────
create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  name        text not null default 'My Wishlist',
  created_at  timestamptz default now()
);

-- ── 5. WISHLIST ITEMS ───────────────────────────────────────
create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  wishlist_id  uuid references public.wishlists(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  platform     text not null,
  title        text not null,
  price        text,
  image        text,
  product_url  text,
  added_at     timestamptz default now()
);

create index if not exists idx_wishlist_items_user     on public.wishlist_items(user_id);
create index if not exists idx_wishlist_items_wishlist on public.wishlist_items(wishlist_id);

-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.search_history enable row level security;
alter table public.result_cache   enable row level security;
alter table public.wishlists      enable row level security;
alter table public.wishlist_items enable row level security;

-- Profiles: users can only read/update their own row
create policy "profiles: own row"
  on public.profiles for all
  using (auth.uid() = id);

-- Search history: users see only their own
create policy "search_history: own rows"
  on public.search_history for all
  using (auth.uid() = user_id);

-- Cache: readable by everyone (shared cache), writable by authenticated
create policy "cache: read all"
  on public.result_cache for select
  using (true);

create policy "cache: insert authenticated"
  on public.result_cache for insert
  with check (auth.role() = 'authenticated');

create policy "cache: update authenticated"
  on public.result_cache for update
  using (auth.role() = 'authenticated');

-- Wishlists & items: users see only their own
create policy "wishlists: own rows"
  on public.wishlists for all
  using (auth.uid() = user_id);

create policy "wishlist_items: own rows"
  on public.wishlist_items for all
  using (auth.uid() = user_id);
