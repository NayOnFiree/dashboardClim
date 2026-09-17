"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TechnicianJob } from "@/lib/technician-data";

type Answer = "Oui" | "Non" | "Non testé" | "Traces";

const questions = [
  { id: "starts", label: "L’unité démarre-t-elle ?", options: ["Oui", "Non", "Non testé"] as Answer[], warning: "Une réponse Non doit être documentée et bloque la validation du fonctionnement final." },
  { id: "error", label: "Un code erreur est-il visible ?", options: ["Oui", "Non"] as Answer[], anomalyOn: "Oui" },
  { id: "leak", label: "Une fuite est-elle déjà présente ?", options: ["Oui", "Non", "Traces"] as Answer[], anomalyOn: "Oui" },
  { id: "noise", label: "Un bruit anormal est-il audible ?", options: ["Oui", "Non"] as Answer[], anomalyOn: "Oui" },
  { id: "damage", label: "Un dommage plastique ou de fixation est-il visible ?", options: ["Oui", "Non"] as Answer[], anomalyOn: "Oui" },
  { id: "access", label: "La zone est-elle accessible en sécurité ?", options: ["Oui", "Non"] as Answer[], anomalyOn: "Non" },
];

export function PrecheckForm({ job }: { job: TechnicianJob }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [safety, setSafety] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const answered = Object.keys(answers).length;
  const anomalies = useMemo(() => questions.filter((question) => {
    const answer = answers[question.id];
    return answer && (answer === question.anomalyOn || (question.id === "leak" && answer === "Traces") || (question.id === "starts" && answer !== "Oui"));
  }), [answers]);
  const requiredNotesComplete = anomalies.every((question) => (notes[question.id] ?? "").trim().length >= 3);
  const canSubmit = answered === questions.length && safety && requiredNotesComplete;

  if (submitted) {
    return <div className="precheck-screen"><div className="precheck-success"><span><ShieldCheck size={30} /></span><p>État initial enregistré</p><h1>Pré-contrôle terminé</h1><p>Les réponses sont synchronisées avec le dossier. {anomalies.length ? `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} a été signalée.` : "Aucune anomalie détectée."}</p><Link className="primary-tech-action" href={`/app/jobs/${job.id}`}>Retour à la mission<ArrowRight size={19} /></Link></div></div>;
  }

  return <div className="precheck-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 1 sur 6</span><h1>État initial</h1><p>{job.customer} · {job.equipment[0]?.room}</p></div></header>
    <div className="precheck-progress"><i style={{ width: `${(answered / questions.length) * 100}%` }} /><span>{answered}/{questions.length}</span></div>
    <div className="safety-reminder"><ShieldCheck size={19} /><div><strong>Contrôle avant nettoyage</strong><p>Documentez uniquement l’état observé. Aucun diagnostic frigorifique ne doit être réalisé.</p></div></div>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (!canSubmit || saving || !job.equipment[0]) return;
      setSaving(true); setSaveError("");
      try {
        const response = await fetch(`/api/jobs/${job.id}/precheck`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipmentId: job.equipment[0].id, answers, notes, safety }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
        setSubmitted(true);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Enregistrement impossible.");
      } finally {
        setSaving(false);
      }
    }}>
      <div className="question-list">{questions.map((question, index) => {
        const answer = answers[question.id];
        const anomaly = anomalies.some((item) => item.id === question.id);
        return <fieldset className={`precheck-question ${answer ? "answered" : ""}`} key={question.id}><legend><span>{String(index + 1).padStart(2, "0")}</span>{question.label}</legend><div className="answer-options">{question.options.map((option) => <button className={answer === option ? "selected" : ""} type="button" key={option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>{answer === option && <Check size={16} />}{option}</button>)}</div>
          {question.warning && answer && answer !== "Oui" && <div className="answer-warning"><AlertTriangle size={16} />{question.warning}</div>}
          {anomaly && <div className="anomaly-details"><label>Observation obligatoire<textarea value={notes[question.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Décrivez brièvement ce qui est visible…" /></label><button type="button"><Camera size={17} />Ajouter une photo</button></div>}
        </fieldset>;
      })}</div>
      <label className={`safety-check ${safety ? "checked" : ""}`}><input type="checkbox" checked={safety} onChange={(event) => setSafety(event.target.checked)} /><span><Check size={17} /></span><div><strong>Électricité coupée avant nettoyage humide</strong><small>Cette confirmation est obligatoire avant de continuer.</small></div></label>
      <div className="precheck-action"><div><strong>{saveError ? "Enregistrement impossible" : canSubmit ? "Prêt à continuer" : "Vérifications incomplètes"}</strong><span>{saveError || (!requiredNotesComplete ? "Ajoutez une observation aux anomalies." : !safety ? "Confirmez la règle de sécurité." : `${questions.length - answered} réponse${questions.length - answered > 1 ? "s" : ""} restante${questions.length - answered > 1 ? "s" : ""}.`)}</span></div><button className="primary-tech-action" type="submit" disabled={!canSubmit || saving}>{saving ? "Enregistrement…" : "Valider l’état initial"}<ArrowRight size={19} /></button></div>
    </form>
  </div>;
}
