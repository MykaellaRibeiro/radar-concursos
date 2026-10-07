import Link from "next/link";
export default function NotFound() { return <main className="empty-state" style={{ minHeight: "100vh" }}><span className="empty-state__icon numeric">404</span><h1>Página não encontrada</h1><p>O endereço não existe ou o registro ainda não está disponível.</p><Link className="button button--primary" href="/concursos">Ver concursos</Link></main>; }
