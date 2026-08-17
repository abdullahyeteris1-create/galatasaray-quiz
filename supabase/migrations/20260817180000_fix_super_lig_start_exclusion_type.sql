begin;

-- Question primary keys are bigint. Keep the original v2 column/function intact
-- for compatibility, but use a correctly typed path for new rooms.
alter table public.quiz_rooms
  add column if not exists super_lig_exclude_question_ids_v2 bigint[] not null default '{}';

create or replace function public.quiz_super_lig_create_room_v3(
  p_name text, p_era text default 'mixed', p_question_count smallint default 10,
  p_exclude_question_ids bigint[] default '{}'
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room uuid; v_player uuid; v_code text; v_token text; v_try int:=0; v_exclude bigint[];
begin
  if char_length(trim(p_name))<1 or char_length(trim(p_name))>24 then raise exception 'INVALID_NAME'; end if;
  if p_era not in ('mixed','2000s','2010s','2020s') then raise exception 'INVALID_ERA'; end if;
  if p_question_count not in (10,15,20) then raise exception 'INVALID_QUESTION_COUNT'; end if;
  select coalesce(array_agg(x order by n desc),'{}') into v_exclude
    from (select distinct x,n from unnest(coalesce(p_exclude_question_ids,'{}')) with ordinality as u(x,n) where n<=50) s;
  loop v_try:=v_try+1; v_code:=upper(substr(md5(pg_catalog.gen_random_uuid()::text),1,6)); begin
    insert into public.quiz_rooms(code,status,max_players,question_count,game_type,super_lig_era,super_lig_exclude_question_ids_v2)
      values(v_code,'waiting',2,p_question_count,'super_lig',p_era,v_exclude) returning id into v_room; exit;
  exception when unique_violation then if v_try>=10 then raise; end if; end; end loop;
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.quiz_players(room_id,display_name,join_token_hash,is_host)
    values(v_room,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),true) returning id into v_player;
  update public.quiz_rooms set host_player_id=v_player where id=v_room;
  return jsonb_build_object('room_id',v_room,'code',v_code,'player_id',v_player,'token',v_token);
end $function$;

create or replace function public.quiz_super_lig_start_game(p_room uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_players integer; v_available integer; v_start timestamptz; v_exclude bigint[]; v_pick_count smallint;
begin
  select * into v_room from public.quiz_rooms where id=p_room for update; if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.game_type<>'super_lig' then raise exception 'WRONG_GAME_TYPE'; end if; if v_room.status<>'waiting' then raise exception 'ROOM_NOT_WAITING'; end if; if v_room.expires_at<=clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select count(*) into v_players from public.quiz_players where room_id=p_room; if v_players<>2 then raise exception 'NEED_EXACTLY_2_PLAYERS'; end if;
  v_exclude:=coalesce(v_room.super_lig_exclude_question_ids_v2,'{}');
  select count(*) into v_available from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) and not (q.id=any(v_exclude));
  while v_available<v_room.question_count and cardinality(v_exclude)>0 loop
    v_exclude:=v_exclude[1:greatest(0,cardinality(v_exclude)-10)];
    select count(*) into v_available from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) and not (q.id=any(v_exclude));
  end loop;
  select count(*) into v_available from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era); if v_available<v_room.question_count then raise exception 'NOT_ENOUGH_QUESTIONS'; end if;
  delete from public.quiz_answers a using public.quiz_rounds r where a.round_id=r.id and r.room_id=p_room; delete from public.quiz_rounds where room_id=p_room; delete from public.quiz_room_questions where room_id=p_room; update public.quiz_players set score=0,correct_count=0 where room_id=p_room;
  insert into public.quiz_room_questions(room_id,position,question_id) select p_room,row_number() over ()::smallint,id from (select q.id from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) and not (q.id=any(v_exclude)) order by q.usage_count asc,random() limit v_room.question_count) picked;
  select count(*) into v_pick_count from public.quiz_room_questions where room_id=p_room; if v_pick_count<v_room.question_count then delete from public.quiz_room_questions where room_id=p_room; insert into public.quiz_room_questions(room_id,position,question_id) select p_room,row_number() over ()::smallint,id from (select q.id from public.quiz_questions q where q.active and q.game_type='super_lig' and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era) order by q.usage_count asc,random() limit v_room.question_count) picked; end if;
  update public.quiz_questions q set usage_count=q.usage_count+1 where q.id in (select question_id from public.quiz_room_questions where room_id=p_room); v_start:=clock_timestamp()+interval '3 seconds'; insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at) select p_room,1,question_id,v_start,v_start+interval '15 seconds' from public.quiz_room_questions where room_id=p_room and position=1; update public.quiz_rooms set status='playing',current_round=1 where id=p_room; return jsonb_build_object('ok',true,'current_round',1,'starts_at',v_start);
end $function$;

revoke all on function public.quiz_super_lig_create_room_v3(text,text,smallint,bigint[]) from public;
grant execute on function public.quiz_super_lig_create_room_v3(text,text,smallint,bigint[]) to anon,authenticated;
commit;
