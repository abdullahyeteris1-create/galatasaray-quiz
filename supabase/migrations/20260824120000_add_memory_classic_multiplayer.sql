create table if not exists public.memory_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  max_players smallint not null check (max_players in (2,4,6,8)),
  card_count smallint not null check (card_count in (12,20,30,40,48,60)),
  current_player_id uuid,
  turn_number integer not null default 1,
  first_card_id uuid,
  second_card_id uuid,
  reveal_until timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  winner_player_id uuid
);

create table if not exists public.memory_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_rooms(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  join_token_hash text not null,
  seat smallint not null,
  score integer not null default 0,
  matches smallint not null default 0,
  wrong_attempts smallint not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, display_name)
);

create unique index if not exists memory_players_room_name_idx on public.memory_players(room_id, lower(display_name));

create table if not exists public.memory_cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_rooms(id) on delete cascade,
  position smallint not null,
  player_key text not null,
  pair_key text not null,
  player_name text not null,
  player_image text not null,
  is_matched boolean not null default false,
  matched_by_player_id uuid,
  matched_at timestamptz,
  unique (room_id, position)
);

create table if not exists public.memory_moves (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.memory_rooms(id) on delete cascade,
  player_id uuid not null references public.memory_players(id) on delete cascade,
  turn_number integer not null,
  first_card_id uuid not null references public.memory_cards(id),
  second_card_id uuid not null references public.memory_cards(id),
  is_match boolean not null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists memory_players_room_idx on public.memory_players(room_id, seat);
create index if not exists memory_cards_room_idx on public.memory_cards(room_id, position);
create index if not exists memory_moves_room_idx on public.memory_moves(room_id, created_at);

alter table public.memory_rooms enable row level security;
alter table public.memory_players enable row level security;
alter table public.memory_cards enable row level security;
alter table public.memory_moves enable row level security;
revoke all on public.memory_rooms, public.memory_players, public.memory_cards, public.memory_moves from anon, authenticated;

create or replace function public.memory_player_ok(p_room uuid, p_player uuid, p_token text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.memory_players
    where room_id = p_room and id = p_player
      and join_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  )
$$;

create or replace function public.memory_get_state(p_room uuid, p_player uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room public.memory_rooms%rowtype; v_now timestamptz := clock_timestamp(); v_cards jsonb; v_players jsonb;
begin
  if not public.memory_player_ok(p_room, p_player, p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  update public.memory_players set last_seen_at = v_now where id = p_player and room_id = p_room;
  select * into v_room from public.memory_rooms where id = p_room;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'position', c.position,
    'state', case when c.is_matched then 'matched' when c.id = v_room.first_card_id or c.id = v_room.second_card_id then 'open' else 'hidden' end,
    'name', case when c.is_matched or c.id = v_room.first_card_id or c.id = v_room.second_card_id then c.player_name end,
    'image', case when c.is_matched or c.id = v_room.first_card_id or c.id = v_room.second_card_id then c.player_image end
  )) order by c.position), '[]'::jsonb) into v_cards from public.memory_cards c where c.room_id = p_room;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'seat',seat,'score',score,'matches',matches,'wrong',wrong_attempts,'is_host',is_host) order by seat), '[]'::jsonb) into v_players from public.memory_players where room_id = p_room;
  return jsonb_build_object(
    'server_now', v_now, 'room', jsonb_build_object('id',v_room.id,'code',v_room.code,'status',v_room.status,'max_players',v_room.max_players,'card_count',v_room.card_count,'current_player_id',v_room.current_player_id,'turn_number',v_room.turn_number),
    'players',v_players,'cards',v_cards,
    'reveal_until', case when v_room.reveal_until > v_now then v_room.reveal_until end
  );
end $$;

