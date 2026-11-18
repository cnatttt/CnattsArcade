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

-- =====================================================================
--  ADMIN CONTROLS (added later - safe to run the whole file again)
-- =====================================================================
alter table public.profiles add column if not exists banned boolean not null default false;

create table if not exists public.admins (user_id uuid primary key references public.profiles on delete cascade);
alter table public.admins enable row level security;
drop policy if exists "admins visible" on public.admins;
create policy "admins visible" on public.admins for select using (true);
-- the account named cnatt is the site admin
insert into public.admins (user_id) select id from public.profiles where username_lower = 'cnatt' on conflict do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- site-wide settings: announcement, game visibility, maintenance mode
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "settings are public" on public.site_settings;
create policy "settings are public" on public.site_settings for select using (true);
drop policy if exists "admins change settings" on public.site_settings;
create policy "admins change settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- admins can remove leaderboard entries
drop policy if exists "admins remove scores" on public.scores;
create policy "admins remove scores" on public.scores for delete using (public.is_admin());

-- banned players can't post scores or send friend requests
create or replace function public.submit_score(p_board text, p_score double precision, p_lower boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and banned) then return; end if;
  if p_score is null or p_score = 'NaN'::float8 or abs(p_score) > 1e15 then return; end if;
  insert into public.scores (user_id, board, score) values (auth.uid(), p_board, p_score)
  on conflict (user_id, board) do update
    set score = case when p_lower then least(scores.score, excluded.score) else greatest(scores.score, excluded.score) end,
        updated_at = case when (p_lower and excluded.score < scores.score) or (not p_lower and excluded.score > scores.score) then now() else scores.updated_at end;
end $$;
drop policy if exists "send requests" on public.friends;
create policy "send requests" on public.friends for insert with check (auth.uid() = requester and status = 'pending' and not exists (select 1 from public.profiles where id = auth.uid() and banned));

