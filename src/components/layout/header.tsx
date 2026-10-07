import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";

export function Header({ userName = "Visitante" }: { userName?: string }) {
  return (
    <header className="app-header">
      <MobileNav />
      <form className="global-search" action="/concursos" role="search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-search">Buscar concursos, órgãos, cargos ou cidades</label>
        <input id="global-search" name="q" placeholder="Buscar concursos, órgãos, cargos ou cidades" />
      </form>
      <div className="header-actions">
        <Link href="/alertas" className="icon-button" aria-label="Abrir alertas e notificações"><Bell size={20} /></Link>
        <div className="user-chip"><span className="avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span><span>{userName}</span></div>
      </div>
    </header>
  );
}
