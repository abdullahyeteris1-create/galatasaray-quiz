begin;

insert into public.quiz_questions (
  game_type, category, difficulty, era, question_text,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
values
 ('super_lig','Kulüp Tarihi','orta','2000s','2000''lerde Süper Lig şampiyonu olan kulüp hangisidir?','Galatasaray','Bursaspor','Sivasspor','Kasımpaşa',0,'Galatasaray 2000''lerde birden fazla şampiyonluk kazandı.',true),
 ('super_lig','Kulüp Tarihi','orta','2000s','2000''lerde Süper Lig şampiyonu olan Anadolu kulübü hangisidir?','Bursaspor','Konyaspor','Alanyaspor','Rizespor',0,'Bursaspor 2009-10 sezonunda şampiyon oldu.',true),
 ('super_lig','Kulüp Tarihi','orta','2000s','2000''lerde Beşiktaş ile lig şampiyonluğu yaşayan teknik direktör kimdir?','Mustafa Denizli','Ersun Yanal','Bülent Uygun','Rıza Çalımbay',0,'Mustafa Denizli Beşiktaş ile 2008-09 sezonunda şampiyon oldu.',true),
 ('super_lig','Kulüp Tarihi','orta','2000s','2000''lerde Fenerbahçe ile lig şampiyonluğu yaşayan teknik direktör kimdir?','Christoph Daum','Şenol Güneş','Fatih Terim','Samet Aybaba',0,'Christoph Daum Fenerbahçe ile şampiyonluk kazandı.',true),
 ('super_lig','Kulüp Tarihi','orta','2020s','2020''lerde Süper Lig şampiyonluğu kazanan kulüp hangisidir?','Galatasaray','Sivasspor','Kasımpaşa','Gençlerbirliği',0,'Galatasaray 2020''lerde lig şampiyonlukları kazandı.',true),
 ('super_lig','Kulüp Tarihi','orta','2020s','2020''lerde Fenerbahçe forması giyen Brezilyalı orta saha kimdir?','Fred','Talisca','Alex de Souza','Mehmet Aurelio',0,'Fred Fenerbahçe kadrosunda forma giydi.',true),
 ('super_lig','Kulüp Tarihi','orta','2020s','2020''lerde Beşiktaş forması giyen İngiliz forvet kimdir?','Dele Alli','Cenk Tosun','Nihat Kahveci','Vincent Aboubakar',0,'Dele Alli Beşiktaş''ta forma giydi.',true)
on conflict (question_text) do nothing;

commit;
