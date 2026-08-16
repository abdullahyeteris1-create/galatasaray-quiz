import { ActionButton, ArenaShell, BrandMark } from "./primitives";

type HomeScreenProps = {
  onCreate: () => void;
  onJoin: () => void;
};

export function HomeScreen({ onCreate, onJoin }: HomeScreenProps) {
  return (
    <ArenaShell>
      <div className="home-screen">
        <div className="home-topline">
          <span>CANLI QUIZ</span>
          <span className="live-dot" aria-hidden="true" />
          <span>MULTIPLAYER</span>
        </div>

        <div className="home-hero">
          <BrandMark />
          <p className="home-kicker">1905&apos;TEN BUGÜNE</p>
          <h1>Galatasaray<br /><span>Tarih Arenası</span></h1>
          <p className="home-copy">
            Arkadaşlarınla aynı anda yarış. Galatasaray tarihini gerçekten kim daha iyi biliyor?
          </p>
        </div>

        <div className="home-actions">
          <ActionButton onClick={onCreate}>
            <span>Oda Oluştur</span><span aria-hidden="true">→</span>
          </ActionButton>
          <ActionButton tone="ghost" onClick={onJoin}>
            <span>Odaya Katıl</span><span aria-hidden="true">⌁</span>
          </ActionButton>
        </div>

        <p className="home-footnote">Sarı-kırmızı tarih, tek bir şampiyon.</p>
      </div>
    </ArenaShell>
  );
}

