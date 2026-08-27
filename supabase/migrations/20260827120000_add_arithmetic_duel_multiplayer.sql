-- Mental Aritmetik Düellosu: ayrı oda, round ve cevap akışı.
-- Bu migration production'a otomatik uygulanmaz.

create extension if not exists pgcrypto;

create table if not exists public.arithmetic_duel_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players smallint not null check (max_players in (2, 4, 6, 8)),
  difficulty smallint not null check (difficulty between 1 and 4),
  operation text not null check (operation in ('mixed', 'addition', 'subtraction', 'multiplication', 'division')),
  round_count smallint not null check (round_count in (5, 10, 15, 20)),
  time_limit smallint not null check (time_limit in (5, 7, 10, 15)),
  current_round smallint not null default 0,
  host_player_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.arithmetic_duel_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arithmetic_duel_rooms(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  join_token_hash text not null,
  seat smallint not null,
  score integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  round_wins integer not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, display_name)
);

create table if not exists public.arithmetic_duel_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arithmetic_duel_rooms(id) on delete cascade,
  round_number smallint not null,
  question_text text not null,
  correct_answer integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  winner_player_id uuid references public.arithmetic_duel_players(id),
  finished_at timestamptz,
  unique (room_id, round_number)
);

create table if not exists public.arithmetic_duel_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arithmetic_duel_rooms(id) on delete cascade,
  round_id uuid not null references public.arithmetic_duel_rounds(id) on delete cascade,
  player_id uuid not null references public.arithmetic_duel_players(id) on delete cascade,
  answer_value integer not null,
  is_correct boolean not null,
  response_ms integer not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create index if not exists arithmetic_duel_players_room_idx
  on public.arithmetic_duel_players(room_id, seat);
create index if not exists arithmetic_duel_rounds_room_idx
  on public.arithmetic_duel_rounds(room_id, round_number);
create index if not exists arithmetic_duel_answers_round_idx
  on public.arithmetic_duel_answers(round_id, player_id);

alter table public.arithmetic_duel_rooms enable row level security;
alter table public.arithmetic_duel_players enable row level security;
alter table public.arithmetic_duel_rounds enable row level security;
alter table public.arithmetic_duel_answers enable row level security;

revoke all on public.arithmetic_duel_rooms,
  public.arithmetic_duel_players,
  public.arithmetic_duel_rounds,
  public.arithmetic_duel_answers
  from anon, authenticated;

