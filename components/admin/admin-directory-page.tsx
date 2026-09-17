"use client";

import { Bell, Building2, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, History, House, Mail, MapPin, Menu, Phone, Search, Snowflake, UserRound, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { signOut } from "@/app/login/actions";
import { AdminSidebar } from "@/components/admin/admin-jobs-page";
import type { AdminDirectoryData, DirectoryCustomer, DirectoryEquipment, DirectorySite } from "@/lib/admin-directory-data";

type View = "customers" | "sites" | "equipment";
type Selection = { kind: "customer"; value: DirectoryCustomer } | { kind: "site"; value: DirectorySite } | { kind: "equipment"; value: DirectoryEquipment };

const viewCopy = {
  customers: { eyebrow: "Répertoire commercial", title: "Clients", subtitle: "contacts, parc installé et historique.", placeholder: "Nom, téléphone, e-mail…" },
  sites: { eyebrow: "Répertoire terrain", title: "Sites & adresses", subtitle: "accès, contacts sur place et parc.", placeholder: "Client, ville, adresse…" },
  equipment: { eyebrow: "Parc technique", title: "Équipements", subtitle: "modèles, emplacements et entretien.", placeholder: "Code, marque, modèle, pièce…" },
};

const typeLabel = (type: string) => ({ individual: "Particulier", company: "Entreprise", home: "Domicile", office: "Bureaux", retail: "Commerce", wall_split: "Split mural", cassette: "Cassette", ducted: "Gainable", console: "Console" }[type] ?? type);
const difficultyLabel = (difficulty: string) => ({ simple: "Simple", medium: "Intermédiaire", complex: "Complexe" }[difficulty] ?? difficulty);
const searchable = (values: Array<string | undefined>, query: string) => values.some((value) => value?.toLocaleLowerCase("fr").includes(query));

function DirectoryDrawer({ selection, close }: { selection: Selection; close: () => void }) {
  const { kind, value } = selection;
  return <div className="directory-drawer-layer"><button className="directory-drawer-backdrop" onClick={close} aria-label="Fermer la fiche" /><aside className="directory-drawer" aria-label="Fiche détaillée"><header><div className={`directory-drawer-icon ${kind}`} >{kind === "customer" ? <UserRound /> : kind === "site" ? <House /> : <Snowflake />}</div><button className="icon-button" onClick={close} aria-label="Fermer"><X size={18} /></button></header>
    {kind === "customer" && <CustomerDetail customer={value} />}
    {kind === "site" && <SiteDetail site={value} />}
    {kind === "equipment" && <EquipmentDetail equipment={value} />}
  </aside></div>;
}

function DetailFacts({ children }: { children: React.ReactNode }) { return <dl className="directory-facts">{children}</dl>; }
function Fact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string }) { return <div><dt><Icon size={14} />{label}</dt><dd>{value || "Non renseigné"}</dd></div>; }

function CustomerDetail({ customer }: { customer: DirectoryCustomer }) {
  return <><div className="directory-drawer-title"><span>{typeLabel(customer.type)}</span><h2>{customer.name}</h2><p>Vue consolidée du contact et de son activité.</p></div><DetailFacts><Fact icon={Phone} label="Téléphone" value={customer.phone} /><Fact icon={Mail} label="E-mail" value={customer.email} /><Fact icon={Building2} label="Origine" value={customer.leadSource} /><Fact icon={History} label="Dernière intervention" value={customer.lastIntervention} /></DetailFacts><div className="directory-mini-stats"><div><strong>{customer.siteCount}</strong><span>site{customer.siteCount > 1 ? "s" : ""}</span></div><div><strong>{customer.equipmentCount}</strong><span>équipement{customer.equipmentCount > 1 ? "s" : ""}</span></div><div><strong>{customer.jobCount}</strong><span>intervention{customer.jobCount > 1 ? "s" : ""}</span></div></div><div className="directory-note"><CheckCircle2 size={17} /><div><strong>Consentement marketing</strong><span>{customer.marketingConsent ? "Consentement enregistré" : "Aucun consentement enregistré"}{customer.twentyId ? " · Synchronisé avec Twenty" : ""}</span></div></div></>;
}

