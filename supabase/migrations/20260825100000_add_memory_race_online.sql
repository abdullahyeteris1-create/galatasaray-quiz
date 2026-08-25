-- Hafiza Yarisi Online.
-- Round payload immutable kart dizilimidir; oyuncu ilerlemesi progress tablosundadir.

create extension if not exists pgcrypto;

create table if not exists public.memory_race_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished')),
  max_players smallint not null check (max_players in (2, 4, 6, 8)),
  level smallint not null check (level between 1 and 6),
  round_count smallint not null check (round_count in (3, 5, 10)),
  current_round smallint not null default 0,
  host_player_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.memory_race_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_race_rooms(id) on delete cascade,
  display_name text not null
    check (char_length(trim(display_name)) between 2 and 24),
  join_token_hash text not null,
  seat smallint not null,
  score integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, display_name)
);

create table if not exists public.memory_race_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_race_rooms(id) on delete cascade,
  round_number smallint not null,
  payload jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  unique (room_id, round_number)
);

create table if not exists public.memory_race_progress (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_race_rooms(id) on delete cascade,
  round_id uuid not null references public.memory_race_rounds(id) on delete cascade,
  player_id uuid not null references public.memory_race_players(id) on delete cascade,
  matched_pairs jsonb not null default '[]'::jsonb,
  first_open_index integer,
  second_open_index integer,
  reveal_until timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.memory_race_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.memory_race_rounds(id) on delete cascade,
  player_id uuid not null references public.memory_race_players(id) on delete cascade,
  first_index smallint not null,
  second_index smallint not null,
  is_correct boolean not null,
  response_ms integer not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists memory_race_players_room_idx
  on public.memory_race_players(room_id, seat);

create index if not exists memory_race_progress_round_idx
  on public.memory_race_progress(round_id, player_id);

alter table public.memory_race_rooms enable row level security;
alter table public.memory_race_players enable row level security;
alter table public.memory_race_rounds enable row level security;
alter table public.memory_race_progress enable row level security;
alter table public.memory_race_answers enable row level security;

revoke all on public.memory_race_rooms,
  public.memory_race_players,
  public.memory_race_rounds,
  public.memory_race_progress,
  public.memory_race_answers
  from anon, authenticated;

create or replace function public.memory_race_player_ok(
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
    from public.memory_race_players
    where room_id = p_room
      and id = p_player
      and join_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

create or replace function public.memory_race_create_room(
  p_name text,
  p_max_players integer,
  p_level integer,
  p_round_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_token text;
  v_code text;
begin
  if trim(p_name) is null
     or trim(p_name) = ''
     or p_max_players not in (2, 4, 6, 8)
     or p_level not between 1 and 6
     or p_round_count not in (3, 5, 10) then
    raise exception 'INVALID_ROOM_OPTIONS';
  end if;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));

    begin
      insert into public.memory_race_rooms (code, max_players, level, round_count)
      values (v_code, p_max_players, p_level, p_round_count)
      returning id into v_room_id;
      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.memory_race_players (
    room_id,
    display_name,
    join_token_hash,
    seat,
    is_host
  )
  values (
    v_room_id,
    trim(p_name),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    1,
    true
  )
  returning id into v_player_id;

  update public.memory_race_rooms
  set host_player_id = v_player_id
  where id = v_room_id;

  return jsonb_build_object(
    'room_id', v_room_id,
    'player_id', v_player_id,
    'token', v_token,
    'code', v_code
  );
end;
$$;

create or replace function public.memory_race_join_room(
  p_code text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_player_id uuid;
  v_token text;
  v_seat integer;
begin
  select * into v_room
  from public.memory_race_rooms
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'ROOM_NOT_WAITING';
  end if;

  if (
    select count(*)
    from public.memory_race_players
    where room_id = v_room.id
  ) >= v_room.max_players then
    raise exception 'ROOM_FULL';
  end if;

  if exists (
    select 1
    from public.memory_race_players
    where room_id = v_room.id
      and lower(display_name) = lower(trim(p_name))
  ) then
    raise exception 'NAME_TAKEN';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat
  from public.memory_race_players
  where room_id = v_room.id;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.memory_race_players (
    room_id,
    display_name,
    join_token_hash,
    seat
  )
  values (
    v_room.id,
    trim(p_name),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_seat
  )
  returning id into v_player_id;

  return jsonb_build_object(
    'room_id', v_room.id,
    'player_id', v_player_id,
    'token', v_token,
    'code', v_room.code
  );
end;
$$;

create or replace function public.memory_race_get_state(
  p_room uuid,
  p_player uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_round public.memory_race_rounds%rowtype;
  v_progress public.memory_race_progress%rowtype;
  v_now timestamptz := clock_timestamp();
  v_cards jsonb := '[]'::jsonb;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  update public.memory_race_players
  set last_seen_at = v_now
  where id = p_player
    and room_id = p_room;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select * into v_round
  from public.memory_race_rounds
  where room_id = p_room
    and round_number = v_room.current_round;

  if v_round.id is not null then
    insert into public.memory_race_progress (room_id, round_id, player_id)
    values (p_room, v_round.id, p_player)
    on conflict (round_id, player_id) do nothing;

    select * into v_progress
    from public.memory_race_progress
    where round_id = v_round.id
      and player_id = p_player;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'index', card.ordinality - 1,
          'value', case
            when (card.value ->> 'pair') in (
              select jsonb_array_elements_text(v_progress.matched_pairs)
            )
            or card.ordinality - 1 = v_progress.first_open_index
            or (
              card.ordinality - 1 = v_progress.second_open_index
              and v_progress.reveal_until > v_now
            ) then card.value ->> 'value'
            else null
          end,
          'matched', (card.value ->> 'pair') in (
            select jsonb_array_elements_text(v_progress.matched_pairs)
          )
        )
        order by card.ordinality
      ),
      '[]'::jsonb
    ) into v_cards
    from jsonb_array_elements(v_round.payload -> 'cards') with ordinality as card(value, ordinality);
  end if;

  return jsonb_build_object(
    'server_now', v_now,
    'room', jsonb_build_object(
      'id', v_room.id,
      'code', v_room.code,
      'status', v_room.status,
      'max_players', v_room.max_players,
      'level', v_room.level,
      'round_count', v_room.round_count,
      'current_round', v_room.current_round,
      'starts_at', v_round.starts_at,
      'ends_at', v_round.ends_at
    ),
    'players', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', display_name,
            'seat', seat,
            'score', score,
            'correct', correct_count,
            'wrong', wrong_count,
            'is_host', is_host
          ) order by seat
        ),
        '[]'::jsonb
      )
      from public.memory_race_players
      where room_id = p_room
    ),
    'cards', v_cards
  );
