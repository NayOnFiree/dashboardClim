"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, MapPin, Navigation, Phone, Play, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TechnicianJob } from "@/lib/technician-data";

const steps = ["État initial", "Photos avant", "Nettoyage", "Photos après", "Test final", "Terminer"];

export function JobDetail({ job }: { job: TechnicianJob }) {
  const [status, setStatus] = useState(job.status);
  const equipmentPath = (equipmentId: string) => job.currentStep >= 3
    ? `/app/jobs/${job.id}/equipment/${equipmentId}/after`
    : job.currentStep >= 2
      ? `/app/jobs/${job.id}/equipment/${equipmentId}/service`
      : `/app/jobs/${job.id}/equipment/${equipmentId}/before`;

  return <div className="job-detail-screen">
    <header className="mission-header"><Link className="round-back" href="/app/today" aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>{job.id}</span><h1>{job.customer}</h1></div><span className={`tech-status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span></header>

    <section className="mission-hero">
      <div className="mission-time"><Clock3 size={18} /><span><strong>{job.time} - {job.endTime}</strong><small>{job.service}</small></span></div>
      <div className="mission-address"><MapPin size={18} /><span><strong>{job.address}</strong><small>{job.accessInstructions}</small></span></div>
      <div className="mission-quick-actions"><a href={`tel:${job.customerPhone}`}><Phone size={18} />Appeler</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"><Navigation size={18} />Itinéraire</a></div>
    </section>

    <section className="mission-section progress-section"><div className="section-title"><div><span>Progression</span><h2>{Math.min(job.currentStep, 6)} étapes sur 6</h2></div><strong>{Math.round((job.currentStep / 6) * 100)}%</strong></div><div className="mission-progress-bar"><i style={{ width: `${(job.currentStep / 6) * 100}%` }} /></div><ol className="mission-steps">{steps.map((step, index) => <li className={index < job.currentStep ? "done" : index === job.currentStep ? "current" : ""} key={step}><span>{index < job.currentStep ? <Check size={15} /> : index + 1}</span><strong>{step}</strong>{index === job.currentStep && <small>Prochaine étape</small>}</li>)}</ol></section>

    <section className="mission-section"><div className="section-title"><div><span>Équipements</span><h2>{job.equipment.length} unité{job.equipment.length > 1 ? "s" : ""} à traiter</h2></div></div><div className="equipment-list">{job.equipment.map((equipment, index) => <article className="equipment-card" key={equipment.id}><div className="equipment-index"><Snowflake size={19} /></div><div><span>Split {index + 1} · {equipment.publicCode}</span><h3>{equipment.room}</h3><p>{equipment.brand} {equipment.model}</p><small>{equipment.difficulty} · {equipment.lastService}</small>{equipment.note && <div className="equipment-note"><AlertTriangle size={14} />{equipment.note}</div>}</div><Link aria-label={`Ouvrir ${equipment.room}`} href={equipmentPath(equipment.id)}><ChevronRight size={19} /></Link></article>)}</div></section>
    <Link className="mission-incident-action" href={`/app/jobs/${job.id}/incidents`}><AlertTriangle size={18} /><span><strong>Déclarer un incident</strong><small>Accessible à tout moment pendant la mission</small></span><ChevronRight size={18} /></Link>

    <div className="mobile-mission-action">
      {status === "Planifiee" && <button className="primary-tech-action" onClick={() => setStatus("En route")}><Navigation size={19} />Je suis en route</button>}
      {status === "En route" && <button className="primary-tech-action" onClick={() => setStatus("En cours")}><Play size={19} />Je suis arrivé</button>}
      {status === "En cours" && job.currentStep === 0 && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/precheck`}>Commencer le pré-contrôle<ArrowRight size={19} /></Link>}
      {status === "En cours" && job.currentStep === 1 && job.equipment[0] && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/equipment/${job.equipment[0].id}/before`}>Continuer les photos avant<ArrowRight size={19} /></Link>}
      {status === "En cours" && job.currentStep === 2 && job.equipment[0] && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/equipment/${job.equipment[0].id}/service`}>Continuer le nettoyage<ArrowRight size={19} /></Link>}
      {status === "En cours" && job.currentStep === 3 && job.equipment[0] && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/equipment/${job.equipment[0].id}/after`}>Continuer les photos après<ArrowRight size={19} /></Link>}
      {status === "En cours" && job.currentStep === 4 && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/final-check`}>Lancer le test final<ArrowRight size={19} /></Link>}
      {status === "En cours" && job.currentStep === 5 && <Link className="primary-tech-action" href={`/app/jobs/${job.id}/complete`}>Terminer l’intervention<ArrowRight size={19} /></Link>}
      {status === "Terminee" && <Link className="primary-tech-action muted" href="/app/today">Retour à ma tournée<ArrowRight size={19} /></Link>}
    </div>
  </div>;
}
