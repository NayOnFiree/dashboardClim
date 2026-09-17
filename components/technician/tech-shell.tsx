"use client";

import { CalendarDays, History, LogOut, RefreshCw, Snowflake, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

const items = [
  { label: "Aujourd’hui", href: "/app/today", icon: CalendarDays },
  { label: "Historique", href: "/app/history", icon: History },
  { label: "Synchronisation", href: "/app/sync", icon: RefreshCw },
  { label: "Profil", href: "/app/profile", icon: UserRound },
];

export function TechShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <div className="tech-app">
    <aside className="tech-rail">
      <Link className="tech-brand" href="/app/today"><span><Snowflake size={21} /></span><strong>Clim Pilot</strong><small>Terrain</small></Link>
      <nav>{items.map((item) => <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href}><item.icon size={20} /><span>{item.label}</span></Link>)}</nav>
      <form className="tech-logout-form" action={signOut}><button className="tech-admin-link" type="submit"><LogOut size={16} />Se déconnecter</button></form>
    </aside>
    <main className="tech-main">{children}</main>
    <nav className="tech-bottom-nav">{items.map((item) => <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href}><item.icon size={20} /><span>{item.label}</span></Link>)}</nav>
  </div>;
}
