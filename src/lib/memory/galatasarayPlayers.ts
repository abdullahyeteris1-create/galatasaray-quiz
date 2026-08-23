export type MemoryPlayer = { id: string; name: string; image: string; era?: string; position?: string };

// Yerel görsel bulunmayan oyuncular PlayerCard tarafından temalı silüetle gösterilir.
export const GALATASARAY_PLAYERS: MemoryPlayer[] = [
  ["hagi","Hagi"],["taffarel","Taffarel"],["jardel","Jardel"],["mondragon","Mondragon"],["hasan-sas","Hasan Şaş"],["ergun-penbe","Ergün Penbe"],["umit-karan","Ümit Karan"],["necati-ates","Necati Ateş"],["arda-turan","Arda Turan"],["baros","Milan Baroš"],["kewell","Harry Kewell"],["keita","Keita"],["elano","Elano"],["muslera","Muslera"],["melo","Melo"],["sneijder","Sneijder"],["drogba","Drogba"],["burak-yilmaz","Burak Yılmaz"],["donk","Donk"],["linnes","Linnes"],["rodrigues","Rodrigues"],["gomis","Gomis"],["onyekuru","Onyekuru"],["torreira","Torreira"],["mertens","Mertens"],["icardi","Icardi"],["dany","Dany Nounkeu"],["capone","Capone"],["filipescu","Filipescu"],["nonda","Nonda"],["linderoth","Linderoth"],["stjepan-tomas","Stjepan Tomas"]
].map(([id, name]) => ({ id, name, image: `/players/${id}.webp` }));

export const CLASSIC_CARD_COUNTS = [12, 20, 30, 40, 48, 60] as const;
