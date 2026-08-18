begin;

do $$
declare
  target_count integer;
  broken_count integer;
begin
  select count(*)
  into target_count
  from public.quiz_questions
  where game_type = 'super_lig'
    and id between 563 and 595;

  if target_count <> 33 then
    raise exception 'Expected 33 Super Lig questions with IDs 563-595, found %', target_count;
  end if;

  if exists (
    select 1
    from public.quiz_questions
    where game_type = 'super_lig'
      and id between 563 and 595
      and correct_option <> 0
  ) then
    raise exception 'Correct option integrity check failed for Super Lig questions 563-595';
  end if;

  select count(*)
  into broken_count
  from public.quiz_questions
  where game_type = 'super_lig'
    and id between 563 and 595
    and (
      position(chr(195) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
      or position(chr(196) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
      or position(chr(197) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
      or position(chr(226) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
      or position(chr(65533) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
    );

  if broken_count not in (0, 33) then
    raise exception 'Expected either 0 or 33 mojibake rows in Super Lig questions 563-595, found %', broken_count;
  end if;
end
$$;

create or replace function pg_temp.repair_utf8_mojibake(value text)
returns text
language sql
immutable
strict
as $$
  select convert_from(
    convert_to(
      replace(
        replace(
          replace(
            replace(value, chr(8364), chr(128)),
            chr(8482), chr(153)
          ),
          chr(339), chr(156)
        ),
        chr(376), chr(159)
      ),
      'LATIN1'
    ),
    'UTF8'
  );
$$;

update public.quiz_questions
set
  category = pg_temp.repair_utf8_mojibake(category),
  difficulty = pg_temp.repair_utf8_mojibake(difficulty),
  era = pg_temp.repair_utf8_mojibake(era),
  subject_player = pg_temp.repair_utf8_mojibake(subject_player),
  question_text = pg_temp.repair_utf8_mojibake(question_text),
  option_a = pg_temp.repair_utf8_mojibake(option_a),
  option_b = pg_temp.repair_utf8_mojibake(option_b),
  option_c = pg_temp.repair_utf8_mojibake(option_c),
  option_d = pg_temp.repair_utf8_mojibake(option_d),
  explanation = pg_temp.repair_utf8_mojibake(explanation)
where game_type = 'super_lig'
  and id between 563 and 595
  and (
    position(chr(195) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
    or position(chr(196) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
    or position(chr(197) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
    or position(chr(226) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
    or position(chr(65533) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
  );

do $$
begin
  if exists (
    select 1
    from public.quiz_questions
    where game_type = 'super_lig'
      and id between 563 and 595
      and (
        position(chr(195) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
        or position(chr(196) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
        or position(chr(197) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
        or position(chr(226) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
        or position(chr(65533) in concat_ws(E'\n', category, difficulty, era, subject_player, question_text, option_a, option_b, option_c, option_d, explanation)) > 0
      )
  ) then
    raise exception 'Mojibake remains in Super Lig questions 563-595';
  end if;
end
$$;

commit;
