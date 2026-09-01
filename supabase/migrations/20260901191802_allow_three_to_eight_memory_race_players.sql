alter table public.memory_race_rooms
  drop constraint if exists memory_race_rooms_max_players_check;

alter table public.memory_race_rooms
  add constraint memory_race_rooms_max_players_check
  check (max_players between 2 and 8);

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
     or p_max_players not between 2 and 8
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