-- ban / unban a player (admins only); optionally wipe their leaderboard scores
create or replace function public.admin_set_ban(p_user uuid, p_banned boolean, p_wipe boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'cannot ban an admin'; end if;
  update public.profiles set banned = p_banned where id = p_user;
  if p_wipe then delete from public.scores where user_id = p_user; end if;
end $$;
revoke all on function public.admin_set_ban(uuid, boolean, boolean) from public, anon;
grant execute on function public.admin_set_ban(uuid, boolean, boolean) to authenticated;

-- numbers for the admin dashboard
create or replace function public.admin_stats() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return json_build_object(
    'players', (select count(*) from public.profiles),
    'new_today', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
    'new_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online', (select count(*) from public.profiles where last_seen > now() - interval '150 seconds'),
    'active_week', (select count(*) from public.profiles where last_seen > now() - interval '7 days'),
    'banned', (select count(*) from public.profiles where banned),
    'saves', (select count(*) from public.saves),
    'scores', (select count(*) from public.scores),
    'friendships', (select count(*) from public.friends where status = 'accepted'),
    'playing', (select coalesce(json_object_agg(playing, n), '{}'::json) from (select playing, count(*) n from public.profiles where last_seen > now() - interval '150 seconds' and playing is not null group by playing) x)
  );
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- =====================================================================
--  FRIENDS CAN JOIN FRIENDS (added later - safe to run the whole file again)
-- =====================================================================
alter table public.profiles add column if not exists room text check (char_length(room) <= 40);
grant update (room) on public.profiles to authenticated;

-- =====================================================================
--  2 PLAYER TAG RANKED (added later - safe to run the whole file again)
-- =====================================================================
create table if not exists public.ranked (
  user_id uuid primary key references public.profiles on delete cascade,
  elo int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  streak int not null default 0,
  peak int not null default 1000,
  updated_at timestamptz not null default now()
);
alter table public.ranked enable row level security;
drop policy if exists "ranked is public" on public.ranked;
create policy "ranked is public" on public.ranked for select using (true);

create table if not exists public.ranked_matches (
  id text primary key check (char_length(id) <= 60),
  a uuid not null references public.profiles on delete cascade,
  b uuid not null references public.profiles on delete cascade,
  a_won boolean, b_won boolean,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ranked_matches enable row level security;
drop policy if exists "see own ranked matches" on public.ranked_matches;
create policy "see own ranked matches" on public.ranked_matches for select using (auth.uid() in (a, b));

-- apply an Elo result (internal)
create or replace function public.ranked_apply(p_winner uuid, p_loser uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ew int; el int; exp_w float8; k int := 32; d int;
begin
  insert into public.ranked (user_id) values (p_winner) on conflict do nothing;
  insert into public.ranked (user_id) values (p_loser) on conflict do nothing;
  select elo into ew from public.ranked where user_id = p_winner;
  select elo into el from public.ranked where user_id = p_loser;
  exp_w := 1 / (1 + power(10, (el - ew) / 400.0));
  d := greatest(1, round(k * (1 - exp_w)));
  update public.ranked set elo = elo + d, wins = wins + 1, streak = greatest(streak, 0) + 1, peak = greatest(peak, elo + d), updated_at = now() where user_id = p_winner;
  update public.ranked set elo = greatest(0, elo - d), losses = losses + 1, streak = least(streak, 0) - 1, updated_at = now() where user_id = p_loser;
  insert into public.scores (user_id, board, score) select user_id, 'tag_elo', elo from public.ranked where user_id in (p_winner, p_loser)
    on conflict (user_id, board) do update set score = excluded.score, updated_at = now();
end $$;
revoke all on function public.ranked_apply(uuid, uuid) from public, anon, authenticated;

-- matches where only one player reported (the other left) count after 3 minutes
create or replace function public.ranked_resolve() returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select * from public.ranked_matches where not done and created_at < now() - interval '3 minutes' and ((a_won is null) <> (b_won is null)) loop
    if coalesce(m.a_won, not m.b_won) then perform public.ranked_apply(m.a, m.b); else perform public.ranked_apply(m.b, m.a); end if;
    update public.ranked_matches set done = true where id = m.id;
  end loop;
end $$;
grant execute on function public.ranked_resolve() to authenticated;

-- each player reports the result; when both agree the Elo changes
create or replace function public.ranked_report(p_match text, p_opp uuid, p_won boolean) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.ranked_matches;
begin
  if me is null or p_opp is null or me = p_opp then return json_build_object('ok', false); end if;
  if exists (select 1 from public.profiles where id = me and banned) then return json_build_object('ok', false); end if;
  perform public.ranked_resolve();
  select * into m from public.ranked_matches where id = p_match for update;
  if not found then
    insert into public.ranked_matches (id, a, b, a_won) values (p_match, me, p_opp, p_won);
    return json_build_object('ok', true, 'waiting', true);
  end if;
  if m.done then return json_build_object('ok', true, 'done', true); end if;
  if m.a = me and m.b = p_opp then update public.ranked_matches set a_won = p_won where id = p_match;
  elsif m.b = me and m.a = p_opp then update public.ranked_matches set b_won = p_won where id = p_match;
  else return json_build_object('ok', false); end if;
  select * into m from public.ranked_matches where id = p_match;
  if m.a_won is not null and m.b_won is not null then
    if m.a_won <> m.b_won then
      if m.a_won then perform public.ranked_apply(m.a, m.b); else perform public.ranked_apply(m.b, m.a); end if;
    end if;
    update public.ranked_matches set done = true where id = p_match;
    return json_build_object('ok', true, 'done', true);
  end if;
  return json_build_object('ok', true, 'waiting', true);
end $$;
revoke all on function public.ranked_report(text, uuid, boolean) from public, anon;
grant execute on function public.ranked_report(text, uuid, boolean) to authenticated;