create or replace function public.memory_create_room(p_name text, p_max_players integer, p_card_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room uuid; v_player uuid; v_token text; v_code text; v_pairs integer := p_card_count / 2; v_pool jsonb := '[
    {"id":"hagi","name":"Hagi"},{"id":"taffarel","name":"Taffarel"},{"id":"jardel","name":"Jardel"},{"id":"mondragon","name":"Mondragon"},{"id":"hasan-sas","name":"Hasan Şaş"},{"id":"ergun-penbe","name":"Ergün Penbe"},{"id":"umit-karan","name":"Ümit Karan"},{"id":"necati-ates","name":"Necati Ateş"},{"id":"arda-turan","name":"Arda Turan"},{"id":"baros","name":"Milan Baroš"},{"id":"kewell","name":"Harry Kewell"},{"id":"keita","name":"Keita"},{"id":"elano","name":"Elano"},{"id":"muslera","name":"Muslera"},{"id":"melo","name":"Melo"},{"id":"sneijder","name":"Sneijder"},{"id":"drogba","name":"Drogba"},{"id":"burak-yilmaz","name":"Burak Yılmaz"},{"id":"donk","name":"Donk"},{"id":"linnes","name":"Linnes"},{"id":"rodrigues","name":"Rodrigues"},{"id":"gomis","name":"Gomis"},{"id":"onyekuru","name":"Onyekuru"},{"id":"torreira","name":"Torreira"},{"id":"mertens","name":"Mertens"},{"id":"icardi","name":"Icardi"},{"id":"capone","name":"Capone"},{"id":"filipescu","name":"Filipescu"},{"id":"nonda","name":"Nonda"},{"id":"linderoth","name":"Linderoth"},{"id":"tomas","name":"Stjepan Tomas"},{"id":"dany","name":"Dany Nounkeu"}
  ]';
begin
  if trim(p_name) is null or p_max_players not in (2,4,6,8) or p_card_count not in (12,20,30,40,48,60) then raise exception 'INVALID_ROOM_OPTIONS'; end if;
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,6));
    begin insert into public.memory_rooms(code,max_players,card_count) values(v_code,p_max_players,p_card_count) returning id into v_room; exit; exception when unique_violation then end;
  end loop;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.memory_players(room_id,display_name,join_token_hash,seat,is_host) values(v_room,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),1,true) returning id into v_player;
  update public.memory_rooms set current_player_id = v_player where id = v_room;
  with selected as (select value from jsonb_array_elements(v_pool) order by random() limit v_pairs), doubled as (select value, n from selected cross join generate_series(1,2) n), ordered as (select value, row_number() over(order by random()) - 1 as pos from doubled)
  insert into public.memory_cards(room_id,position,player_key,pair_key,player_name,player_image)
  select v_room,pos,(value->>'id'),(value->>'id'),(value->>'name'),('/players/' || (value->>'id') || '.webp') from ordered;
  return jsonb_build_object('room_id',v_room,'player_id',v_player,'token',v_token,'code',v_code);
end $$;

create or replace function public.memory_join_room(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room public.memory_rooms%rowtype; v_count integer; v_token text; v_player uuid; v_seat integer;
begin
  select * into v_room from public.memory_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  select count(*) into v_count from public.memory_players where room_id = v_room.id;
  if v_count >= v_room.max_players then raise exception 'ROOM_FULL'; end if;
  if exists(select 1 from public.memory_players where room_id=v_room.id and lower(display_name)=lower(trim(p_name))) then raise exception 'NAME_TAKEN'; end if;
  select coalesce(max(seat),0)+1 into v_seat from public.memory_players where room_id=v_room.id;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.memory_players(room_id,display_name,join_token_hash,seat,is_host) values(v_room.id,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),v_seat,false) returning id into v_player;
  return jsonb_build_object('room_id',v_room.id,'player_id',v_player,'token',v_token,'code',v_room.code);
end $$;

