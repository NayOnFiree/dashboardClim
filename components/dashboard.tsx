"use client";

import {
  AlertTriangle, ArrowRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleGauge, Euro, FileCheck2, Grid2X2, Headphones, House, Menu, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, Snowflake, Sparkles, Users, Wrench, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { signOut } from "@/app/login/actions";
import type { DashboardDataSource } from "@/lib/dashboard-data";
import { activity, alerts, Job, JobStatus } from "@/lib/mock-data";

const navGroups = [
  { label: "Pilotage", items: [
    { label: "Vue d'ensemble", icon: Grid2X2, href: "/admin/dashboard" },
    { label: "Planning", icon: CalendarDays, href: "/admin/calendar" },
    { label: "Interventions", icon: Wrench, href: "/admin/jobs", count: 5 },
    { label: "Incidents", icon: AlertTriangle, href: "/admin/incidents", count: 1 },
  ]},
  { label: "Repertoire", items: [
    { label: "Clients & sites", icon: House, href: "/admin/customers" }, { label: "Techniciens", icon: Users, href: "/admin/technicians" },
    { label: "Equipements", icon: Snowflake, href: "/admin/equipment" },
  ]},
  { label: "Qualite", items: [
    { label: "Controle qualite", icon: ShieldCheck, href: "/admin/quality" }, { label: "Produits & protocoles", icon: FileCheck2, href: "/admin/products" },
  ]},
];

const statusOrder: JobStatus[] = ["Planifiee", "En route", "En cours", "Bloquee", "Terminee"];
const formatMoney = (amount: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
const slug = (value: string) => value.toLowerCase().replaceAll(" ", "-");

function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`status status-${slug(status)}`}>{status}</span>;
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return <>
    <button className={`sidebar-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-label="Fermer le menu" />
    <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><Snowflake size={20} strokeWidth={2.4} /></div>
        <div><strong>Clim Pilot</strong><span>Operations</span></div>
        <button className="mobile-close" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
      </div>
      <nav className="nav" aria-label="Navigation principale">
        {navGroups.map((group) => <div className="nav-group" key={group.label}>
          <span className="nav-label">{group.label}</span>
          {group.items.map((item) => <Link className={`nav-item ${pathname === item.href ? "active" : ""}`} href={item.href} key={item.label} onClick={onClose}>
            <item.icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.count ? <em>{item.count}</em> : null}
          </Link>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <button className="support-link"><Headphones size={18} />Centre d’aide<ChevronRight size={16} /></button>
        <button className="workspace-switcher"><span className="workspace-avatar">CA</span><span><strong>Clim Air Services</strong><small>Espace principal</small></span><ChevronDown size={16} /></button>
      </div>
    </aside>
  </>;
}

function MetricCard({ title, value, note, icon: Icon, tone, progress }: { title: string; value: string; note: string; icon: typeof Wrench; tone: string; progress?: number }) {
  return <article className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={20} /></div>
    <div className="metric-copy"><span>{title}</span><strong>{value}</strong>
      {progress !== undefined ? <div className="metric-progress"><i style={{ "--progress": `${progress}%` } as React.CSSProperties} /><small>{note}</small></div> : <small>{note}</small>}
    </div>
  </article>;
}

function ActivityChart() {
  const max = Math.max(...activity.map((item) => item.planned));
  return <div className="chart" role="img" aria-label="Missions planifiees et terminees cette semaine">
    <div className="chart-grid"><span>12</span><span>8</span><span>4</span><span>0</span></div>
    <div className="chart-bars">{activity.map((item) => <div className="chart-day" key={item.label}>
      <div className="bar-pair"><i className="bar planned" style={{ height: `${(item.planned / max) * 100}%` }} /><i className="bar completed" style={{ height: `${(item.completed / max) * 100}%` }} /></div><span>{item.label}</span>
    </div>)}</div>
  </div>;
}

function JobDrawer({ job, onClose }: { job: Job; onClose: () => void }) {
  return <div className="drawer-layer">
    <button className="drawer-backdrop" onClick={onClose} aria-label="Fermer le detail" />
    <aside className="drawer" aria-label={`Detail ${job.id}`}>
      <div className="drawer-head"><div><span>Intervention</span><strong>{job.id}</strong></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div>
      <div className="drawer-body">
        <div className="drawer-title"><StatusBadge status={job.status} /><h2>{job.customer}</h2><p>{job.address}</p></div>
        {job.incident && <div className="incident-box"><AlertTriangle size={18} /><div><strong>Intervention bloquee</strong><p>{job.incident}</p></div></div>}
        <dl className="detail-list">
          <div><dt>Horaire</dt><dd>{job.time} - {job.endTime}</dd></div>
          <div><dt>Technicien</dt><dd><span className="mini-avatar">{job.technicianInitials}</span>{job.technician}</dd></div>
          <div><dt>Equipements</dt><dd>{job.equipmentCount} split{job.equipmentCount > 1 ? "s" : ""}</dd></div>
          <div><dt>Montant</dt><dd>{formatMoney(job.amount)} · {job.payment}</dd></div>
        </dl>
        <div className="completion-block"><div><strong>Completude du dossier</strong><span>{job.completeness}%</span></div><div className="large-progress"><i style={{ width: `${job.completeness}%` }} /></div>
          <ul><li className="done"><Check size={16} />Informations client et site</li><li className={job.completeness > 35 ? "done" : ""}><Check size={16} />Photos avant</li><li className={job.completeness > 65 ? "done" : ""}><Check size={16} />Checklist nettoyage</li><li className={job.completeness === 100 ? "done" : ""}><Check size={16} />Photos apres et test final</li></ul>
        </div>
        {job.note && <div className="note-block"><span>Note d’accès</span><p>{job.note}</p></div>}
      </div>
      <div className="drawer-actions"><Link className="secondary-button" href={`/app/jobs/${job.id}`}>Voir la fiche complète</Link><button className="primary-button">Mettre à jour<ArrowRight size={17} /></button></div>
    </aside>
  </div>;
}

function CreateJobModal({ onClose, onCreate }: { onClose: () => void; onCreate: (job: Job) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const customer = String(data.get("customer")); const city = String(data.get("city")); const time = String(data.get("time")); const equipmentCount = Number(data.get("equipment")); const technician = String(data.get("technician"));
    onCreate({ id: `INT-2026-${String(Math.floor(128 + Math.random() * 800)).padStart(6, "0")}`, time, endTime: `${String(Math.min(Number(time.slice(0, 2)) + 2, 19)).padStart(2, "0")}:${time.slice(3)}`, customer, city, address: `${city} · Adresse a confirmer`, technician, technicianInitials: technician.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), equipmentCount, status: "Planifiee", payment: "En attente", amount: 99 + Math.max(0, equipmentCount - 1) * 60, completeness: 0 });
  };
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} aria-label="Fermer" />
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><span>Nouvelle mission</span><h2>Planifier une intervention</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="form-grid"><label className="wide">Client<input name="customer" required placeholder="Nom ou entreprise" autoFocus /></label><label>Ville<input name="city" required placeholder="Ex. Massy" /></label><label>Heure<input name="time" required type="time" defaultValue="09:00" /></label><label>Technicien<select name="technician" defaultValue="Thomas Renard"><option>Thomas Renard</option><option>Nora Bensaid</option><option>Leo Marchand</option></select></label><label>Nombre de splits<input name="equipment" required type="number" min="1" max="20" defaultValue="1" /></label></div>
      <p className="form-note"><Sparkles size={16} />La duree et le tarif proposes seront recalcules avant validation serveur.</p>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit">Creer l’intervention</button></div>
    </form>
  </div>;
}

export function Dashboard({ initialJobs, dataSource }: { initialJobs: Job[]; dataSource: DashboardDataSource }) {
  const [jobs, setJobs] = useState(initialJobs); const [period, setPeriod] = useState("Aujourd'hui"); const [status, setStatus] = useState<"Toutes" | JobStatus>("Toutes"); const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null); const [sidebarOpen, setSidebarOpen] = useState(false); const [createOpen, setCreateOpen] = useState(false); const [notificationsOpen, setNotificationsOpen] = useState(false); const [toast, setToast] = useState("");
  const filteredJobs = useMemo(() => { const normalized = query.toLowerCase().trim(); return jobs.filter((job) => (status === "Toutes" || job.status === status) && (!normalized || [job.id, job.customer, job.city, job.technician].some((value) => value.toLowerCase().includes(normalized)))); }, [jobs, query, status]);
  const revenue = jobs.reduce((total, job) => total + (job.payment === "Paye" ? job.amount : 0), 0); const equipment = jobs.reduce((total, job) => total + job.equipmentCount, 0);
  const handleCreate = (job: Job) => { setJobs((current) => [...current, job]); setCreateOpen(false); setToast(`${job.id} a ete ajoutee au planning.`); window.setTimeout(() => setToast(""), 3500); };

  return <div className="app-shell"><Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><main className="main">
    <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><Menu size={21} /></button><div className="breadcrumbs"><span>Operations</span><ChevronRight size={14} /><strong>Vue d’ensemble</strong></div>
      <div className="top-actions"><div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." /><kbd>Ctrl K</kbd></div><div className="notifications-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={19} /><i /></button>{notificationsOpen && <div className="notification-popover"><div><strong>Notifications</strong><span>3 nouvelles</span></div>{alerts.slice(0, 2).map((alert) => <button key={alert.title}><i className={alert.level.toLowerCase()} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span></button>)}</div>}</div><form action={signOut}><button className="user-menu" title="Se deconnecter"><span className="user-avatar">EM</span><span><strong>Emma Martin</strong><small>Administratrice</small></span><ChevronDown size={15} /></button></form></div>
    </header>
    <div className="content">
      <section className="page-heading"><div><p>Jeudi 17 septembre 2026</p><h1>Bonjour Emma <span>— voici le rythme du jour.</span></h1></div><div className="heading-actions"><Link className="secondary-button" href="/app/today"><Wrench size={17} />Vue technicien</Link><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={18} />Nouvelle intervention</button></div></section>
      <section className="period-tabs" aria-label="Periode">{["Aujourd'hui", "Demain", "7 jours"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "active" : ""}>{item}</button>)}<span className="period-context">{period === "Aujourd'hui" ? (dataSource === "database" ? "Synchronise avec PostgreSQL" : "Mode demonstration") : `Apercu ${period.toLowerCase()}`}</span></section>
      <section className="metrics-grid"><MetricCard title="Interventions" value={`${jobs.length}`} note="1 en cours · 1 bloquee" icon={Wrench} tone="mint" /><MetricCard title="Splits prevus" value={`${equipment}`} note="2 termines sur 9" icon={Snowflake} tone="blue" /><MetricCard title="CA encaisse" value={formatMoney(revenue)} note={`${formatMoney(jobs.reduce((sum, job) => sum + job.amount, 0))} prevus`} icon={Euro} tone="violet" /><MetricCard title="Completude" value="92%" note="Objectif 95%" icon={CircleGauge} tone="amber" progress={92} /></section>
      <section className="dashboard-grid">
        <article className="panel activity-panel"><div className="panel-head"><div><span>Activite</span><h2>Interventions cette semaine</h2></div><div className="legend"><span><i className="planned-dot" />Planifiees</span><span><i className="completed-dot" />Terminees</span></div><button className="ghost-button">Cette semaine<ChevronDown size={15} /></button></div><ActivityChart /><div className="chart-summary"><strong>43</strong><span>interventions terminees</span><em>+12% vs semaine derniere</em></div></article>
        <article className="panel alerts-panel"><div className="panel-head"><div><span>A surveiller</span><h2>Alertes</h2></div><button className="text-button">Tout voir<ArrowRight size={15} /></button></div><div className="alerts-list">{alerts.map((alert) => <button className="alert-row" key={alert.title}><i className={alert.level.toLowerCase()}><AlertTriangle size={16} /></i><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><time>{alert.time}</time><ChevronRight size={16} /></button>)}</div></article>
      </section>
      <section className="panel jobs-panel"><div className="jobs-head"><div><span>Terrain</span><h2>Interventions du jour</h2></div><div className="jobs-tools"><div className="mini-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Client, ville, ID..." /></div><button className="secondary-button"><Settings2 size={16} />Filtres</button><button className="icon-button"><MoreHorizontal size={19} /></button></div></div>
        <div className="status-filters">{(["Toutes", ...statusOrder] as const).map((item) => <button key={item} onClick={() => setStatus(item)} className={status === item ? "active" : ""}>{item}<span>{item === "Toutes" ? jobs.length : jobs.filter((job) => job.status === item).length}</span></button>)}</div>
        <div className="table-wrap"><table><thead><tr><th>Horaire</th><th>Client et site</th><th>Technicien</th><th>Equip.</th><th>Statut</th><th>Completude</th><th>Paiement</th><th aria-label="Actions" /></tr></thead><tbody>{filteredJobs.map((job) => <tr key={job.id} onClick={() => setSelectedJob(job)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedJob(job)}><td><strong>{job.time}</strong><small>{job.endTime}</small></td><td><strong>{job.customer}</strong><small>{job.id} · {job.city}</small>{job.incident && <span className="row-warning"><AlertTriangle size={13} />Incident ouvert</span>}</td><td><div className="technician"><span className="mini-avatar">{job.technicianInitials}</span><strong>{job.technician}</strong></div></td><td><span className="equipment-count">{job.equipmentCount}</span></td><td><StatusBadge status={job.status} /></td><td><div className="table-progress"><i><b style={{ width: `${job.completeness}%` }} /></i><span>{job.completeness}%</span></div></td><td><span className={`payment payment-${slug(job.payment)}`}>{job.payment}</span><small>{formatMoney(job.amount)}</small></td><td><button className="row-action" aria-label={`Ouvrir ${job.id}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!filteredJobs.length && <div className="empty-state"><Search size={24} /><strong>Aucune intervention trouvee</strong><p>Modifiez la recherche ou le filtre de statut.</p></div>}</div><div className="table-footer"><span>{filteredJobs.length} intervention{filteredJobs.length > 1 ? "s" : ""} affichee{filteredJobs.length > 1 ? "s" : ""}</span><button className="text-button">Voir toutes les interventions<ArrowRight size={15} /></button></div>
      </section>
      <section className="bottom-grid"><article className="panel team-panel"><div className="panel-head"><div><span>Equipe terrain</span><h2>Techniciens aujourd’hui</h2></div><button className="text-button">Gerer l’equipe<ArrowRight size={15} /></button></div><div className="team-list">{[{n:"Thomas Renard",i:"TR",s:"En intervention",t:"2 sur 3",p:67},{n:"Nora Bensaid",i:"NB",s:"En intervention",t:"1 sur 2",p:50},{n:"Leo Marchand",i:"LM",s:"En route",t:"0 sur 2",p:12}].map((member) => <div className="team-row" key={member.n}><span className="team-avatar">{member.i}<i /></span><span><strong>{member.n}</strong><small>{member.s}</small></span><div className="team-progress"><div><i style={{width:`${member.p}%`}} /></div><span>{member.t}</span></div></div>)}</div></article><article className="quality-card"><div className="quality-icon"><ShieldCheck size={24} /></div><span>Qualite du jour</span><h2>8 dossiers sur 9 sont complets</h2><p>Une intervention necessite une verification des photos avant cloture.</p><button>Ouvrir le controle qualite<ArrowRight size={16} /></button></article></section>
    </div>
  </main>{selectedJob && <JobDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />}{createOpen && <CreateJobModal onClose={() => setCreateOpen(false)} onCreate={handleCreate} />}{toast && <div className="toast"><Check size={18} />{toast}</div>}</div>;
}
