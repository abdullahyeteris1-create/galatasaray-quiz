begin;

alter table public.quiz_rooms
  add column if not exists game_type text not null default 'galatasaray',
  add column if not exists super_lig_era text;

alter table public.quiz_questions
  add column if not exists game_type text not null default 'galatasaray';

do $constraints$
begin
  alter table public.quiz_rooms
    add constraint quiz_rooms_game_type_check
    check (game_type in ('galatasaray', 'super_lig'));
exception when duplicate_object then null;
end $constraints$;

do $constraints$
begin
  alter table public.quiz_rooms
    add constraint quiz_rooms_super_lig_era_check
    check (super_lig_era is null or super_lig_era in ('mixed', '2000s', '2010s', '2020s'));
exception when duplicate_object then null;
end $constraints$;

do $constraints$
begin
  alter table public.quiz_questions
    add constraint quiz_questions_game_type_check
    check (game_type in ('galatasaray', 'super_lig'));
exception when duplicate_object then null;
end $constraints$;

insert into public.quiz_questions (
  game_type, category, difficulty, era, question_text,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select
  'super_lig', 'Oyuncu Kariyeri', 'orta', q.era,
  q.question_text || case when q.duplicate_number > 1 then ' (Varyant ' || q.duplicate_number || ')' else '' end,
  q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, true
from (
  select raw.*, row_number() over (partition by raw.question_text order by raw.era, raw.option_a) as duplicate_number
  from jsonb_to_recordset($questions$[
  {"era":"2000s","question_text":"Hangi futbolcu hem Gençlerbirliği hem Galatasaray forması giymiştir?","option_a":"Ümit Karan","option_b":"Tuncay Şanlı","option_c":"Nihat Kahveci","option_d":"Rüştü Reçber","correct_option":0,"explanation":"Ümit Karan, Gençlerbirliği ve Galatasaray formaları giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Beşiktaş hem Fenerbahçe forması giymiştir?","option_a":"Alex de Souza","option_b":"Tümer Metin","option_c":"Hakan Şükür","option_d":"Bülent Korkmaz","correct_option":1,"explanation":"Tümer Metin iki kulübün de formasını giydi."},
  {"era":"2000s","question_text":"Hangi kaleci hem Fenerbahçe hem Beşiktaş kadrosunda yer almıştır?","option_a":"Rüştü Reçber","option_b":"Volkan Demirel","option_c":"Fernando Muslera","option_d":"Mert Günok","correct_option":0,"explanation":"Rüştü Reçber kariyerinde Fenerbahçe ve Beşiktaş formaları giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Mert Nobre","option_b":"Hakan Balta","option_c":"Arda Turan","option_d":"Gökhan Zan","correct_option":0,"explanation":"Mert Nobre iki İstanbul kulübünde de oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Uğur Boral","option_b":"Sabri Sarıoğlu","option_c":"Selçuk İnan","option_d":"Burak Yılmaz","correct_option":0,"explanation":"Uğur Boral Fenerbahçe ve Beşiktaş kadrolarında yer aldı."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Mehmet Aurelio","option_b":"Hamit Altıntop","option_c":"Emre Mor","option_d":"Sergen Yalçın","correct_option":0,"explanation":"Mehmet Aurelio iki kulüpte de forma giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Trabzonspor forması giymiştir?","option_a":"Serkan Balcı","option_b":"Nihat Kahveci","option_c":"Okan Buruk","option_d":"Emre Aşık","correct_option":0,"explanation":"Serkan Balcı Fenerbahçe ve Trabzonspor formaları giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu Kayserispor ve Trabzonspor formaları giymiştir?","option_a":"Gökhan Ünal","option_b":"Tuncay Şanlı","option_c":"İlhan Mansız","option_d":"Umut Bulut","correct_option":0,"explanation":"Gökhan Ünal bu iki kulübün de formasını giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu kariyerinde Beşiktaş, Fenerbahçe ve Galatasaray forması giymiştir?","option_a":"Burak Yılmaz","option_b":"Alex de Souza","option_c":"Nihat Kahveci","option_d":"Tuncay Şanlı","correct_option":0,"explanation":"Burak Yılmaz üç büyük kulüpte de oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Galatasaray hem Fenerbahçe forması giymiştir?","option_a":"Emre Belözoğlu","option_b":"Bülent Korkmaz","option_c":"İlhan Mansız","option_d":"Uğur Boral","correct_option":0,"explanation":"Emre Belözoğlu iki kulübün de formasını giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Galatasaray forması giymiştir?","option_a":"Colin Kazım Richards","option_b":"Nihat Kahveci","option_c":"Tümer Metin","option_d":"Mert Nobre","correct_option":0,"explanation":"Colin Kazım Richards Fenerbahçe ve Galatasaray’da oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu Süper Lig kariyerinde Beşiktaş ile öne çıkmıştır?","option_a":"Nihat Kahveci","option_b":"Alex de Souza","option_c":"Ümit Karan","option_d":"Serkan Balcı","correct_option":0,"explanation":"Nihat Kahveci Beşiktaş altyapısından yetişip A takımda oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu Fenerbahçe döneminde kaptanlık yapmıştır?","option_a":"Alex de Souza","option_b":"Nihat Kahveci","option_c":"Ümit Karan","option_d":"Gökhan Ünal","correct_option":0,"explanation":"Alex de Souza Fenerbahçe’nin önemli kaptanlarından biriydi."},
  {"era":"2000s","question_text":"Hangi futbolcu Galatasaray’ın 2000’ler kadrosunda forvet olarak yer almıştır?","option_a":"Ümit Karan","option_b":"Tümer Metin","option_c":"Rüştü Reçber","option_d":"Serkan Balcı","correct_option":0,"explanation":"Ümit Karan Galatasaray’da forvet olarak oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu Beşiktaş ile Süper Lig’de forvet olarak tanınmıştır?","option_a":"İlhan Mansız","option_b":"Alex de Souza","option_c":"Mehmet Aurelio","option_d":"Colin Kazım","correct_option":0,"explanation":"İlhan Mansız Beşiktaş’ın tanınan forvetlerindendir."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Beşiktaş hem Trabzonspor forması giymiştir?","option_a":"Burak Yılmaz","option_b":"Nihat Kahveci","option_c":"Alex de Souza","option_d":"Ümit Karan","correct_option":0,"explanation":"Burak Yılmaz iki kulübün de formasını giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu Fenerbahçe’de uzun süre forma giyen Brezilyalı oyuncudur?","option_a":"Alex de Souza","option_b":"Mert Nobre","option_c":"Mehmet Aurelio","option_d":"Tümer Metin","correct_option":0,"explanation":"Alex de Souza Fenerbahçe tarihinin önemli yabancılarındandır."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Galatasaray hem Gençlerbirliği forması giymiştir?","option_a":"Ümit Karan","option_b":"Serkan Balcı","option_c":"Uğur Boral","option_d":"İlhan Mansız","correct_option":0,"explanation":"Ümit Karan bu iki kulübün de formasını giydi."},
  {"era":"2000s","question_text":"Hangi futbolcu hem Fenerbahçe hem Trabzonspor’da kanat oyuncusu olarak oynadı?","option_a":"Volkan Şen","option_b":"Alex de Souza","option_c":"Nihat Kahveci","option_d":"Bülent Korkmaz","correct_option":0,"explanation":"Volkan Şen Fenerbahçe ve Trabzonspor’da oynadı."},
  {"era":"2000s","question_text":"Hangi futbolcu Süper Lig’de Fenerbahçe ve Beşiktaş formaları giymiştir?","option_a":"Tümer Metin","option_b":"Arda Turan","option_c":"Hakan Şükür","option_d":"Umut Bulut","correct_option":0,"explanation":"Tümer Metin iki rakip kulübün formasını da giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Gökhan Gönül","option_b":"Fernando Muslera","option_c":"Bafetimbi Gomis","option_d":"Selçuk İnan","correct_option":0,"explanation":"Gökhan Gönül Fenerbahçe’den sonra Beşiktaş’ta oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Caner Erkin","option_b":"Arda Turan","option_c":"Burak Yılmaz","option_d":"Emre Belözoğlu","correct_option":0,"explanation":"Caner Erkin iki kulübün de formasını giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Beşiktaş hem Fenerbahçe forması giymiştir?","option_a":"İsmail Köybaşı","option_b":"Yasin Öztekin","option_c":"Olcan Adın","option_d":"Eren Derdiyok","correct_option":0,"explanation":"İsmail Köybaşı Beşiktaş ve Fenerbahçe’de oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu Bursaspor ve Fenerbahçe formaları giymiştir?","option_a":"Şener Özbayraklı","option_b":"Sosa","option_c":"Aatif Chahechouhe","option_d":"Cenk Tosun","correct_option":0,"explanation":"Şener Özbayraklı Bursaspor’dan Fenerbahçe’ye geçti."},
  {"era":"2010s","question_text":"Hangi futbolcu Bursaspor, Galatasaray ve Fenerbahçe formaları giymiştir?","option_a":"Serdar Aziz","option_b":"Eren Derdiyok","option_c":"Moussa Sow","option_d":"Tolgay Arslan","correct_option":0,"explanation":"Serdar Aziz bu üç kulübün kadrolarında yer aldı."},
  {"era":"2010s","question_text":"Hangi futbolcu Kasımpaşa ve Galatasaray formaları giymiştir?","option_a":"Eren Derdiyok","option_b":"Sosa","option_c":"Aatif Chahechouhe","option_d":"Mert Günok","correct_option":0,"explanation":"Eren Derdiyok Kasımpaşa ve Galatasaray’da oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu Sivasspor ve Fenerbahçe formaları giymiştir?","option_a":"Aatif Chahechouhe","option_b":"Cenk Tosun","option_c":"Babel","option_d":"Olcan Adın","correct_option":0,"explanation":"Aatif Chahechouhe Sivasspor’dan Fenerbahçe’ye transfer oldu."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Beşiktaş hem Trabzonspor forması giymiştir?","option_a":"Jose Sosa","option_b":"Gökhan Gönül","option_c":"Şener Özbayraklı","option_d":"Mert Günok","correct_option":0,"explanation":"Jose Sosa Beşiktaş ve Trabzonspor’da oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu Fenerbahçe ve Bursaspor formaları giymiştir?","option_a":"Moussa Sow","option_b":"İsmail Köybaşı","option_c":"Yasin Öztekin","option_d":"Emre Akbaba","correct_option":0,"explanation":"Moussa Sow Fenerbahçe ve Bursaspor’da forma giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu Gaziantepspor ve Beşiktaş formaları giymiştir?","option_a":"Cenk Tosun","option_b":"Sosa","option_c":"Babel","option_d":"Volkan Şen","correct_option":0,"explanation":"Cenk Tosun Gaziantepspor’dan Beşiktaş’a transfer oldu."},
  {"era":"2010s","question_text":"Hangi futbolcu Trabzonspor ve Galatasaray formaları giymiştir?","option_a":"Olcan Adın","option_b":"Aatif Chahechouhe","option_c":"Tolgay Arslan","option_d":"Mert Günok","correct_option":0,"explanation":"Olcan Adın Trabzonspor ve Galatasaray’da oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu Trabzonspor ve Galatasaray formaları giymiştir?","option_a":"Yasin Öztekin","option_b":"Gökhan Gönül","option_c":"Sosa","option_d":"Cenk Tosun","correct_option":0,"explanation":"Yasin Öztekin iki kulübün de formasını giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu Alanyaspor ve Galatasaray formaları giymiştir?","option_a":"Emre Akbaba","option_b":"Serdar Aziz","option_c":"Şener Özbayraklı","option_d":"Olcan Adın","correct_option":0,"explanation":"Emre Akbaba Alanyaspor’dan Galatasaray’a transfer oldu."},
  {"era":"2010s","question_text":"Hangi futbolcu Bursaspor, Fenerbahçe ve Trabzonspor formaları giymiştir?","option_a":"Volkan Şen","option_b":"Mert Günok","option_c":"Eren Derdiyok","option_d":"Babel","correct_option":0,"explanation":"Volkan Şen bu üç Süper Lig kulübünde oynadı."},
  {"era":"2010s","question_text":"Hangi kaleci Fenerbahçe ve Başakşehir formaları giymiştir?","option_a":"Mert Günok","option_b":"Rüştü Reçber","option_c":"Volkan Demirel","option_d":"Mert Nobre","correct_option":0,"explanation":"Mert Günok Fenerbahçe ve Başakşehir’de oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Beşiktaş hem Fenerbahçe forması giymiştir?","option_a":"Tolgay Arslan","option_b":"Yasin Öztekin","option_c":"Eren Derdiyok","option_d":"Serdar Aziz","correct_option":0,"explanation":"Tolgay Arslan Beşiktaş ve Fenerbahçe’de oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Fenerbahçe hem Beşiktaş forması giymiştir?","option_a":"Josef de Souza","option_b":"Olcan Adın","option_c":"Aatif Chahechouhe","option_d":"Moussa Sow","correct_option":0,"explanation":"Josef de Souza iki kulübün de formasını giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Beşiktaş hem Galatasaray forması giymiştir?","option_a":"Ryan Babel","option_b":"Gökhan Gönül","option_c":"Sosa","option_d":"Şener Özbayraklı","correct_option":0,"explanation":"Ryan Babel Beşiktaş ve Galatasaray’da oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu Başakşehir ve Fenerbahçe formaları giymiştir?","option_a":"İrfan Can Kahveci","option_b":"Cenk Tosun","option_c":"Mert Günok","option_d":"Caner Erkin","correct_option":0,"explanation":"İrfan Can Kahveci Başakşehir’den Fenerbahçe’ye geçti."},
  {"era":"2010s","question_text":"Hangi futbolcu Sivasspor ve Fenerbahçe formaları giymiştir?","option_a":"Mert Hakan Yandaş","option_b":"Serdar Aziz","option_c":"Emre Akbaba","option_d":"Tolgay Arslan","correct_option":0,"explanation":"Mert Hakan Yandaş Sivasspor ve Fenerbahçe’de oynadı."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Trabzonspor hem Galatasaray forması giymiştir?","option_a":"Olcan Adın","option_b":"Josef de Souza","option_c":"Moussa Sow","option_d":"Cenk Tosun","correct_option":0,"explanation":"Olcan Adın iki kulübün de formasını giydi."},
  {"era":"2010s","question_text":"Hangi futbolcu hem Fenerbahçe hem Başakşehir forması giymiştir?","option_a":"İrfan Can Kahveci","option_b":"Yasin Öztekin","option_c":"Sosa","option_d":"Eren Derdiyok","correct_option":0,"explanation":"İrfan Can Kahveci iki kulüpte de forma giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Başakşehir ve Fenerbahçe formaları giymiştir?","option_a":"İrfan Can Kahveci","option_b":"Fred","option_c":"Dusan Tadic","option_d":"Kerem Aktürkoğlu","correct_option":0,"explanation":"İrfan Can Kahveci Başakşehir ve Fenerbahçe’de oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Sivasspor ve Fenerbahçe formaları giymiştir?","option_a":"Mert Hakan Yandaş","option_b":"Kaan Ayhan","option_c":"Berkan Kutlu","option_d":"Taylan Antalyalı","correct_option":0,"explanation":"Mert Hakan Yandaş iki kulübün de formasını giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Alanyaspor ve Galatasaray formaları giymiştir?","option_a":"Berkan Kutlu","option_b":"Cengiz Ünder","option_c":"Edin Dzeko","option_d":"Fred","correct_option":0,"explanation":"Berkan Kutlu Alanyaspor ve Galatasaray’da oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Sivasspor ve Galatasaray formaları giymiştir?","option_a":"Emre Kılınç","option_b":"Kaan Ayhan","option_c":"Abdülkerim Bardakçı","option_d":"Cengiz Ünder","correct_option":0,"explanation":"Emre Kılınç Sivasspor’dan Galatasaray’a geçti."},
  {"era":"2020s","question_text":"Hangi futbolcu Galatasaray ve Samsunspor formaları giymiştir?","option_a":"Taylan Antalyalı","option_b":"Kerem Aktürkoğlu","option_c":"Berkan Kutlu","option_d":"İrfan Can Kahveci","correct_option":0,"explanation":"Taylan Antalyalı Galatasaray ve Samsunspor’da oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Konyaspor ve Galatasaray formaları giymiştir?","option_a":"Abdülkerim Bardakçı","option_b":"Fred","option_c":"Dusan Tadic","option_d":"Edin Dzeko","correct_option":0,"explanation":"Abdülkerim Bardakçı Konyaspor’dan Galatasaray’a transfer oldu."},
  {"era":"2020s","question_text":"Hangi futbolcu Fenerbahçe ve Galatasaray formaları giymiştir?","option_a":"Michy Batshuayi","option_b":"Kaan Ayhan","option_c":"Cengiz Ünder","option_d":"Kerem Aktürkoğlu","correct_option":0,"explanation":"Michy Batshuayi Fenerbahçe ve Galatasaray’da oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Beşiktaş, Fenerbahçe ve Galatasaray formaları giymiştir?","option_a":"Michy Batshuayi","option_b":"Fred","option_c":"Edin Dzeko","option_d":"İrfan Can Kahveci","correct_option":0,"explanation":"Michy Batshuayi üç büyük kulübün de formasını giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Sassuolo ve Galatasaray formaları giymiştir?","option_a":"Kaan Ayhan","option_b":"Berkan Kutlu","option_c":"Mert Hakan Yandaş","option_d":"Emre Kılınç","correct_option":0,"explanation":"Kaan Ayhan Galatasaray’a Sassuolo’dan geldi."},
  {"era":"2020s","question_text":"Hangi futbolcu Fenerbahçe’de 2020’ler döneminde forma giymiştir?","option_a":"Fred","option_b":"Kerem Aktürkoğlu","option_c":"Abdülkerim Bardakçı","option_d":"Emre Kılınç","correct_option":0,"explanation":"Fred 2020’ler döneminde Fenerbahçe’de oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Fenerbahçe’de 2020’ler döneminde forma giymiştir?","option_a":"Dusan Tadic","option_b":"Kaan Ayhan","option_c":"Taylan Antalyalı","option_d":"Berkan Kutlu","correct_option":0,"explanation":"Dusan Tadic Fenerbahçe’de forma giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Fenerbahçe’de 2020’ler döneminde forvet olarak oynadı?","option_a":"Edin Dzeko","option_b":"Emre Kılınç","option_c":"Kerem Aktürkoğlu","option_d":"Abdülkerim Bardakçı","correct_option":0,"explanation":"Edin Dzeko Fenerbahçe’nin 2020’ler forvetlerinden oldu."},
  {"era":"2020s","question_text":"Hangi futbolcu Galatasaray’da 2020’ler döneminde forma giymiştir?","option_a":"Kerem Aktürkoğlu","option_b":"Fred","option_c":"Dusan Tadic","option_d":"Edin Dzeko","correct_option":0,"explanation":"Kerem Aktürkoğlu Galatasaray’da oynadı."},
  {"era":"2020s","question_text":"Hangi futbolcu Kayserispor ve Beşiktaş formaları giymiştir?","option_a":"Onur Bulut","option_b":"Kaan Ayhan","option_c":"Cengiz Ünder","option_d":"Emre Kılınç","correct_option":0,"explanation":"Onur Bulut Kayserispor’dan Beşiktaş’a transfer oldu."},
  {"era":"2020s","question_text":"Hangi futbolcu Başakşehir ve Fenerbahçe formaları giymiştir?","option_a":"Berkay Özcan","option_b":"Berkan Kutlu","option_c":"Taylan Antalyalı","option_d":"Kaan Ayhan","correct_option":0,"explanation":"Berkay Özcan Başakşehir ve Fenerbahçe’de forma giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Fenerbahçe ve Galatasaray formaları giymiştir?","option_a":"Michy Batshuayi","option_b":"Cengiz Ünder","option_c":"Fred","option_d":"Dusan Tadic","correct_option":0,"explanation":"Michy Batshuayi iki kulübün de formasını giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Galatasaray ve Alanyaspor formaları giymiştir?","option_a":"Berkan Kutlu","option_b":"Edin Dzeko","option_c":"Fred","option_d":"Onur Bulut","correct_option":0,"explanation":"Berkan Kutlu iki kulübün de formasını giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Sivasspor ve Fenerbahçe formaları giymiştir?","option_a":"Mert Hakan Yandaş","option_b":"Kerem Aktürkoğlu","option_c":"Kaan Ayhan","option_d":"Berkay Özcan","correct_option":0,"explanation":"Mert Hakan Yandaş bu iki kulübün formasını giydi."},
  {"era":"2020s","question_text":"Hangi futbolcu Galatasaray ve Konyaspor formaları giymiştir?","option_a":"Abdülkerim Bardakçı","option_b":"Dusan Tadic","option_c":"Fred","option_d":"Cengiz Ünder","correct_option":0,"explanation":"Abdülkerim Bardakçı iki kulübün de formasını giydi."}
]$questions$::jsonb) as raw(
  era text, question_text text, option_a text, option_b text, option_c text, option_d text,
  correct_option smallint, explanation text
) q
where not exists (
  select 1 from public.quiz_questions existing where existing.question_text = q.question_text || case when q.duplicate_number > 1 then ' (Varyant ' || q.duplicate_number || ')' else '' end
);

-- Keep the existing Galatasaray RPC behavior unchanged while preventing the
-- new Super Lig rows from entering a Galatasaray room's question pool.
create or replace function public.quiz_start_game(p_room uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_players integer; v_available integer; v_start timestamptz;
begin
  select * into v_room from public.quiz_rooms where id=p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select count(*) into v_players from public.quiz_players where room_id=p_room;
  if v_players < 2 then raise exception 'NEED_AT_LEAST_2_PLAYERS'; end if;
  select count(*) into v_available from public.quiz_questions where active=true and game_type='galatasaray';
  if v_available < v_room.question_count then raise exception 'NOT_ENOUGH_QUESTIONS'; end if;
  delete from public.quiz_answers a using public.quiz_rounds r where a.round_id=r.id and r.room_id=p_room;
  delete from public.quiz_rounds where room_id=p_room;
  delete from public.quiz_room_questions where room_id=p_room;
  update public.quiz_players set score=0,correct_count=0 where room_id=p_room;
  insert into public.quiz_room_questions(room_id,position,question_id)
  select p_room,row_number() over ()::smallint,id from (
    select q.id from public.quiz_questions q where q.active=true and q.game_type='galatasaray'
    order by q.usage_count asc,random() limit v_room.question_count
  ) picked;
  update public.quiz_questions q set usage_count=q.usage_count+1 where q.id in (select question_id from public.quiz_room_questions where room_id=p_room);
  v_start:=clock_timestamp()+interval '3 seconds';
  insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at)
    select p_room,1,question_id,v_start,v_start+interval '15 seconds' from public.quiz_room_questions where room_id=p_room and position=1;
  update public.quiz_rooms set status='playing',current_round=1 where id=p_room;
  return jsonb_build_object('ok',true,'current_round',1,'starts_at',v_start);
end $function$;

create or replace function public.quiz_super_lig_create_room(
  p_name text,
  p_era text default 'mixed',
  p_question_count smallint default 10
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room uuid; v_player uuid; v_code text; v_token text; v_try int := 0;
begin
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 24 then raise exception 'INVALID_NAME'; end if;
  if p_era not in ('mixed','2000s','2010s','2020s') then raise exception 'INVALID_ERA'; end if;
  if p_question_count not in (10,15,20) then raise exception 'INVALID_QUESTION_COUNT'; end if;
  loop
    v_try := v_try + 1;
    v_code := upper(substr(md5(pg_catalog.gen_random_uuid()::text),1,6));
    begin
      insert into public.quiz_rooms(code,status,max_players,question_count,game_type,super_lig_era)
      values(v_code,'waiting',2,p_question_count,'super_lig',p_era) returning id into v_room;
      exit;
    exception when unique_violation then if v_try >= 10 then raise; end if; end;
  end loop;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.quiz_players(room_id,display_name,join_token_hash,is_host)
  values(v_room,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),true) returning id into v_player;
  update public.quiz_rooms set host_player_id=v_player where id=v_room;
  return jsonb_build_object('room_id',v_room,'code',v_code,'player_id',v_player,'token',v_token);
end $function$;

create or replace function public.quiz_super_lig_join_room(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_count int; v_player uuid; v_token text;
begin
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 24 then raise exception 'INVALID_NAME'; end if;
  select * into v_room from public.quiz_rooms where code=upper(trim(p_code)) and game_type='super_lig' for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_ALREADY_STARTED'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select count(*) into v_count from public.quiz_players where room_id=v_room.id;
  if v_count >= 2 then raise exception 'ROOM_FULL'; end if;
  if exists(select 1 from public.quiz_players where room_id=v_room.id and lower(display_name)=lower(trim(p_name))) then raise exception 'NAME_TAKEN'; end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.quiz_players(room_id,display_name,join_token_hash,is_host)
  values(v_room.id,trim(p_name),encode(extensions.digest(v_token,'sha256'),'hex'),false) returning id into v_player;
  return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'player_id',v_player,'token',v_token);
end $function$;

create or replace function public.quiz_super_lig_start_game(p_room uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_players integer; v_available integer; v_start timestamptz;
begin
  select * into v_room from public.quiz_rooms where id=p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.game_type <> 'super_lig' then raise exception 'WRONG_GAME_TYPE'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select count(*) into v_players from public.quiz_players where room_id=p_room;
  if v_players <> 2 then raise exception 'NEED_EXACTLY_2_PLAYERS'; end if;
  select count(*) into v_available from public.quiz_questions where active=true and game_type='super_lig'
    and (v_room.super_lig_era='mixed' or era=v_room.super_lig_era);
  if v_available < v_room.question_count then raise exception 'NOT_ENOUGH_QUESTIONS'; end if;
  delete from public.quiz_answers a using public.quiz_rounds r where a.round_id=r.id and r.room_id=p_room;
  delete from public.quiz_rounds where room_id=p_room;
  delete from public.quiz_room_questions where room_id=p_room;
  update public.quiz_players set score=0,correct_count=0 where room_id=p_room;
  insert into public.quiz_room_questions(room_id,position,question_id)
  select p_room,row_number() over ()::smallint,id from (
    select q.id from public.quiz_questions q where q.active=true and q.game_type='super_lig'
      and (v_room.super_lig_era='mixed' or q.era=v_room.super_lig_era)
    order by q.usage_count asc, random() limit v_room.question_count
  ) picked;
  update public.quiz_questions q set usage_count=q.usage_count+1
    where q.id in (select question_id from public.quiz_room_questions where room_id=p_room);
  v_start := clock_timestamp()+interval '3 seconds';
  insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at)
    select p_room,1,question_id,v_start,v_start+interval '15 seconds'
    from public.quiz_room_questions where room_id=p_room and position=1;
  update public.quiz_rooms set status='playing',current_round=1 where id=p_room;
  return jsonb_build_object('ok',true,'current_round',1,'starts_at',v_start);
end $function$;

create or replace function public.quiz_super_lig_host_start(p_room uuid,p_player uuid,p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_ok boolean;
begin
  select exists(select 1 from public.quiz_players p join public.quiz_rooms r on r.id=p.room_id where p.id=p_player and p.room_id=p_room and p.is_host and r.host_player_id=p.id and r.game_type='super_lig' and p.join_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) into v_ok;
  if not v_ok then raise exception 'HOST_ONLY'; end if;
  return public.quiz_super_lig_start_game(p_room);
end $function$;

create or replace function public.quiz_super_lig_player_answer(p_room uuid,p_round uuid,p_player uuid,p_token text,p_selected smallint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_round public.quiz_rounds%rowtype; v_question public.quiz_questions%rowtype; v_now timestamptz:=clock_timestamp(); v_ms integer; v_correct boolean;
begin
  if not exists(select 1 from public.quiz_players where id=p_player and room_id=p_room and join_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  select * into v_round from public.quiz_rounds where id=p_round and room_id=p_room for update;
  if not found then raise exception 'ROUND_NOT_IN_ROOM'; end if;
  if v_now<v_round.starts_at then raise exception 'ROUND_NOT_STARTED'; end if;
  if v_now>=v_round.ends_at then raise exception 'ROUND_CLOSED'; end if;
  if p_selected<0 or p_selected>3 then raise exception 'INVALID_OPTION'; end if;
  select * into v_question from public.quiz_questions where id=v_round.question_id;
  v_ms:=greatest(0,least(15000,floor(extract(epoch from (v_now-v_round.starts_at))*1000)::integer));
  v_correct:=(p_selected=v_question.correct_option);
  insert into public.quiz_answers(round_id,player_id,selected_option,answered_at,response_ms,is_correct,points_awarded)
    values(p_round,p_player,p_selected,v_now,v_ms,v_correct,0);
  update public.quiz_players set last_seen_at=v_now where id=p_player;
  return jsonb_build_object('accepted',true);
exception when unique_violation then raise exception 'ALREADY_ANSWERED';
end $function$;

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
    select case when count(*) = 1 then min(player_id) else null end into v_winner
      from public.quiz_answers a
      where a.round_id=v_round.id and a.is_correct=true
        and a.answered_at = (select min(earliest.answered_at) from public.quiz_answers earliest where earliest.round_id=v_round.id and earliest.is_correct=true);
    update public.quiz_rounds set revealed_at=v_now where id=v_round.id;
    update public.quiz_answers set points_awarded=case when player_id=v_winner then 1 else 0 end where round_id=v_round.id;
    update public.quiz_players p set correct_count=p.correct_count+(select count(*) from public.quiz_answers a where a.round_id=v_round.id and a.player_id=p.id and a.is_correct), score=p.score+case when p.id=v_winner then 1 else 0 end where p.room_id=p_room;
    v_round.revealed_at:=v_now;
  end if;
  if v_round.revealed_at is not null and v_now>=v_round.revealed_at+interval '3 seconds' then
    if v_room.current_round>=v_room.question_count then
      update public.quiz_rooms set status='finished' where id=p_room;
      return jsonb_build_object('status','finished','current_round',v_room.current_round);
    end if;
    v_next:=v_room.current_round+1; v_start:=v_now+interval '2 seconds';
    insert into public.quiz_rounds(room_id,round_number,question_id,starts_at,ends_at)
      select p_room,v_next,question_id,v_start,v_start+interval '15 seconds' from public.quiz_room_questions where room_id=p_room and position=v_next on conflict (room_id,round_number) do nothing;
    update public.quiz_rooms set current_round=v_next where id=p_room;
    return jsonb_build_object('status','playing','current_round',v_next,'starts_at',v_start);
  end if;
  return jsonb_build_object('status','playing','current_round',v_room.current_round,'server_now',v_now);
end $function$;

create or replace function public.quiz_super_lig_get_state(p_room uuid,p_player uuid,p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_room public.quiz_rooms%rowtype; v_round public.quiz_rounds%rowtype; v_q public.quiz_questions%rowtype; v_players jsonb; v_payload jsonb; v_valid boolean; v_answered boolean; v_answers jsonb;
begin
  select exists(select 1 from public.quiz_players where id=p_player and room_id=p_room and join_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) into v_valid;
  if not v_valid then raise exception 'UNAUTHORIZED_PLAYER'; end if;
  update public.quiz_players set last_seen_at=clock_timestamp() where id=p_player;
  select * into v_room from public.quiz_rooms where id=p_room and game_type='super_lig';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'score',score,'correct',correct_count,'is_host',is_host) order by joined_at),'[]'::jsonb) into v_players from public.quiz_players where room_id=p_room;
  v_payload:=jsonb_build_object('server_now',clock_timestamp(),'room',jsonb_build_object('id',v_room.id,'code',v_room.code,'status',v_room.status,'max_players',v_room.max_players,'question_count',v_room.question_count,'current_round',v_room.current_round,'host_player_id',v_room.host_player_id,'game_type',v_room.game_type,'era',v_room.super_lig_era),'players',v_players);
  if v_room.status='playing' and v_room.current_round>0 then
    select * into v_round from public.quiz_rounds where room_id=p_room and round_number=v_room.current_round;
    select * into v_q from public.quiz_questions where id=v_round.question_id;
    select exists(select 1 from public.quiz_answers where round_id=v_round.id and player_id=p_player) into v_answered;
    v_payload:=v_payload||jsonb_build_object('round',jsonb_build_object('id',v_round.id,'number',v_round.round_number,'starts_at',v_round.starts_at,'ends_at',v_round.ends_at,'revealed_at',v_round.revealed_at,'answered',v_answered,'category',v_q.category,'difficulty',v_q.difficulty,'question',v_q.question_text,'options',jsonb_build_array(v_q.option_a,v_q.option_b,v_q.option_c,v_q.option_d)));
    if v_round.revealed_at is not null then
      select coalesce(jsonb_agg(jsonb_build_object('player_id',a.player_id,'selected_option',a.selected_option,'response_ms',a.response_ms,'is_correct',a.is_correct,'points_awarded',a.points_awarded) order by a.answered_at,a.id),'[]'::jsonb) into v_answers from public.quiz_answers a where a.round_id=v_round.id;
      v_payload:=v_payload||jsonb_build_object('reveal',jsonb_build_object('correct_option',v_q.correct_option,'explanation',v_q.explanation,'answers',v_answers,'winner_id',(select a.player_id from public.quiz_answers a where a.round_id=v_round.id and a.points_awarded=1 limit 1)));
    end if;
  end if;
  return v_payload;
end $function$;

revoke all on function public.quiz_super_lig_create_room(text,text,smallint) from public;
revoke all on function public.quiz_super_lig_join_room(text,text) from public;
revoke all on function public.quiz_super_lig_start_game(uuid) from public;
revoke all on function public.quiz_super_lig_host_start(uuid,uuid,text) from public;
revoke all on function public.quiz_super_lig_player_answer(uuid,uuid,uuid,text,smallint) from public;
revoke all on function public.quiz_super_lig_tick(uuid,uuid,text) from public;
revoke all on function public.quiz_super_lig_get_state(uuid,uuid,text) from public;
grant execute on function public.quiz_super_lig_create_room(text,text,smallint) to anon, authenticated;
grant execute on function public.quiz_super_lig_join_room(text,text) to anon, authenticated;
grant execute on function public.quiz_super_lig_host_start(uuid,uuid,text) to anon, authenticated;
grant execute on function public.quiz_super_lig_player_answer(uuid,uuid,uuid,text,smallint) to anon, authenticated;
grant execute on function public.quiz_super_lig_tick(uuid,uuid,text) to anon, authenticated;
grant execute on function public.quiz_super_lig_get_state(uuid,uuid,text) to anon, authenticated;

commit;
