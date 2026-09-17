"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, LoaderCircle, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SavedFinalCheck } from "@/lib/final-check-data";
import type { TechnicianJob } from "@/lib/technician-data";

const questions = [
  { code: "starts", label: "L’appareil redémarre", options: ["Oui", "Non"] },
  { code: "fan", label: "La ventilation fonctionne", options: ["Oui", "Non"] },
  { code: "louvers", label: "Les volets se déplacent normalement", options: ["Oui", "Non", "Non applicable"] },
  { code: "no_error", label: "Aucun nouveau code erreur", options: ["Oui", "Non"] },
  { code: "no_leak", label: "Aucune fuite anormale visible", options: ["Oui", "Non"] },
  { code: "no_noise", label: "Aucun nouveau bruit anormal", options: ["Oui", "Non"] },
  { code: "clean_area", label: "La zone client est propre", options: ["Oui", "Non"] },
] as const;

type State = Record<string, { answers: Record<string, string>; notes: string }>;

export function FinalCheckForm({ job, initialChecks }: { job: TechnicianJob; initialChecks: SavedFinalCheck[] }) {
  const [checks, setChecks] = useState<State>(() => Object.fromEntries(job.equipment.map((equipment) => {
    const saved = initialChecks.find((check) => check.equipmentId === equipment.id);
    return [equipment.id, { answers: saved?.answers ?? {}, notes: saved?.notes ?? "" }];
  })));
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const answered = job.equipment.reduce((count, equipment) => count + questions.filter((question) => checks[equipment.id].answers[question.code]).length, 0);
  const total = job.equipment.length * questions.length;

  const submit = async () => {
    const incompleteEquipment = job.equipment.find((equipment) => questions.some((question) => !checks[equipment.id].answers[question.code]));
    if (incompleteEquipment) { setError(`Complétez tous les contrôles pour ${incompleteEquipment.room}.`); return; }
    const missingNote = job.equipment.find((equipment) => Object.values(checks[equipment.id].answers).includes("Non") && checks[equipment.id].notes.trim().length < 3);
    if (missingNote) { setError(`Décrivez le résultat négatif pour ${missingNote.room}.`); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${job.id}/final-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checks: job.equipment.map((equipment) => ({ equipmentId: equipment.id, answers: checks[equipment.id].answers, notes: checks[equipment.id].notes.trim() || undefined })) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  };

  if (saved) return <div className="precheck-screen precheck-success"><span><CheckCircle2 size={34} /></span><p>Étape 5 terminée</p><h1>Test final enregistré</h1><p>Les résultats sont horodatés. Un incident a été créé automatiquement pour chaque équipement comportant une réponse négative.</p><Link className="primary-tech-action" href={`/app/jobs/${job.id}/complete`}>Préparer la clôture<ArrowRight size={19} /></Link></div>;

  return <div className="final-check-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 5 sur 6</span><h1>Test final</h1><p>Redémarrage et contrôle fonctionnel après remontage</p></div></header>
    <div className="photo-progress"><div><i style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div><strong>{answered}/{total}</strong><span>contrôles renseignés</span></div>
    <div className="safety-reminder"><PlayCircle size={19} /><div><strong>Effectuez un cycle réel sur chaque unité</strong><p>Une réponse « Non » sera documentée comme incident et devra être expliquée.</p></div></div>
    <section className="final-equipment-list">{job.equipment.map((equipment) => {
      const state = checks[equipment.id]; const hasFailure = Object.values(state.answers).includes("Non");
      return <article className="final-equipment" key={equipment.id}><header><div><span>{equipment.publicCode}</span><h2>{equipment.room}</h2><p>{equipment.brand} {equipment.model}</p></div><strong>{questions.filter((question) => state.answers[question.code]).length}/{questions.length}</strong></header>
        <div className="final-question-list">{questions.map((question, index) => <fieldset className="final-question" key={question.code}><legend><span>{index + 1}</span>{question.label}</legend><div className="answer-options">{question.options.map((option) => <button type="button" className={state.answers[question.code] === option ? "selected" : ""} onClick={() => setChecks((current) => ({ ...current, [equipment.id]: { ...current[equipment.id], answers: { ...current[equipment.id].answers, [question.code]: option } } }))} key={option}>{state.answers[question.code] === option && <Check size={15} />}{option}</button>)}</div></fieldset>)}</div>
        {hasFailure && <label className="service-reason">Observation obligatoire<textarea value={state.notes} onChange={(event) => setChecks((current) => ({ ...current, [equipment.id]: { ...current[equipment.id], notes: event.target.value } }))} placeholder="Décrivez précisément le dysfonctionnement observé…" /></label>}
      </article>;
    })}</section>
    {error && <div className="service-error"><AlertTriangle size={17} />{error}</div>}
    <div className="precheck-action"><div><strong>{answered === total ? "Contrôles renseignés" : `${total - answered} réponse${total - answered > 1 ? "s" : ""} restante${total - answered > 1 ? "s" : ""}`}</strong><span>Le serveur vérifiera aussi les photos après et la checklist.</span></div><button className="primary-tech-action" type="button" disabled={saving || answered !== total} onClick={submit}>{saving ? <><LoaderCircle className="spin" size={19} />Enregistrement…</> : <>Valider le test final<ArrowRight size={19} /></>}</button></div>
  </div>;
}
