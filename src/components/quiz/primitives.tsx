import type { ButtonHTMLAttributes, ReactNode } from "react";

type ArenaShellProps = {
  children: ReactNode;
  compact?: boolean;
};

export function ArenaShell({ children, compact = false }: ArenaShellProps) {
  return (
    <main className="arena-shell">
      <div className="arena-glow arena-glow-yellow" aria-hidden="true" />
      <div className="arena-glow arena-glow-red" aria-hidden="true" />
      <section className={`arena-phone ${compact ? "arena-phone-compact" : ""}`}>
        {children}
      </section>
    </main>
  );
}

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-mark ${small ? "brand-mark-small" : ""}`} aria-label="Galatasaray Tarih Arenası">
      <span className="brand-g" aria-hidden="true">G</span>
      <span className="brand-s" aria-hidden="true">S</span>
      <span className="brand-year" aria-hidden="true">1905</span>
    </div>
  );
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "yellow" | "red" | "ghost";
  full?: boolean;
};

export function ActionButton({
  tone = "yellow",
  full = true,
  className = "",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-button-${tone} ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack?: () => void;
}) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button className="back-button" type="button" onClick={onBack} aria-label="Geri dön">
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        <BrandMark small />
      )}
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="screen-title">{title}</h1>
      </div>
    </header>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="notice notice-error" role="alert" aria-live="assertive">
      <span aria-hidden="true">!</span>
      <p>{message}</p>
    </div>
  );
}

export function LoadingScreen({ label = "Arena hazırlanıyor…" }: { label?: string }) {
  return (
    <ArenaShell>
      <div className="loading-screen" role="status" aria-live="polite">
        <BrandMark />
        <div className="loading-dots" aria-hidden="true"><i /><i /><i /></div>
        <p>{label}</p>
      </div>
    </ArenaShell>
  );
}

