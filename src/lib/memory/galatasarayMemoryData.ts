export type MemoryCategory =
  | "player-season"
  | "player-club"
  | "player-position"
  | "european-history";

export type MemoryPair = {
  id: string;
  category: MemoryCategory;
  left: string;
  right: string;
};

// Kaynak oyundaki emoji havuzu yerine doğrulanabilir Galatasaray tarihi eşleşmeleri.
export const GALATASARAY_MEMORY_DATA: MemoryPair[] = [
  { id: "season-hagi", category: "player-season", left: "Hagi", right: "1996-97" },
  { id: "season-taffarel", category: "player-season", left: "Taffarel", right: "1998-99" },
  { id: "season-jardel", category: "player-season", left: "Jardel", right: "2000-01" },
  { id: "season-muslera", category: "player-season", left: "Muslera", right: "2011-12" },
  { id: "season-sneijder", category: "player-season", left: "Sneijder", right: "2012-13" },
  { id: "season-drogba", category: "player-season", left: "Drogba", right: "2012-13" },
  { id: "season-icardi", category: "player-season", left: "Icardi", right: "2022-23" },
  { id: "season-capone", category: "player-season", left: "Capone", right: "1999-00" },
  { id: "season-filipescu", category: "player-season", left: "Filipescu", right: "1996-97" },
  { id: "season-nonda", category: "player-season", left: "Nonda", right: "2007-08" },
  { id: "season-keita", category: "player-season", left: "Keita", right: "2009-10" },
  { id: "season-linnes", category: "player-season", left: "Linnes", right: "2015-16" },
  { id: "season-dany", category: "player-season", left: "Dany Nounkeu", right: "2012-13" },
  { id: "season-donk", category: "player-season", left: "Donk", right: "2017-18" },
  { id: "season-riera", category: "player-season", left: "Riera", right: "2011-12" },

  { id: "club-muslera", category: "player-club", left: "Muslera", right: "Lazio" },
  { id: "club-sneijder", category: "player-club", left: "Sneijder", right: "Inter" },
  { id: "club-drogba", category: "player-club", left: "Drogba", right: "Shanghai Shenhua" },
  { id: "club-icardi", category: "player-club", left: "Icardi", right: "PSG" },
  { id: "club-hagi", category: "player-club", left: "Hagi", right: "Brescia" },
  { id: "club-taffarel", category: "player-club", left: "Taffarel", right: "Parma" },
  { id: "club-jardel", category: "player-club", left: "Jardel", right: "Porto" },
  { id: "club-joao-batista", category: "player-club", left: "João Batista", right: "Flamengo" },
  { id: "club-carrusca", category: "player-club", left: "Carrusca", right: "Estudiantes" },
  { id: "club-elano", category: "player-club", left: "Elano", right: "Manchester City" },
  { id: "club-culio", category: "player-club", left: "Culio", right: "Deportivo La Coruña" },
  { id: "club-rodrigues", category: "player-club", left: "Rodrigues", right: "PAOK" },
  { id: "club-donk", category: "player-club", left: "Donk", right: "Kasimpasa" },
  { id: "club-riera", category: "player-club", left: "Riera", right: "Olympiacos" },
  { id: "club-linderoth", category: "player-club", left: "Linderoth", right: "FC Copenhagen" },

  { id: "position-muslera", category: "player-position", left: "Muslera", right: "Kaleci" },
  { id: "position-taffarel", category: "player-position", left: "Taffarel", right: "Kaleci" },
  { id: "position-capone", category: "player-position", left: "Capone", right: "Defans" },
  { id: "position-filipescu", category: "player-position", left: "Filipescu", right: "Defans" },
  { id: "position-tomas", category: "player-position", left: "Stjepan Tomas", right: "Defans" },
  { id: "position-neill", category: "player-position", left: "Lucas Neill", right: "Defans" },
  { id: "position-linnes", category: "player-position", left: "Linnes", right: "Defans" },
  { id: "position-linderoth", category: "player-position", left: "Linderoth", right: "Orta saha" },
  { id: "position-keita", category: "player-position", left: "Keita", right: "Orta saha" },
  { id: "position-elano", category: "player-position", left: "Elano", right: "Orta saha" },
  { id: "position-hagi", category: "player-position", left: "Hagi", right: "Orta saha" },
  { id: "position-nonda", category: "player-position", left: "Nonda", right: "Forvet" },
  { id: "position-dany", category: "player-position", left: "Dany Nounkeu", right: "Defans" },
  { id: "position-donk", category: "player-position", left: "Donk", right: "Orta saha" },
  { id: "position-rodrigues", category: "player-position", left: "Rodrigues", right: "Forvet" },

  { id: "europe-uefa", category: "european-history", left: "2000 UEFA Kupası", right: "Arsenal" },
  { id: "europe-super-cup", category: "european-history", left: "2000 Süper Kupa", right: "Real Madrid" },
  { id: "europe-quarter", category: "european-history", left: "2012-13 ŞL Çeyrek Final", right: "Real Madrid" },
  { id: "europe-monaco", category: "european-history", left: "2000 UEFA Kupası finali", right: "Kopenhag" },
  { id: "europe-dortmund", category: "european-history", left: "1997-98 ŞL grubu", right: "Borussia Dortmund" },
  { id: "europe-milan", category: "european-history", left: "1999-00 ŞL grubu", right: "Milan" },
  { id: "europe-real-2013", category: "european-history", left: "2013 ŞL çeyrek finali", right: "Real Madrid" },
  { id: "europe-juventus", category: "european-history", left: "2013-14 ŞL grubu", right: "Juventus" },
  { id: "europe-benfica", category: "european-history", left: "2015-16 ŞL grubu", right: "Benfica" },
  { id: "europe-schalke", category: "european-history", left: "2012-13 ŞL son 16", right: "Schalke 04" },
  { id: "europe-arsenal-2000", category: "european-history", left: "2000 UEFA finali", right: "Arsenal" },
  { id: "europe-bordeaux", category: "european-history", left: "2008-09 UEFA Kupası", right: "Bordeaux" },
  { id: "europe-psv", category: "european-history", left: "2001-02 ŞL grubu", right: "PSV Eindhoven" },
  { id: "europe-barcelona", category: "european-history", left: "2002-03 ŞL grubu", right: "Barcelona" },
  { id: "europe-atletico", category: "european-history", left: "2018 UEFA Avrupa Ligi", right: "Atletico Madrid" },
];

export const MEMORY_CATEGORIES = [
  { id: "player-season", label: "Oyuncu–Sezon" },
  { id: "player-club", label: "Oyuncu–Kulüp" },
  { id: "player-position", label: "Oyuncu–Mevki" },
  { id: "european-history", label: "Avrupa tarihi" },
  { id: "mixed", label: "Karışık" },
] as const;
