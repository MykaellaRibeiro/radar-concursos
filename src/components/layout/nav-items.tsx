import { BellRing, BookOpenCheck, CircleDot, Compass, LayoutDashboard, Settings2, Star, Telescope } from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/concursos", label: "Concursos", icon: Compass },
  { href: "/concursos/previstos", label: "Previstos", icon: Telescope },
  { href: "/concursos/abertos", label: "Abertos", icon: CircleDot },
  { href: "/meus-concursos", label: "Meus concursos", icon: Star },
  { href: "/alertas", label: "Alertas", icon: BellRing },
  { href: "/provas", label: "Provas", icon: BookOpenCheck },
  { href: "/configuracoes", label: "Configurações", icon: Settings2 },
] as const;