function SiteDetail({ site }: { site: DirectorySite }) {
  return <><div className="directory-drawer-title"><span>{typeLabel(site.type)}</span><h2>{site.label}</h2><p>{site.customer}</p></div><DetailFacts><Fact icon={MapPin} label="Adresse complète" value={site.address} /><Fact icon={UserRound} label="Contact sur place" value={site.contactName} /><Fact icon={Phone} label="Téléphone du site" value={site.contactPhone} /><Fact icon={History} label="Dernière intervention" value={site.lastIntervention} /></DetailFacts><div className="directory-mini-stats two"><div><strong>{site.equipmentCount}</strong><span>équipement{site.equipmentCount > 1 ? "s" : ""}</span></div><div><strong>{site.jobCount}</strong><span>intervention{site.jobCount > 1 ? "s" : ""}</span></div></div><div className="directory-note access"><MapPin size={17} /><div><strong>Consignes d’accès</strong><span>{site.accessNotes || "Aucune consigne particulière enregistrée."}</span></div></div></>;
}

function EquipmentDetail({ equipment }: { equipment: DirectoryEquipment }) {
  return <><div className="directory-drawer-title"><span>{equipment.publicCode} · {typeLabel(equipment.type)}</span><h2>{equipment.brand || "Marque à confirmer"} {equipment.model}</h2><p>{equipment.customer} · {equipment.site}</p></div><DetailFacts><Fact icon={House} label="Emplacement" value={equipment.room} /><Fact icon={MapPin} label="Adresse" value={equipment.address} /><Fact icon={ClipboardList} label="Numéro de série" value={equipment.serialNumber} /><Fact icon={Wrench} label="Difficulté" value={difficultyLabel(equipment.difficulty)} /><Fact icon={History} label="Dernier entretien" value={equipment.lastService} /><Fact icon={UserRound} label="Dernier technicien" value={equipment.lastTechnician} /></DetailFacts><div className="directory-note access"><ClipboardList size={17} /><div><strong>Notes techniques internes</strong><span>{equipment.internalNotes || "Aucune note technique enregistrée."}</span></div></div></>;
}

export function AdminDirectoryPage({ activeView, data }: { activeView: View; data: AdminDirectoryData }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); const [query, setQuery] = useState(""); const [selection, setSelection] = useState<Selection>();
  const normalizedQuery = query.trim().toLocaleLowerCase("fr"); const copy = viewCopy[activeView];
  const customers = useMemo(() => data.customers.filter((item) => !normalizedQuery || searchable([item.name, item.phone, item.email, item.leadSource], normalizedQuery)), [data.customers, normalizedQuery]);
  const sites = useMemo(() => data.sites.filter((item) => !normalizedQuery || searchable([item.label, item.customer, item.address, item.city, item.contactName], normalizedQuery)), [data.sites, normalizedQuery]);
  const equipment = useMemo(() => data.equipment.filter((item) => !normalizedQuery || searchable([item.publicCode, item.customer, item.site, item.city, item.brand, item.model, item.room, item.serialNumber], normalizedQuery)), [data.equipment, normalizedQuery]);
  const resultCount = activeView === "customers" ? customers.length : activeView === "sites" ? sites.length : equipment.length;

  return <div className="app-shell"><AdminSidebar open={sidebarOpen} close={() => setSidebarOpen(false)} /><main className="main"><header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><Menu size={21} /></button><div className="breadcrumbs"><span>Operations</span><ChevronRight size={14} /><strong>Répertoire</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /></button><form action={signOut}><button className="user-menu"><span className="user-avatar">EM</span><span><strong>Emma Martin</strong><small>Administratrice</small></span><ChevronDown size={15} /></button></form></div></header><div className="content admin-directory-content">
    <section className="page-heading"><div><p>{copy.eyebrow}</p><h1>{copy.title} <span>— {copy.subtitle}</span></h1></div></section>
    <nav className="directory-tabs" aria-label="Répertoire"><Link className={activeView === "customers" ? "active" : ""} href="/admin/customers"><UserRound size={15} />Clients <span>{data.customers.length}</span></Link><Link className={activeView === "sites" ? "active" : ""} href="/admin/sites"><MapPin size={15} />Sites <span>{data.sites.length}</span></Link><Link className={activeView === "equipment" ? "active" : ""} href="/admin/equipment"><Snowflake size={15} />Équipements <span>{data.equipment.length}</span></Link></nav>
    <section className="directory-stats"><div><span>Total clients</span><strong>{data.customers.length}</strong><small>{data.customers.filter((item) => item.type === "company").length} entreprises</small></div><div><span>Sites actifs</span><strong>{data.sites.length}</strong><small>{new Set(data.sites.map((item) => item.city)).size} villes couvertes</small></div><div><span>Parc installé</span><strong>{data.equipment.length}</strong><small>{data.equipment.filter((item) => item.difficulty === "complex").length} accès complexes</small></div><div><span>Interventions liées</span><strong>{data.customers.reduce((sum, item) => sum + item.jobCount, 0)}</strong><small>Historique consolidé</small></div></section>
    <section className="panel directory-panel"><div className="directory-toolbar"><div><strong>{copy.title}</strong><span>{resultCount} résultat{resultCount > 1 ? "s" : ""}</span></div><label className="mini-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.placeholder} aria-label="Rechercher" /></label></div>
      {activeView === "customers" && <CustomerRows items={customers} select={(value) => setSelection({ kind: "customer", value })} />}
      {activeView === "sites" && <SiteRows items={sites} select={(value) => setSelection({ kind: "site", value })} />}
      {activeView === "equipment" && <EquipmentRows items={equipment} select={(value) => setSelection({ kind: "equipment", value })} />}
      {!resultCount && <div className="empty-state"><Search size={24} /><strong>Aucun résultat</strong><p>Essayez une autre recherche.</p></div>}
      <footer className="table-footer"><span>{resultCount} élément{resultCount > 1 ? "s" : ""}</span><span>Données PostgreSQL en temps réel</span></footer>
    </section>
  </div></main>{selection && <DirectoryDrawer selection={selection} close={() => setSelection(undefined)} />}</div>;
}

