begin;

alter table public.quiz_rooms add column if not exists super_lig_exclude_question_ids uuid[] not null default '{}';

create or replace function public.quiz_super_lig_create_room_v2(
  p_name text, p_era text default 'mixed', p_question_count smallint default 10,
  p_exclude_question_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room uuid; v_player uuid; v_code text; v_token text; v_try int:=0; v_exclude uuid[];
begin
  if char_length(trim(p_name))<1 or char_length(trim(p_name))>24 then raise exception 'INVALID_NAME'; end if;
  if p_era not in ('mixed','2000s','2010s','2020s') then raise exception 'INVALID_ERA'; end if;
  if p_question_count not in (10,15,20) then raise exception 'INVALID_QUESTION_COUNT'; end if;
  select coalesce(array_agg(x order by n desc),'{}') into v_exclude from (select distinct x,n from unnest(coalesce(p_exclude_question_ids,'{}')) with ordinality as u(x,n) where n<=50) s;
  loop v_try:=v_try+1; v_code:=upper(substr(md5(pg_catalog.gen_random_uuid()::text),1,6)); begin
    insert into public.quiz_rooms(code,status,max_players,question_count,game_type,super_lig_era,super_lig_exclude_question_ids) values(v_code,'waiting',2,p_question_count,'super_lig',p_era,v_exclude) returning id into v_room; exit;
  exception when unique_violation then if v_try>=10 then raise; end if; end; end loop;
  v_token:=encode(extensions.gen_random_bytes(24),'hex'); insert into public.quiz_players(room_id,display_name,join_token_hash,is_host) values(v_room,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),true) returning id into v_player; update public.quiz_rooms set host_player_id=v_player where id=v_room;
  return jsonb_build_object('room_id',v_room,'code',v_code,'player_id',v_player,'token',v_token);
end $function$;

create or replace function public.quiz_super_lig_start_game(p_room uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_players integer; v_available integer; v_start timestamptz; v_exclude uuid[]; v_pick_count smallint;
begin
  select * into v_room from public.quiz_rooms where id=p_room for update; if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.game_type<>'super_lig' then raise exception 'WRONG_GAME_TYPE'; end if; if v_room.status<>'waiting' then raise exception 'ROOM_NOT_WAITING'; end if; if v_room.expires_at<=clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select count(*) into v_players from public.quiz_players where room_id=p_room; if v_players<>2 then raise exception 'NEED_EXACTLY_2_PLAYERS'; end if;
  v_exclude:=coalesce(v_room.super_lig_exclude_question_ids,'{}');
  select count(*) into v_available from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) and not (q.id=any(v_exclude));
  if v_available<v_room.question_count then v_exclude:='{}'; end if;
  select count(*) into v_available from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era); if v_available<v_room.question_count then raise exception 'NOT_ENOUGH_QUESTIONS'; end if;
  delete from public.quiz_answers a using public.quiz_rounds r where a.round_id=r.id and r.room_id=p_room; delete from public.quiz_rounds where room_id=p_room; delete from public.quiz_room_questions where room_id=p_room; update public.quiz_players set score=0,correct_count=0 where room_id=p_room;
  insert into public.quiz_room_questions(room_id,position,question_id) select p_room,row_number() over ()::smallint,id from (select q.id from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) and not (q.id=any(v_exclude)) order by q.usage_count asc,random() limit v_room.question_count) picked;
  select count(*) into v_pick_count from public.quiz_room_questions where room_id=p_room; if v_pick_count<v_room.question_count then delete from public.quiz_room_questions where room_id=p_room; insert into public.quiz_room_questions(room_id,position,question_id) select p_room,row_number() over ()::smallint,id from (select q.id from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) order by q.usage_count asc,random() limit v_room.question_count) picked; end if;
  update public.quiz_questions q set usage_count=q.usage_count+1 where q.id in (select question_id from public.quiz_room_questions where room_id=p_room); v_start:=clock_timestamp()+interval '3 seconds'; insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at) select p_room,1,question_id,v_start,v_start+interval '15 seconds' from public.quiz_room_questions where room_id=p_room and position=1; update public.quiz_rooms set status='playing',current_round=1 where id=p_room; return jsonb_build_object('ok',true,'current_round',1,'starts_at',v_start);
end $function$;

revoke all on function public.quiz_super_lig_create_room_v2(text,text,smallint,uuid[]) from public;
grant execute on function public.quiz_super_lig_create_room_v2(text,text,smallint,uuid[]) to anon,authenticated;

create or replace function public.quiz_super_lig_get_state(p_room uuid,p_player uuid,p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_round public.quiz_rounds%rowtype; v_q public.quiz_questions%rowtype; v_players jsonb; v_payload jsonb; v_valid boolean; v_answered boolean; v_answers jsonb;
begin
  select exists(select 1 from public.quiz_players where id=p_player and room_id=p_room and join_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) into v_valid; if not v_valid then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  update public.quiz_players set last_seen_at=clock_timestamp() where id=p_player; select * into v_room from public.quiz_rooms where id=p_room and game_type='super_lig'; if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'score',score,'correct',correct_count,'is_host',is_host) order by joined_at),'[]'::jsonb) into v_players from public.quiz_players where room_id=p_room;
  v_payload:=jsonb_build_object('server_now',clock_timestamp(),'room',jsonb_build_object('id',v_room.id,'code',v_room.code,'status',v_room.status,'max_players',v_room.max_players,'question_count',v_room.question_count,'current_round',v_room.current_round,'host_player_id',v_room.host_player_id,'game_type',v_room.game_type,'era',v_room.super_lig_era),'players',v_players);
  if v_room.status='playing' and v_room.current_round>0 then select * into v_round from public.quiz_rounds where room_id=p_room and round_number=v_room.current_round; select * into v_q from public.quiz_questions where id=v_round.question_id; select exists(select 1 from public.quiz_answers where round_id=v_round.id and player_id=p_player) into v_answered;
    v_payload:=v_payload||jsonb_build_object('round',jsonb_build_object('id',v_round.id,'question_id',v_q.id,'number',v_round.round_number,'starts_at',v_round.starts_at,'ends_at',v_round.ends_at,'revealed_at',v_round.revealed_at,'answered',v_answered,'category',v_q.category,'difficulty',v_q.difficulty,'question',v_q.question_text,'options',jsonb_build_array(v_q.option_a,v_q.option_b,v_q.option_c,v_q.option_d)));
    if v_round.revealed_at is not null then select coalesce(jsonb_agg(jsonb_build_object('player_id',a.player_id,'selected_option',a.selected_option,'response_ms',a.response_ms,'is_correct',a.is_correct,'points_awarded',a.points_awarded) order by a.answered_at,a.id),'[]'::jsonb) into v_answers from public.quiz_answers a where a.round_id=v_round.id; v_payload:=v_payload||jsonb_build_object('reveal',jsonb_build_object('correct_option',v_q.correct_option,'explanation',v_q.explanation,'answers',v_answers,'winner_id',(select a.player_id from public.quiz_answers a where a.round_id=v_round.id and a.points_awarded=1 limit 1))); end if;
  end if; return v_payload;
end $function$;
commit;
