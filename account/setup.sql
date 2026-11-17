-- =====================================================================
--  Cnatt's Arcade - account system database setup
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  username_lower text generated always as (lower(username)) stored unique,
  color text not null default '#b07cff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  playing text check (char_length(playing) <= 40),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- usernames can't be changed (they are the login name); colour and status can
revoke update on public.profiles from anon, authenticated;
grant update (color, playing, last_seen) on public.profiles to authenticated;

-- make a profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, color)
  values (new.id, new.raw_user_meta_data->>'username', coalesce(new.raw_user_meta_data->>'color', '#b07cff'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- cloud saves
create table if not exists public.saves (
  user_id uuid not null references auth.users on delete cascade,
  key text not null check (char_length(key) <= 80),
  data text not null check (char_length(data) <= 2000000),
  updated_at bigint not null,
  primary key (user_id, key)
);
alter table public.saves enable row level security;
drop policy if exists "own saves" on public.saves;
create policy "own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------- leaderboards
create table if not exists public.scores (
  user_id uuid not null references public.profiles on delete cascade,
  board text not null check (board ~ '^[a-z0-9_]{2,40}$'),
  score double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, board)
);
alter table public.scores enable row level security;
drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores for select using (true);
create index if not exists scores_board on public.scores (board, score);

-- scores only go through this function, which keeps each player's best
create or replace function public.submit_score(p_board text, p_score double precision, p_lower boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_score is null or p_score = 'NaN'::float8 or abs(p_score) > 1e15 then return; end if;
  insert into public.scores (user_id, board, score) values (auth.uid(), p_board, p_score)
  on conflict (user_id, board) do update
    set score = case when p_lower then least(scores.score, excluded.score) else greatest(scores.score, excluded.score) end,
        updated_at = case when (p_lower and excluded.score < scores.score) or (not p_lower and excluded.score > scores.score) then now() else scores.updated_at end;
end $$;
revoke all on function public.submit_score(text, double precision, boolean) from public, anon;
grant execute on function public.submit_score(text, double precision, boolean) to authenticated;

-- ---------------------------------------------------------- friends
create table if not exists public.friends (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
alter table public.friends enable row level security;
drop policy if exists "see own friendships" on public.friends;
create policy "see own friendships" on public.friends for select using (auth.uid() in (requester, addressee));
drop policy if exists "send requests" on public.friends;
create policy "send requests" on public.friends for insert with check (auth.uid() = requester and status = 'pending');
drop policy if exists "accept requests" on public.friends;
create policy "accept requests" on public.friends for update using (auth.uid() = addressee) with check (status = 'accepted');
drop policy if exists "remove friends" on public.friends;
create policy "remove friends" on public.friends for delete using (auth.uid() in (requester, addressee));
revoke update on public.friends from anon, authenticated;
grant update (status) on public.friends to authenticated;
