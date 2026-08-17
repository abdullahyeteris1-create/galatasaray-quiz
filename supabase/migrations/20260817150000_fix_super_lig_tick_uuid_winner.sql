begin;

create or replace function public.quiz_super_lig_tick(p_room uuid,p_player uuid,p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_ok boolean; v_room public.quiz_rooms%rowtype; v_round public.quiz_rounds%rowtype; v_now timestamptz:=clock_timestamp(); v_next smallint; v_start timestamptz; v_winner uuid;
begin
  select exists(select 1 from public.quiz_players p join public.quiz_rooms r on r.id=p.room_id where p.id=p_player and p.room_id=p_room and p.is_host and r.host_player_id=p.id and r.game_type='super_lig' and p.join_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) into v_ok;
  if not v_ok then raise exception 'HOST_ONLY'; end if;
  select * into v_room from public.quiz_rooms where id=p_room for update;
  if v_room.status<>'playing' then return jsonb_build_object('status',v_room.status,'current_round',v_room.current_round); end if;
  select * into v_round from public.quiz_rounds where room_id=p_room and round_number=v_room.current_round for update;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_now>=v_round.ends_at and v_round.revealed_at is null then
    select case when count(*)=1 then (array_agg(player_id))[1] else null end into v_winner
      from public.quiz_answers a
      where a.round_id=v_round.id and a.is_correct=true
        and a.answered_at=(select min(earliest.answered_at) from public.quiz_answers earliest where earliest.round_id=v_round.id and earliest.is_correct=true);
    update public.quiz_rounds set revealed_at=v_now where id=v_round.id;
    update public.quiz_answers set points_awarded=case when player_id=v_winner then 1 else 0 end where round_id=v_round.id;
    update public.quiz_players p set correct_count=p.correct_count+(select count(*) from public.quiz_answers a where a.round_id=v_round.id and a.player_id=p.id and a.is_correct),score=p.score+case when p.id=v_winner then 1 else 0 end where p.room_id=p_room;
    v_round.revealed_at:=v_now;
  end if;
  if v_round.revealed_at is not null and v_now>=v_round.revealed_at+interval '3 seconds' then
    if v_room.current_round>=v_room.question_count then update public.quiz_rooms set status='finished' where id=p_room; return jsonb_build_object('status','finished','current_round',v_room.current_round); end if;
    v_next:=v_room.current_round+1; v_start:=v_now+interval '2 seconds';
    insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at) select p_room,v_next,question_id,v_start,v_start+interval '15 seconds' from public.quiz_room_questions where room_id=p_room and position=v_next on conflict(room_id,round_number) do nothing;
    update public.quiz_rooms set current_round=v_next where id=p_room;
    return jsonb_build_object('status','playing','current_round',v_next,'starts_at',v_start);
  end if;
  return jsonb_build_object('status','playing','current_round',v_room.current_round,'server_now',v_now);
end $function$;

commit;