function CustomerRows({ items, select }: { items: DirectoryCustomer[]; select: (item: DirectoryCustomer) => void }) { return <div className="directory-list">{items.map((item) => <button onClick={() => select(item)} key={item.id}><span className="directory-avatar">{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{item.name}</strong><small>{typeLabel(item.type)} · {item.phone || item.email || "Contact à compléter"}</small></span><span><strong>{item.siteCount} site{item.siteCount > 1 ? "s" : ""}</strong><small>{item.equipmentCount} équipement{item.equipmentCount > 1 ? "s" : ""}</small></span><span><strong>{item.jobCount} intervention{item.jobCount > 1 ? "s" : ""}</strong><small>{item.lastIntervention ? `Dernière le ${item.lastIntervention}` : "Aucun historique"}</small></span><ChevronRight size={17} /></button>)}</div>; }
function SiteRows({ items, select }: { items: DirectorySite[]; select: (item: DirectorySite) => void }) { return <div className="directory-list">{items.map((item) => <button onClick={() => select(item)} key={item.id}><span className="directory-avatar site"><MapPin size={16} /></span><span><strong>{item.label}</strong><small>{item.customer} · {typeLabel(item.type)}</small></span><span><strong>{item.city}</strong><small>{item.address}</small></span><span><strong>{item.equipmentCount} équipement{item.equipmentCount > 1 ? "s" : ""}</strong><small>{item.accessNotes ? "Consignes d’accès renseignées" : "Accès à compléter"}</small></span><ChevronRight size={17} /></button>)}</div>; }
function EquipmentRows({ items, select }: { items: DirectoryEquipment[]; select: (item: DirectoryEquipment) => void }) { return <div className="directory-list">{items.map((item) => <button onClick={() => select(item)} key={item.id}><span className="directory-avatar equipment"><Snowflake size={16} /></span><span><strong>{item.brand || "Marque à confirmer"} {item.model}</strong><small>{item.publicCode} · {typeLabel(item.type)}</small></span><span><strong>{item.room}</strong><small>{item.customer} · {item.site}</small></span><span><strong>{difficultyLabel(item.difficulty)}</strong><small>{item.lastService ? `Entretenu le ${item.lastService}` : "Aucun entretien"}</small></span><ChevronRight size={17} /></button>)}</div>; }
