-- Shared, turn-based board for Memory Race Online.
-- This migration keeps the existing room/player/round tables and RPCs
-- backward-compatible while moving live card state to the room.

alter table public.memory_race_rooms
  add column if not exists current_player_id uuid,
  add column if not exists turn_number integer not null default 0,
  add column if not exists first_card_index integer,
  add column if not exists second_card_index integer,
  add column if not exists reveal_until timestamptz,
  add column if not exists matched_cards jsonb not null default '[]'::jsonb;

create index if not exists memory_race_rooms_current_player_idx
  on public.memory_race_rooms(current_player_id)
  where current_player_id is not null;

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
  v_now timestamptz := clock_timestamp();
  v_cards jsonb := '[]'::jsonb;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.memory_race_players
  set last_seen_at = v_now
  where id = p_player
    and room_id = p_room;

  select * into v_round
  from public.memory_race_rounds
  where room_id = p_room
    and round_number = v_room.current_round;

  if v_round.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'index', card.ordinality - 1,
          'value', case
            when v_room.status = 'finished'
              or exists (
                select 1
                from jsonb_array_elements(v_room.matched_cards) as matched
                where (matched ->> 'index')::integer = card.ordinality - 1
              )
              or card.ordinality - 1 = v_room.first_card_index
              or card.ordinality - 1 = v_room.second_card_index
              then card.value ->> 'value'
            else null
          end,
          'matched', exists (
            select 1
            from jsonb_array_elements(v_room.matched_cards) as matched
            where (matched ->> 'index')::integer = card.ordinality - 1
          ),
          'matched_by_player_id', (
            select matched ->> 'player_id'
            from jsonb_array_elements(v_room.matched_cards) as matched
            where (matched ->> 'index')::integer = card.ordinality - 1
            limit 1
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
      'starts_at', case when v_round.id is null then null else v_round.starts_at end,
      'ends_at', case when v_round.id is null then null else v_round.ends_at end,
      'current_player_id', v_room.current_player_id,
      'turn_number', v_room.turn_number,
      'first_card_index', v_room.first_card_index,
      'second_card_index', v_room.second_card_index,
      'reveal_until', v_room.reveal_until
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
  v_start_at timestamptz := clock_timestamp() + interval '2 seconds';
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
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.host_player_id <> p_player then
    raise exception 'HOST_ONLY';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'ROOM_NOT_WAITING';
  end if;
  if (select count(*) from public.memory_race_players where room_id = p_room) < 2 then
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

  for v_index in 0..v_pair_count - 1 loop
    v_payload := v_payload || jsonb_build_array(
      jsonb_build_object('pair', v_pool[v_index + 1], 'value', v_pool[v_index + 1]),
      jsonb_build_object('pair', v_pool[v_index + 1], 'value', v_pool[v_index + 1])
    );
  end loop;

  select jsonb_agg(card order by random()) into v_payload
  from jsonb_array_elements(v_payload) as card;

  insert into public.memory_race_rounds (
    room_id, round_number, payload, starts_at, ends_at
  )
  values (
    p_room,
    1,
    jsonb_build_object('cards', v_payload),
    v_start_at,
    v_start_at + interval '30 minutes'
  );

  update public.memory_race_rooms
  set status = 'playing',
      current_round = 1,
      started_at = clock_timestamp(),
      current_player_id = host_player_id,
      turn_number = 1,
      first_card_index = null,
      second_card_index = null,
      reveal_until = null,
      matched_cards = '[]'::jsonb
  where id = p_room;
end;
$$;

create or replace function public.memory_race_flip_card(
  p_room uuid,
  p_player uuid,
  p_token text,
  p_card_index integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.memory_race_rooms%rowtype;
  v_round public.memory_race_rounds%rowtype;
  v_first_card jsonb;
  v_second_card jsonb;
  v_is_correct boolean;
  v_now timestamptz := clock_timestamp();
  v_points integer := 100;
  v_matched_cards jsonb;
  v_card_count integer;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.status <> 'playing' then
    raise exception 'GAME_NOT_PLAYING';
  end if;
  if v_room.current_player_id is distinct from p_player then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_room.reveal_until is not null and v_room.reveal_until > v_now then
    raise exception 'REVEAL_IN_PROGRESS';
  end if;

  select * into v_round
  from public.memory_race_rounds
  where room_id = p_room
    and round_number = v_room.current_round
  for update;

  if not found or v_round.starts_at > v_now then
    raise exception 'ROUND_NOT_ACTIVE';
  end if;

  v_card_count := jsonb_array_length(v_round.payload -> 'cards');
  if p_card_index < 0 or p_card_index >= v_card_count then
    raise exception 'INVALID_CARD';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_room.matched_cards) as matched
    where (matched ->> 'index')::integer = p_card_index
  ) then
    raise exception 'CARD_ALREADY_MATCHED';
  end if;

  if p_card_index = v_room.first_card_index then
    raise exception 'CARD_ALREADY_OPEN';
  end if;

  if v_room.first_card_index is null then
    update public.memory_race_rooms
    set first_card_index = p_card_index
    where id = p_room;
    return;
  end if;

  v_first_card := v_round.payload -> 'cards' -> v_room.first_card_index;
  v_second_card := v_round.payload -> 'cards' -> p_card_index;
  v_is_correct := (v_first_card ->> 'pair') = (v_second_card ->> 'pair');

  if v_is_correct then
    v_matched_cards := coalesce(v_room.matched_cards, '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object('index', v_room.first_card_index, 'player_id', p_player),
        jsonb_build_object('index', p_card_index, 'player_id', p_player)
      );

    update public.memory_race_players
    set score = score + v_points,
        correct_count = correct_count + 1,
        last_seen_at = v_now
    where id = p_player;

    update public.memory_race_rooms
    set matched_cards = v_matched_cards,
        first_card_index = null,
        second_card_index = null,
        reveal_until = null
    where id = p_room;

    if jsonb_array_length(v_matched_cards) >= v_card_count then
      update public.memory_race_rooms
      set status = 'finished',
          finished_at = v_now
      where id = p_room;
    end if;
  else
    update public.memory_race_players
    set wrong_count = wrong_count + 1,
        last_seen_at = v_now
    where id = p_player;

    update public.memory_race_rooms
    set second_card_index = p_card_index,
        reveal_until = v_now + interval '1.3 seconds'
    where id = p_room;
  end if;

  insert into public.memory_race_answers (
    round_id, player_id, first_index, second_index,
    is_correct, response_ms, points
  )
  values (
    v_round.id, p_player, v_room.first_card_index, p_card_index,
    v_is_correct,
    greatest(0, extract(epoch from (v_now - v_round.starts_at) * 1000)::integer),
    case when v_is_correct then v_points else 0 end
  );
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
begin
  -- Compatibility wrapper for older clients. New clients send one index.
  perform public.memory_race_flip_card(
    p_room,
    p_player,
    p_token,
    case when p_second = -1 then p_first else p_second end
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
  v_now timestamptz := clock_timestamp();
  v_current_seat smallint;
  v_next_player uuid;
begin
  if not public.memory_race_player_ok(p_room, p_player, p_token) then
    raise exception 'UNAUTHORIZED_PLAYER';
  end if;

  select * into v_room
  from public.memory_race_rooms
  where id = p_room
  for update;

  if not found or v_room.status <> 'playing' then
    return;
  end if;
  if v_room.reveal_until is null or v_room.reveal_until > v_now then
    return;
  end if;

  select seat into v_current_seat
  from public.memory_race_players
  where id = v_room.current_player_id
    and room_id = p_room;

  select id into v_next_player
  from public.memory_race_players
  where room_id = p_room
    and seat > coalesce(v_current_seat, 0)
  order by seat
  limit 1;

  if v_next_player is null then
    select id into v_next_player
    from public.memory_race_players
    where room_id = p_room
    order by seat
    limit 1;
  end if;

  update public.memory_race_rooms
  set first_card_index = null,
      second_card_index = null,
      reveal_until = null,
      current_player_id = v_next_player,
      turn_number = turn_number + 1
  where id = p_room;
end;
$$;

revoke all on function public.memory_race_get_state(uuid, uuid, text) from public;
grant execute on function public.memory_race_get_state(uuid, uuid, text) to anon, authenticated;

revoke all on function public.memory_race_host_start(uuid, uuid, text) from public;
grant execute on function public.memory_race_host_start(uuid, uuid, text) to anon, authenticated;

revoke all on function public.memory_race_flip_card(uuid, uuid, text, integer) from public;
grant execute on function public.memory_race_flip_card(uuid, uuid, text, integer) to anon, authenticated;

revoke all on function public.memory_race_submit(uuid, uuid, text, integer, integer) from public;
grant execute on function public.memory_race_submit(uuid, uuid, text, integer, integer) to anon, authenticated;

revoke all on function public.memory_race_tick(uuid, uuid, text) from public;
grant execute on function public.memory_race_tick(uuid, uuid, text) to anon, authenticated;