end;
$$;

create or replace function public.memory_race_host_start(
  p_room uuid,
  p_player uuid,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_payload jsonb := '[]'::jsonb;
  v_start_at timestamptz := clock_timestamp() + interval '4 seconds';
  v_pool text[] := array[
    'CARD01', 'CARD02', 'CARD03', 'CARD04', 'CARD05',
    'CARD06', 'CARD07', 'CARD08', 'CARD09', 'CARD10',
    'CARD11', 'CARD12', 'CARD13', 'CARD14', 'CARD15',
    'CARD16', 'CARD17', 'CARD18', 'CARD19', 'CARD20',
    'CARD21', 'CARD22', 'CARD23', 'CARD24', 'CARD25',
    'CARD26', 'CARD27', 'CARD28', 'CARD29', 'CARD30'
  ];
  v_pair_count integer;
  v_index integer;
  v_seconds integer;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  if v_room.host_player_id <> p_player then
    raise exception 'HOST_ONLY';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'ROOM_NOT_WAITING';
  end if;

  if (
    select count(*)
    from public.memory_race_players
    where room_id = p_room
  ) < 2 then
    raise exception 'NEED_2_PLAYERS';
  end if;

  v_pair_count := case v_room.level
    when 1 then 8
    when 2 then 10
    when 3 then 12
    when 4 then 16
    when 5 then 20
    else 30
  end;

  v_seconds := case v_room.level
    when 1 then 45
    when 2 then 50
    when 3 then 55
    when 4 then 65
    when 5 then 75
    else 90
  end;

  for v_index in 0..v_pair_count - 1 loop
    v_payload := v_payload || jsonb_build_object(
      'pair', v_index,
      'value', v_pool[v_index + 1]
    );
    v_payload := v_payload || jsonb_build_object(
      'pair', v_index,
      'value', v_pool[v_index + 1]
    );
  end loop;

  select jsonb_agg(card order by random()) into v_payload
  from jsonb_array_elements(v_payload) as card;

  insert into public.memory_race_rounds (
    room_id,
    round_number,
    payload,
    starts_at,
    ends_at
  )
  values (
    p_room,
    1,
    jsonb_build_object('cards', v_payload),
    v_start_at,
    v_start_at + make_interval(secs => v_seconds)
  );

  update public.memory_race_rooms
  set status = 'playing',
      current_round = 1,
      started_at = clock_timestamp()
  where id = p_room;
end;
$$;

create or replace function public.memory_race_submit(
  p_room uuid,
  p_player uuid,
  p_token text,
  p_first integer,
  p_second integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_round public.memory_race_rounds%rowtype;
  v_progress public.memory_race_progress%rowtype;
  v_first_card jsonb;
  v_second_card jsonb;
  v_is_correct boolean;
  v_points integer := 0;
  v_now timestamptz := clock_timestamp();
  v_matched_pairs jsonb;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  select * into v_round
  from public.memory_race_rounds
  where room_id = p_room
    and round_number = v_room.current_round
  for update;

  if v_room.status <> 'playing'
     or v_round.starts_at > v_now
     or v_round.ends_at < v_now then
    raise exception 'ROUND_NOT_ACTIVE';
  end if;

  insert into public.memory_race_progress (room_id, round_id, player_id)
  values (p_room, v_round.id, p_player)
  on conflict (round_id, player_id) do nothing;

  select * into v_progress
  from public.memory_race_progress
  where round_id = v_round.id
    and player_id = p_player
  for update;

  if p_first < 0
     or p_first >= jsonb_array_length(v_round.payload -> 'cards') then
    raise exception 'INVALID_CARDS';
  end if;

  v_first_card := v_round.payload -> 'cards' -> p_first;

  if (v_first_card ->> 'pair') in (
    select jsonb_array_elements_text(v_progress.matched_pairs)
  ) then
    raise exception 'CARD_ALREADY_MATCHED';
  end if;

  -- p_second = -1 is the intentional first-card reveal command.
  if p_second = -1 then
    if v_progress.first_open_index is not null then
      raise exception 'CARD_ALREADY_OPEN';
    end if;

    update public.memory_race_progress
    set first_open_index = p_first,
        updated_at = v_now
    where id = v_progress.id;
    return;
  end if;

  if p_second < 0
     or p_second >= jsonb_array_length(v_round.payload -> 'cards')
     or p_first = p_second
     or v_progress.first_open_index is distinct from p_first then
    raise exception 'INVALID_CARDS';
  end if;

  v_second_card := v_round.payload -> 'cards' -> p_second;

  if (v_second_card ->> 'pair') in (
    select jsonb_array_elements_text(v_progress.matched_pairs)
  ) then
    raise exception 'CARD_ALREADY_MATCHED';
  end if;

  v_is_correct := (v_first_card ->> 'pair') = (v_second_card ->> 'pair');

  if v_is_correct then
    v_matched_pairs := v_progress.matched_pairs || to_jsonb(v_first_card ->> 'pair');
    v_points := 100 + greatest(
      0,
      extract(epoch from (v_round.ends_at - v_now))::integer
    );

    update public.memory_race_players
    set score = score + v_points,
        correct_count = correct_count + 1,
        last_seen_at = v_now
    where id = p_player;

    update public.memory_race_progress
    set matched_pairs = v_matched_pairs,
        first_open_index = null,
        second_open_index = null,
        reveal_until = null,
        completed_at = case
          when jsonb_array_length(v_matched_pairs)
             = jsonb_array_length(v_round.payload -> 'cards') / 2
            then v_now
          else completed_at
        end,
        updated_at = v_now
    where id = v_progress.id;
  else
    update public.memory_race_players
    set wrong_count = wrong_count + 1,
        last_seen_at = v_now
    where id = p_player;

    update public.memory_race_progress
    set second_open_index = p_second,
        reveal_until = v_now + interval '1.2 seconds',
        updated_at = v_now
    where id = v_progress.id;
  end if;

  insert into public.memory_race_answers (
    round_id,
    player_id,
    first_index,
    second_index,
    is_correct,
    response_ms,
    points
  )
  values (
    v_round.id,
    p_player,
    p_first,
    p_second,
    v_is_correct,
    greatest(0, extract(epoch from (v_now - v_round.starts_at) * 1000)::integer),
    v_points
  );
end;
$$;

create or replace function public.memory_race_tick(
  p_room uuid,
  p_player uuid,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_round public.memory_race_rounds%rowtype;
  v_active_count integer;
  v_completed_count integer;
  v_next_payload jsonb;
  v_next_start timestamptz := clock_timestamp() + interval '2 seconds';
  v_seconds integer;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  if v_room.status <> 'playing' then
    return;
  end if;

  select * into v_round
  from public.memory_race_rounds
  where room_id = p_room
    and round_number = v_room.current_round
  for update;

  update public.memory_race_progress
  set first_open_index = null,
      second_open_index = null,
      reveal_until = null,
      updated_at = clock_timestamp()
  where round_id = v_round.id
    and reveal_until <= clock_timestamp();

  select count(*) into v_active_count
  from public.memory_race_players
  where room_id = p_room;

  select count(*) into v_completed_count
  from public.memory_race_progress
  where round_id = v_round.id
    and completed_at is not null;

  if v_round.ends_at > clock_timestamp()
     and v_completed_count < v_active_count then
    return;
  end if;

  if v_room.current_round >= v_room.round_count then
    update public.memory_race_rooms
    set status = 'finished',
        finished_at = clock_timestamp()
    where id = p_room;
    return;
  end if;

  v_seconds := case v_room.level
    when 1 then 45
    when 2 then 50
    when 3 then 55
    when 4 then 65
    when 5 then 75
    else 90
  end;

  select jsonb_agg(card order by random()) into v_next_payload
  from jsonb_array_elements(v_round.payload -> 'cards') as card;

  insert into public.memory_race_rounds (
    room_id,
    round_number,
    payload,
    starts_at,
    ends_at
  )
  values (
    p_room,
    v_room.current_round + 1,
    jsonb_build_object('cards', v_next_payload),
    v_next_start,
    v_next_start + make_interval(secs => v_seconds)
  );

  update public.memory_race_rooms
  set current_round = current_round + 1
  where id = p_room;
end;
$$;

revoke all on function public.memory_race_player_ok(uuid, uuid, text)
  from public, anon, authenticated;

revoke all on function public.memory_race_create_room(text, integer, integer, integer)
  from public;
grant execute on function public.memory_race_create_room(text, integer, integer, integer)
  to anon, authenticated;

revoke all on function public.memory_race_join_room(text, text)
  from public;
grant execute on function public.memory_race_join_room(text, text)
  to anon, authenticated;

revoke all on function public.memory_race_get_state(uuid, uuid, text)
  from public;
grant execute on function public.memory_race_get_state(uuid, uuid, text)
  to anon, authenticated;

revoke all on function public.memory_race_host_start(uuid, uuid, text)
  from public;
grant execute on function public.memory_race_host_start(uuid, uuid, text)
  to anon, authenticated;

revoke all on function public.memory_race_submit(uuid, uuid, text, integer, integer)
  from public;
grant execute on function public.memory_race_submit(uuid, uuid, text, integer, integer)
  to anon, authenticated;

revoke all on function public.memory_race_tick(uuid, uuid, text)
  from public;
grant execute on function public.memory_race_tick(uuid, uuid, text)
  to anon, authenticated;
