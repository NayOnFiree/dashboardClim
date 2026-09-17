"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CloudOff, MapPin, Navigation, Phone, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TechnicianJob } from "@/lib/technician-data";

const statusLabels = {
  Terminee: "Terminée",
  "En cours": "En cours",
  Planifiee: "À venir",
  "En route": "En route",
  Bloquee: "Bloquée",
};

export function TodayScreen({ jobs, firstName }: { jobs: TechnicianJob[]; firstName: string }) {
  const [online, setOnline] = useState(true);
  const remaining = jobs.filter((job) => job.status !== "Terminee").length;
  const splitCount = jobs.reduce((sum, job) => sum + job.equipmentCount, 0);
  const completed = jobs.filter((job) => job.status === "Terminee").length;

  return <div className="today-screen">
    <header className="tech-page-header">
      <div><span>{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h1>Bonjour {firstName}</h1><p>{remaining} missions restent à réaliser aujourd’hui.</p></div>
      <button className={`sync-pill ${online ? "online" : "offline"}`} onClick={() => setOnline((value) => !value)}>{online ? <><i />Synchronisé</> : <><CloudOff size={15} />Hors ligne</>}</button>
    </header>

    <section className="today-summary">
      <div><strong>{jobs.length}</strong><span>Missions</span></div><div><strong>{splitCount}</strong><span>Splits</span></div><div><strong>{completed}</strong><span>Terminée</span></div><div><strong>{Math.max(1, splitCount)} h</strong><span>Terrain estimé</span></div>
    </section>

    <div className="route-heading"><div><Navigation size={18} /><span>Ma tournée</span></div><small>31 km estimés</small></div>

    <section className="job-stack">
      {jobs.map((job, index) => <article className={`tech-job-card ${job.status === "En cours" ? "current" : ""}`} key={job.id}>
        <div className="route-marker"><span>{index + 1}</span>{index < jobs.length - 1 && <i />}</div>
        <div className="job-card-content">
          <div className="job-card-top"><div><time>{job.time}</time><small>{job.endTime}</small></div><span className={`tech-status ${job.status.toLowerCase().replaceAll(" ", "-")}`}>{job.status === "Terminee" && <CheckCircle2 size={14} />}{statusLabels[job.status]}</span></div>
          <div className="job-card-title"><div><h2>{job.customer}</h2><p><MapPin size={14} />{job.city}</p></div><span className="split-chip"><Snowflake size={14} />{job.equipmentCount} split{job.equipmentCount > 1 ? "s" : ""}</span></div>
          {job.incident && <div className="tech-warning"><AlertTriangle size={16} /><span>{job.incident}</span></div>}
          {job.status === "En cours" && <div className="job-progress"><div><i style={{ width: `${job.completeness}%` }} /></div><span>{job.completeness}%</span></div>}
          <div className="job-card-actions"><a className="quick-action" href={`tel:${job.customerPhone}`} aria-label={`Appeler ${job.customer}`}><Phone size={17} /></a><a className="quick-action" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" aria-label={`Itinéraire vers ${job.customer}`}><Navigation size={17} /></a><Link className="open-job" href={`/app/jobs/${job.id}`}>{job.status === "Terminee" ? "Consulter" : job.status === "En cours" ? "Reprendre" : "Ouvrir"}<ArrowRight size={17} /></Link></div>
        </div>
      </article>)}
    </section>
  </div>;
}