create or replace function public.memory_host_start(p_room uuid, p_player uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room public.memory_rooms%rowtype; v_count integer;
begin
  if not public.memory_player_ok(p_room,p_player,p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.memory_rooms where id=p_room for update;
  if not exists(select 1 from public.memory_players where id=p_player and room_id=p_room and is_host) then raise exception 'HOST_ONLY'; end if;
  select count(*) into v_count from public.memory_players where room_id=p_room;
  if v_count < 2 then raise exception 'NEED_2_PLAYERS'; end if;
  update public.memory_rooms set status='playing',started_at=clock_timestamp(),turn_number=1 where id=p_room and status='waiting';
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.memory_flip_card(p_room uuid, p_player uuid, p_token text, p_card uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room public.memory_rooms%rowtype; v_first public.memory_cards%rowtype; v_second public.memory_cards%rowtype; v_match boolean; v_points integer := 0; v_total integer;
begin
  if not public.memory_player_ok(p_room,p_player,p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.memory_rooms where id=p_room for update;
  if v_room.status <> 'playing' then raise exception 'GAME_NOT_PLAYING'; end if;
  if v_room.current_player_id <> p_player then raise exception 'NOT_YOUR_TURN'; end if;
  if v_room.reveal_until is not null and v_room.reveal_until > clock_timestamp() then raise exception 'CARDS_REVEALING'; end if;
  select * into v_second from public.memory_cards where id=p_card and room_id=p_room;
  if not found or v_second.is_matched then raise exception 'CARD_UNAVAILABLE'; end if;
  if v_room.first_card_id is null then update public.memory_rooms set first_card_id=p_card where id=p_room; return jsonb_build_object('ok',true,'phase','first'); end if;
  if v_room.first_card_id = p_card then raise exception 'SAME_CARD'; end if;
  select * into v_first from public.memory_cards where id=v_room.first_card_id and room_id=p_room;
  v_match := v_first.pair_key = v_second.pair_key;
  if v_match then
    select 100 + least(p.matches * 20, 100) into v_points from public.memory_players p where p.id=p_player;
    update public.memory_cards set is_matched=true,matched_by_player_id=p_player,matched_at=clock_timestamp() where id in (v_first.id,v_second.id);
    update public.memory_players set score=score+v_points,matches=matches+1,last_seen_at=clock_timestamp() where id=p_player;
    insert into public.memory_moves(room_id,player_id,turn_number,first_card_id,second_card_id,is_match,points) values(p_room,p_player,v_room.turn_number,v_first.id,v_second.id,true,v_points);
    select count(*) into v_total from public.memory_cards where room_id=p_room and is_matched;
    update public.memory_rooms set first_card_id=null,second_card_id=null,reveal_until=null,status=case when v_total=card_count then 'finished' else status end,finished_at=case when v_total=card_count then clock_timestamp() end where id=p_room;
  else
    update public.memory_players set wrong_attempts=wrong_attempts+1,last_seen_at=clock_timestamp() where id=p_player;
    update public.memory_rooms set second_card_id=p_card,reveal_until=clock_timestamp()+interval '1.2 seconds' where id=p_room;
    insert into public.memory_moves(room_id,player_id,turn_number,first_card_id,second_card_id,is_match,points) values(p_room,p_player,v_room.turn_number,v_first.id,v_second.id,false,0);
  end if;
  return jsonb_build_object('ok',true,'phase',case when v_match then 'match' else 'wrong' end,'points',v_points);
end $$;

create or replace function public.memory_tick(p_room uuid, p_player uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room public.memory_rooms%rowtype; v_next uuid;
begin
  if not public.memory_player_ok(p_room,p_player,p_token) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_room from public.memory_rooms where id=p_room for update;
  update public.memory_players set last_seen_at=clock_timestamp() where id=p_player and room_id=p_room;
  if v_room.status='playing' and v_room.reveal_until is not null and v_room.reveal_until <= clock_timestamp() then
    select id into v_next from public.memory_players where room_id=p_room and seat > (select seat from public.memory_players where id=v_room.current_player_id) order by seat limit 1;
    if v_next is null then select id into v_next from public.memory_players where room_id=p_room order by seat limit 1; end if;
    update public.memory_rooms set first_card_id=null,second_card_id=null,reveal_until=null,current_player_id=v_next,turn_number=turn_number+1 where id=p_room;
  end if;
  return jsonb_build_object('ok',true);
end $$;

grant execute on function public.memory_create_room(text,integer,integer) to anon, authenticated;
grant execute on function public.memory_join_room(text,text) to anon, authenticated;
grant execute on function public.memory_state(uuid,uuid,text) to anon, authenticated;
grant execute on function public.memory_host_start(uuid,uuid,text) to anon, authenticated;
grant execute on function public.memory_flip_card(uuid,uuid,text,uuid) to anon, authenticated;
grant execute on function public.memory_tick(uuid,uuid,text) to anon, authenticated;
revoke all on function public.memory_player_ok(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.memory_get_state(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.memory_create_room(text,integer,integer) from public;
revoke all on function public.memory_join_room(text,text) from public;
revoke all on function public.memory_host_start(uuid,uuid,text) from public;
revoke all on function public.memory_flip_card(uuid,uuid,text,uuid) from public;
revoke all on function public.memory_tick(uuid,uuid,text) from public;
grant execute on function public.memory_get_state(uuid,uuid,text) to anon, authenticated;
