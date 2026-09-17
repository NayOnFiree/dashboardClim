"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Image as ImageIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import type { BeforePhoto } from "@/lib/photo-data";
import type { Equipment, TechnicianJob } from "@/lib/technician-data";

const photoSlots = [
  { type: "before_overview", label: "Unité entière", hint: "Photo large de l’unité et de son état général", required: true },
  { type: "before_environment", label: "Environnement", hint: "Mur, meuble, sol et zone sous l’unité", required: true },
  { type: "model_label", label: "Plaque signalétique", hint: "Étiquette nette avec marque et référence", required: true },
  { type: "before_filters", label: "Filtres avant", hint: "Filtres visibles avant nettoyage", required: true },
  { type: "before_coil", label: "Échangeur", hint: "État de l’échangeur s’il est visible", required: false },
  { type: "before_blower", label: "Turbine", hint: "État de la turbine si elle est visible", required: false },
] as const;

type UploadState = { id?: string; url?: string; preview?: string; status: "ready" | "uploading" | "error"; error?: string };

export function BeforePhotos({ job, equipment, initialPhotos }: { job: TechnicianJob; equipment: Equipment; initialPhotos: BeforePhoto[] }) {
  const [uploads, setUploads] = useState<Record<string, UploadState>>(() => Object.fromEntries(initialPhotos.map((photo) => [photo.type, { id: photo.id, url: `/api/photos/${photo.id}`, status: "ready" }])));
  const requiredCount = photoSlots.filter((slot) => slot.required).length;
  const completedRequired = useMemo(() => photoSlots.filter((slot) => slot.required && uploads[slot.type]?.id).length, [uploads]);
  const canContinue = completedRequired === requiredCount;

  const uploadPhoto = async (slot: typeof photoSlots[number], event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setUploads((current) => ({ ...current, [slot.type]: { preview: localPreview, status: "uploading" } }));
    const form = new FormData();
    form.set("file", file); form.set("equipmentId", equipment.id); form.set("photoType", slot.type);
    try {
      const response = await fetch(`/api/jobs/${job.id}/photos`, { method: "POST", body: form });
      const result = await response.json() as { id?: string; url?: string; error?: string };
      if (!response.ok || !result.id || !result.url) throw new Error(result.error ?? "Upload impossible.");
      URL.revokeObjectURL(localPreview);
      setUploads((current) => ({ ...current, [slot.type]: { id: result.id, url: result.url, status: "ready" } }));
    } catch (error) {
      setUploads((current) => ({ ...current, [slot.type]: { preview: localPreview, status: "error", error: error instanceof Error ? error.message : "Upload impossible." } }));
    } finally { event.target.value = ""; }
  };

  return <div className="photos-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 2 sur 6</span><h1>Photos avant</h1><p>{equipment.room} · {equipment.brand} {equipment.model}</p></div></header>
    <div className="photo-progress"><div><i style={{ width: `${(completedRequired / requiredCount) * 100}%` }} /></div><strong>{completedRequired}/{requiredCount}</strong><span>photos obligatoires</span></div>
    <div className="photo-privacy"><ShieldCheck size={18} /><p>Cadrez uniquement l’équipement et sa zone immédiate. Les métadonnées privées sont supprimées lors de l’envoi.</p></div>
    <section className="photo-grid">{photoSlots.map((slot) => {
      const upload = uploads[slot.type]; const source = upload?.url ?? upload?.preview;
      return <article className={`photo-slot ${upload?.id ? "complete" : ""} ${upload?.status === "error" ? "failed" : ""}`} key={slot.type}>
        <div className="photo-preview">{source ? <Image src={source} alt={`Aperçu ${slot.label}`} width={800} height={500} unoptimized /> : <ImageIcon size={26} />}{upload?.status === "uploading" && <span className="photo-uploading"><LoaderCircle size={22} />Traitement…</span>}{upload?.id && <span className="photo-complete"><CheckCircle2 size={17} />Enregistrée</span>}</div>
        <div className="photo-slot-copy"><div><strong>{slot.label}</strong><span>{slot.required ? "Obligatoire" : "Si visible"}</span></div><p>{slot.hint}</p>{upload?.error && <small><AlertTriangle size={13} />{upload.error}</small>}</div>
        <label className="photo-capture"><Camera size={17} />{upload?.id ? "Refaire" : upload?.status === "error" ? "Réessayer" : "Prendre la photo"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => uploadPhoto(slot, event)} disabled={upload?.status === "uploading"} /></label>
      </article>;
    })}</section>
    <div className="precheck-action"><div><strong>{canContinue ? "Photos obligatoires complètes" : `${requiredCount - completedRequired} photo${requiredCount - completedRequired > 1 ? "s" : ""} obligatoire${requiredCount - completedRequired > 1 ? "s" : ""} restante${requiredCount - completedRequired > 1 ? "s" : ""}`}</strong><span>Les photos facultatives peuvent être ajoutées si les zones sont visibles.</span></div><Link className={`primary-tech-action ${canContinue ? "" : "disabled"}`} aria-disabled={!canContinue} href={canContinue ? `/app/jobs/${job.id}` : "#"}>Continuer<ArrowRight size={19} /></Link></div>
  </div>;
}
