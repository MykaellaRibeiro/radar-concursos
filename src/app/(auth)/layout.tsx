import { Logo } from "@/components/layout/logo";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-form-side"><Logo />{children}</section>
      <aside className="auth-visual" aria-label="Sobre o Radar Concursos"><div className="auth-visual__copy"><div className="auth-signal"><i />Uma visão contínua do que está mudando</div><h2>Fontes dispersas.<br />Um só radar.</h2><p>Acompanhe concursos, preserve o histórico de cada movimentação e entenda o que merece sua atenção.</p></div></aside>
    </main>
  );
}
