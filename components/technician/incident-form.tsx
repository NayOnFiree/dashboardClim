"use client";

import { AlertTriangle, ArrowLeft, Camera, Check, Image as ImageIcon, LoaderCircle, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import type { TechnicianJob } from "@/lib/technician-data";

const types = [
  ["preexisting_damage", "Dommage existant"], ["preexisting_leak", "Fuite existante"], ["error_code", "Code erreur"],
  ["abnormal_noise", "Bruit anormal"], ["no_power_or_no_start", "Appareil en panne"], ["access_impossible", "Accès impossible"],
  ["broken_clip", "Clip cassé"], ["accidental_water", "Eau accidentelle"], ["customer_property_damage", "Dommage chez le client"],
  ["drain_issue", "Problème d’évacuation"], ["incomplete_access", "Accès partiel"], ["other", "Autre"],
] as const;
type ExistingIncident = { publicCode: string; severity: string; status: string; description: string; createdAt: string };

export function IncidentForm({ job, initialIncidents }: { job: TechnicianJob; initialIncidents: ExistingIncident[] }) {
  const [preview, setPreview] = useState(""); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false); const [savedCode, setSavedCode] = useState(""); const [error, setError] = useState("");
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => { const next = event.target.files?.[0]; if (!next) return; if (preview) URL.revokeObjectURL(preview); setFile(next); setPreview(URL.createObjectURL(next)); setError(""); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) { setError("Une photo est obligatoire pour déclarer l’incident."); return; }
    setSaving(true); setError(""); const form = new FormData(event.currentTarget); form.set("file", file);
    try {
      const response = await fetch(`/api/jobs/${job.id}/incidents`, { method: "POST", body: form }); const result = await response.json() as { publicCode?: string; error?: string };
      if (!response.ok || !result.publicCode) throw new Error(result.error ?? "Déclaration impossible."); setSavedCode(result.publicCode);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Déclaration impossible."); }
    finally { setSaving(false); }
  };
  if (savedCode) return <div className="precheck-screen precheck-success"><span className="incident-success-icon"><ShieldAlert size={34} /></span><p>Incident transmis</p><h1>{savedCode}</h1><p>La preuve et votre description sont enregistrées. Un incident critique bloque automatiquement la clôture jusqu’à décision du responsable.</p><Link className="primary-tech-action" href={`/app/jobs/${job.id}`}>Retour à la mission</Link></div>;
  return <div className="incident-form-screen"><header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Signalement terrain</span><h1>Déclarer un incident</h1><p>{job.id} · {job.customer}</p></div></header>
    <div className="incident-warning"><AlertTriangle size={20} /><div><strong>Décrivez uniquement les faits observés</strong><p>Ne réalisez aucune opération frigorifique ou réparation hors du périmètre de nettoyage.</p></div></div>
    <form onSubmit={submit}><section className="incident-form-card"><div className="incident-form-grid"><label>Équipement concerné<select name="equipmentId" required>{job.equipment.map((equipment) => <option value={equipment.id} key={equipment.id}>{equipment.room} · {equipment.brand} {equipment.model}</option>)}</select></label><label>Type d’incident<select name="incidentType" required>{types.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Moment<select name="moment" defaultValue="during"><option value="before">Avant intervention</option><option value="during">Pendant l’intervention</option><option value="after">Après l’intervention</option></select></label><fieldset><legend>Gravité</legend><div className="incident-choice-row"><label><input type="radio" name="severity" value="information" /><span>Information</span></label><label><input type="radio" name="severity" value="minor" defaultChecked /><span>Mineur</span></label><label><input type="radio" name="severity" value="critical" /><span>Critique</span></label></div></fieldset><label className="wide">Description<textarea name="description" required minLength={5} maxLength={1200} rows={4} placeholder="Décrivez ce qui est visible, les circonstances et l’action prise…" /></label><label className="wide">Action prise<select name="action" defaultValue="continue"><option value="continue">Intervention poursuivie</option><option value="stopped">Intervention stoppée</option><option value="manager_called">Responsable appelé</option></select></label></div></section>
      <section className="incident-form-card"><div className="incident-photo-label"><span>Preuve photo</span><strong>1 photo obligatoire</strong></div><label className={`incident-photo-input ${preview ? "has-photo" : ""}`}>{preview ? <Image src={preview} alt="Aperçu de la preuve" width={900} height={600} unoptimized /> : <><ImageIcon size={28} /><strong>Photographier la zone concernée</strong><small>Cadrez le problème et son environnement immédiat.</small></>}<span><Camera size={17} />{preview ? "Refaire la photo" : "Prendre une photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhoto} /></label></section>
      <label className="incident-client-check"><input type="checkbox" name="clientInformed" value="true" /><span><Check size={15} /></span><div><strong>Le client a été informé</strong><small>À cocher après lui avoir expliqué la situation.</small></div></label>
      {error && <div className="service-error"><AlertTriangle size={17} />{error}</div>}<div className="precheck-action"><div><strong>Transmission immédiate</strong><span>Le responsable verra l’incident dans le back-office.</span></div><button className="primary-tech-action incident-submit" type="submit" disabled={saving || !file}>{saving ? <><LoaderCircle className="spin" size={19} />Envoi…</> : <><ShieldAlert size={19} />Déclarer l’incident</>}</button></div>
    </form>{initialIncidents.length > 0 && <section className="existing-incidents"><span>Déjà signalés sur cette mission</span>{initialIncidents.map((incident) => <article key={incident.publicCode}><AlertTriangle size={16} /><div><strong>{incident.publicCode} · {incident.createdAt}</strong><p>{incident.description}</p></div><em>{incident.status}</em></article>)}</section>}
  </div>;
}