create or replace function public.arithmetic_duel_player_ok(
  p_room uuid,
  p_player uuid,
  p_token text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.arithmetic_duel_players
    where room_id = p_room
      and id = p_player
      and join_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

create or replace function public.arithmetic_duel_build_question(
  p_difficulty smallint,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation text := p_operation;
  v_range integer;
  v_a integer;
  v_b integer;
  v_answer integer;
begin
  if p_difficulty not between 1 and 4 then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  v_range := case p_difficulty when 1 then 10 when 2 then 25 when 3 then 75 else 150 end;
  if v_operation = 'mixed' then
    v_operation := (array['addition', 'subtraction', 'multiplication', 'division'])[
      1 + floor(pg_catalog.random() * 4)::integer
    ];
  end if;

  if v_operation = 'addition' then
    v_a := 1 + floor(pg_catalog.random() * v_range)::integer;
    v_b := 1 + floor(pg_catalog.random() * v_range)::integer;
    v_answer := v_a + v_b;
  elsif v_operation = 'subtraction' then
    v_b := 1 + floor(pg_catalog.random() * v_range)::integer;
    v_a := v_b + 1 + floor(pg_catalog.random() * v_range)::integer;
    v_answer := v_a - v_b;
  elsif v_operation = 'multiplication' then
    v_a := 2 + floor(pg_catalog.random() * greatest(3, p_difficulty * 3))::integer;
    v_b := 2 + floor(pg_catalog.random() * greatest(3, p_difficulty * 3))::integer;
    v_answer := v_a * v_b;
  elsif v_operation = 'division' then
    v_b := 2 + floor(pg_catalog.random() * greatest(3, p_difficulty * 3))::integer;
    v_answer := 2 + floor(pg_catalog.random() * greatest(3, p_difficulty * 4))::integer;
    v_a := v_b * v_answer;
  else
    raise exception 'INVALID_OPERATION';
  end if;

  return jsonb_build_object(
    'question_text', pg_catalog.format('%s %s %s', v_a, case v_operation when 'addition' then '+' when 'subtraction' then '-' when 'multiplication' then '×' else '÷' end, v_b),
    'correct_answer', v_answer
  );
end;
$$;

create or replace function public.arithmetic_duel_create_room(
  p_name text,
  p_max_players integer,
  p_difficulty integer,
  p_operation text,
  p_round_count integer,
  p_time_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
  v_player uuid;
  v_token text;
  v_code text;
begin
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 2 and 24
     or p_max_players not in (2, 4, 6, 8)
     or p_difficulty not between 1 and 4
     or p_operation not in ('mixed', 'addition', 'subtraction', 'multiplication', 'division')
     or p_round_count not in (5, 10, 15, 20)
     or p_time_limit not in (5, 7, 10, 15) then
    raise exception 'INVALID_ROOM_OPTIONS';
  end if;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
    begin
      insert into public.arithmetic_duel_rooms (code, max_players, difficulty, operation, round_count, time_limit)
      values (v_code, p_max_players, p_difficulty, p_operation, p_round_count, p_time_limit)
      returning id into v_room;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.arithmetic_duel_players (room_id, display_name, join_token_hash, seat, is_host)
  values (v_room, pg_catalog.btrim(p_name), encode(extensions.digest(v_token, 'sha256'), 'hex'), 1, true)
  returning id into v_player;

  update public.arithmetic_duel_rooms set host_player_id = v_player where id = v_room;
  return jsonb_build_object('room_id', v_room, 'player_id', v_player, 'token', v_token, 'code', v_code);
end;
$$;

create or replace function public.arithmetic_duel_join_room(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.arithmetic_duel_rooms%rowtype;
  v_player uuid;
  v_token text;
  v_seat integer;
begin
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 2 and 24 then
    raise exception 'INVALID_PLAYER_NAME';
  end if;
  select * into v_room from public.arithmetic_duel_rooms where code = upper(pg_catalog.btrim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if (select count(*) from public.arithmetic_duel_players where room_id = v_room.id) >= v_room.max_players then raise exception 'ROOM_FULL'; end if;
  if exists (select 1 from public.arithmetic_duel_players where room_id = v_room.id and lower(display_name) = lower(pg_catalog.btrim(p_name))) then raise exception 'NAME_TAKEN'; end if;
  select coalesce(max(seat), 0) + 1 into v_seat from public.arithmetic_duel_players where room_id = v_room.id;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.arithmetic_duel_players (room_id, display_name, join_token_hash, seat)
  values (v_room.id, pg_catalog.btrim(p_name), encode(extensions.digest(v_token, 'sha256'), 'hex'), v_seat)
  returning id into v_player;
  return jsonb_build_object('room_id', v_room.id, 'player_id', v_player, 'token', v_token, 'code', v_room.code);
end;
$$;

create or replace function public.arithmetic_duel_host_start(p_room uuid, p_player uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.arithmetic_duel_rooms%rowtype;
  v_question jsonb;
  v_start timestamptz := clock_timestamp() + interval '3 seconds';
begin
  if not public.arithmetic_duel_player_ok(p_room, p_player, p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.arithmetic_duel_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player then raise exception 'HOST_ONLY'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if (select count(*) from public.arithmetic_duel_players where room_id = p_room) < 2 then raise exception 'NEED_2_PLAYERS'; end if;
  v_question := public.arithmetic_duel_build_question(v_room.difficulty, v_room.operation);
  insert into public.arithmetic_duel_rounds (room_id, round_number, question_text, correct_answer, starts_at, ends_at)
  values (p_room, 1, v_question ->> 'question_text', (v_question ->> 'correct_answer')::integer, v_start, v_start + pg_catalog.make_interval(secs => v_room.time_limit));
  update public.arithmetic_duel_rooms set status = 'playing', current_round = 1, started_at = clock_timestamp() where id = p_room;
  return jsonb_build_object('status', 'playing', 'current_round', 1);
end;
$$;

create or replace function public.arithmetic_duel_get_state(p_room uuid, p_player uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.arithmetic_duel_rooms%rowtype;
  v_round public.arithmetic_duel_rounds%rowtype;
  v_now timestamptz := clock_timestamp();
  v_round_payload jsonb := null;
begin
  if not public.arithmetic_duel_player_ok(p_room, p_player, p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  update public.arithmetic_duel_players set last_seen_at = v_now where id = p_player and room_id = p_room;
  select * into v_room from public.arithmetic_duel_rooms where id = p_room;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select * into v_round from public.arithmetic_duel_rounds where room_id = p_room and round_number = v_room.current_round;

  if v_round.id is not null then
    v_round_payload := jsonb_build_object(
      'id', v_round.id,
      'number', v_round.round_number,
      'question_text', v_round.question_text,
      'starts_at', v_round.starts_at,
      'ends_at', v_round.ends_at,
      'answered_by_me', exists (select 1 from public.arithmetic_duel_answers where round_id = v_round.id and player_id = p_player),
      'finished_at', v_round.finished_at
    );
    if v_round.finished_at is not null then
      v_round_payload := v_round_payload || jsonb_build_object(
        'correct_answer', v_round.correct_answer,
        'winner_player_id', v_round.winner_player_id,
        'winner_name', (select display_name from public.arithmetic_duel_players where id = v_round.winner_player_id),
        'reveal_until', v_round.finished_at + interval '2 seconds'
      );
    end if;
  end if;

  return jsonb_build_object(
    'server_now', v_now,
    'room', jsonb_build_object('id', v_room.id, 'code', v_room.code, 'status', v_room.status, 'max_players', v_room.max_players, 'difficulty', v_room.difficulty, 'operation', v_room.operation, 'round_count', v_room.round_count, 'time_limit', v_room.time_limit, 'current_round', v_room.current_round, 'host_player_id', v_room.host_player_id, 'started_at', v_room.started_at, 'finished_at', v_room.finished_at),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'seat', seat, 'score', score, 'correct', correct_count, 'wrong', wrong_count, 'round_wins', round_wins, 'is_host', is_host) order by score desc, seat), '[]'::jsonb) from public.arithmetic_duel_players where room_id = p_room),
    'round', v_round_payload
  );
end;
$$;

create or replace function public.arithmetic_duel_submit_answer(p_room uuid, p_round uuid, p_player uuid, p_token text, p_answer integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.arithmetic_duel_rooms%rowtype;
  v_round public.arithmetic_duel_rounds%rowtype;
  v_now timestamptz := clock_timestamp();
  v_correct boolean;
  v_ms integer;
  v_points integer := 0;
  v_answered integer;
  v_players integer;
  v_winner_set integer;
begin
  if not public.arithmetic_duel_player_ok(p_room, p_player, p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.arithmetic_duel_rooms where id = p_room for update;
  select * into v_round from public.arithmetic_duel_rounds where id = p_round and room_id = p_room for update;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_room.status <> 'playing' or v_round.round_number <> v_room.current_round then raise exception 'ROUND_NOT_ACTIVE'; end if;
  if v_round.finished_at is not null then raise exception 'ROUND_CLOSED'; end if;
  if v_round.starts_at > v_now then raise exception 'ROUND_NOT_STARTED'; end if;
  if v_round.ends_at <= v_now then raise exception 'ROUND_EXPIRED'; end if;
  if exists (select 1 from public.arithmetic_duel_answers where round_id = p_round and player_id = p_player) then raise exception 'ANSWER_ALREADY_SUBMITTED'; end if;

  v_correct := p_answer = v_round.correct_answer;
  v_ms := greatest(0, extract(epoch from (v_now - v_round.starts_at) * 1000)::integer);
  if v_correct then
    v_points := 100 + greatest(0, ceil(extract(epoch from (v_round.ends_at - v_now)))::integer) * 10;
  end if;
  insert into public.arithmetic_duel_answers (room_id, round_id, player_id, answer_value, is_correct, response_ms, points)
  values (p_room, p_round, p_player, p_answer, v_correct, v_ms, v_points);
  update public.arithmetic_duel_players set score = score + v_points, correct_count = correct_count + case when v_correct then 1 else 0 end, wrong_count = wrong_count + case when v_correct then 0 else 1 end, last_seen_at = v_now where id = p_player and room_id = p_room;

  if v_correct then
    update public.arithmetic_duel_rounds set winner_player_id = p_player, finished_at = v_now where id = p_round and finished_at is null;
    get diagnostics v_winner_set = row_count;
    if v_winner_set = 1 then
      update public.arithmetic_duel_players set round_wins = round_wins + 1 where id = p_player and room_id = p_room;
    end if;
  else
    select count(*) into v_answered from public.arithmetic_duel_answers where round_id = p_round;
    select count(*) into v_players from public.arithmetic_duel_players where room_id = p_room;
    if v_answered >= v_players then update public.arithmetic_duel_rounds set finished_at = v_now where id = p_round and finished_at is null; end if;
  end if;
  return jsonb_build_object('accepted', true, 'is_correct', v_correct, 'points', v_points);
end;
$$;

create or replace function public.arithmetic_duel_tick(p_room uuid, p_player uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.arithmetic_duel_rooms%rowtype;
  v_round public.arithmetic_duel_rounds%rowtype;
  v_question jsonb;
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_inserted integer;
begin
  if not public.arithmetic_duel_player_ok(p_room, p_player, p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.arithmetic_duel_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player then raise exception 'HOST_ONLY'; end if;
  if v_room.status <> 'playing' then return jsonb_build_object('status', v_room.status); end if;
  select * into v_round from public.arithmetic_duel_rounds where room_id = p_room and round_number = v_room.current_round for update;
  if v_round.finished_at is null and v_round.ends_at <= v_now then
    update public.arithmetic_duel_rounds set finished_at = v_now where id = v_round.id;
    v_round.finished_at := v_now;
  end if;
  if v_round.finished_at is null or v_round.finished_at + interval '2 seconds' > v_now then return jsonb_build_object('status', 'playing', 'current_round', v_room.current_round); end if;
  if v_room.current_round >= v_room.round_count then
    update public.arithmetic_duel_rooms set status = 'finished', finished_at = v_now where id = p_room;
    return jsonb_build_object('status', 'finished');
  end if;
  v_question := public.arithmetic_duel_build_question(v_room.difficulty, v_room.operation);
  v_start := v_now + interval '2 seconds';
  insert into public.arithmetic_duel_rounds (room_id, round_number, question_text, correct_answer, starts_at, ends_at)
  values (p_room, v_room.current_round + 1, v_question ->> 'question_text', (v_question ->> 'correct_answer')::integer, v_start, v_start + pg_catalog.make_interval(secs => v_room.time_limit))
  on conflict (room_id, round_number) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.arithmetic_duel_rooms set current_round = current_round + 1 where id = p_room and current_round = v_room.current_round;
    return jsonb_build_object('status', 'playing', 'current_round', v_room.current_round + 1);
  end if;
  return jsonb_build_object('status', 'playing', 'current_round', v_room.current_round);
end;
$$;

revoke all on function public.arithmetic_duel_player_ok(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.arithmetic_duel_build_question(smallint, text) from public, anon, authenticated;
revoke all on function public.arithmetic_duel_create_room(text, integer, integer, text, integer, integer) from public;
revoke all on function public.arithmetic_duel_join_room(text, text) from public;
revoke all on function public.arithmetic_duel_host_start(uuid, uuid, text) from public;
revoke all on function public.arithmetic_duel_get_state(uuid, uuid, text) from public;
revoke all on function public.arithmetic_duel_submit_answer(uuid, uuid, uuid, text, integer) from public;
revoke all on function public.arithmetic_duel_tick(uuid, uuid, text) from public;

grant execute on function public.arithmetic_duel_create_room(text, integer, integer, text, integer, integer) to anon, authenticated;
grant execute on function public.arithmetic_duel_join_room(text, text) to anon, authenticated;
grant execute on function public.arithmetic_duel_host_start(uuid, uuid, text) to anon, authenticated;
grant execute on function public.arithmetic_duel_get_state(uuid, uuid, text) to anon, authenticated;
grant execute on function public.arithmetic_duel_submit_answer(uuid, uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.arithmetic_duel_tick(uuid, uuid, text) to anon, authenticated;
