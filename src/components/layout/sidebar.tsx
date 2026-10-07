"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Logo } from "./logo";
import { navItems } from "./nav-items";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar__top"><Logo /></div>
      <nav aria-label="Navegação principal" className="sidebar__nav">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/concursos" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("nav-link", active && "nav-link--active")}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>
      <div className="sidebar__signal"><span className="signal-dot" /><div><strong>Base estruturada</strong><span>Fontes e histórico</span></div></div>
    </aside>
  );
}
