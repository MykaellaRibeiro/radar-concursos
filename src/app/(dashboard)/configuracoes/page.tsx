import { signOut } from "@/features/auth/actions";
export const metadata = { title: "Configurações", robots: { index: false, follow: false } };
export default function Page() { return <><header className="page-header"><div><h1>Configurações</h1><p>Gerencie sua sessão e, futuramente, preferências de notificação.</p></div></header><section className="panel" style={{ padding: 24 }}><h2 className="section-title">Sessão</h2><form action={signOut}><button className="button button--secondary" type="submit">Sair da conta</button></form></section></>; }
