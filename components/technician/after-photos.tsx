"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Image as ImageIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useState } from "react";
import type { AfterPhoto } from "@/lib/photo-data";
import type { Equipment, TechnicianJob } from "@/lib/technician-data";

const photoSlots = [
  { type: "after_overview", label: "Unité remontée", hint: "Vue entière, capot fermé et surfaces propres", required: true },
  { type: "after_environment", label: "Environnement final", hint: "Mur, meuble et sol propres après rangement de la protection", required: true },
  { type: "after_filters", label: "Filtres propres", hint: "Filtres nettoyés ou remplacés avant remontage", required: true },
  { type: "after_coil", label: "Échangeur propre", hint: "Échangeur après nettoyage, si la zone reste visible", required: false },
  { type: "after_blower", label: "Turbine propre", hint: "Turbine après nettoyage, si la zone reste visible", required: false },
] as const;

type UploadState = { id?: string; url?: string; preview?: string; status: "ready" | "uploading" | "error"; error?: string };

export function AfterPhotos({ job, equipment, initialPhotos }: { job: TechnicianJob; equipment: Equipment; initialPhotos: AfterPhoto[] }) {
  const [uploads, setUploads] = useState<Record<string, UploadState>>(() => Object.fromEntries(initialPhotos.map((photo) => [photo.type, { id: photo.id, url: `/api/photos/${photo.id}`, status: "ready" }])));
  const requiredSlots = photoSlots.filter((slot) => slot.required);
  const completed = requiredSlots.filter((slot) => uploads[slot.type]?.id).length;
  const canContinue = completed === requiredSlots.length;

  const uploadPhoto = async (slot: typeof photoSlots[number], event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setUploads((current) => ({ ...current, [slot.type]: { preview: localPreview, status: "uploading" } }));
    const form = new FormData(); form.set("file", file); form.set("equipmentId", equipment.id); form.set("photoType", slot.type);
    try {
      const response = await fetch(`/api/jobs/${job.id}/photos`, { method: "POST", body: form });
      const result = await response.json() as { id?: string; url?: string; error?: string };
      if (!response.ok || !result.id || !result.url) throw new Error(result.error ?? "Envoi impossible.");
      URL.revokeObjectURL(localPreview);
      setUploads((current) => ({ ...current, [slot.type]: { id: result.id, url: result.url, status: "ready" } }));
    } catch (caught) {
      setUploads((current) => ({ ...current, [slot.type]: { preview: localPreview, status: "error", error: caught instanceof Error ? caught.message : "Envoi impossible." } }));
    } finally { event.target.value = ""; }
  };

  return <div className="photos-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 4 sur 6</span><h1>Photos après</h1><p>{equipment.room} · {equipment.brand} {equipment.model}</p></div></header>
    <div className="photo-progress"><div><i style={{ width: `${(completed / requiredSlots.length) * 100}%` }} /></div><strong>{completed}/{requiredSlots.length}</strong><span>preuves obligatoires</span></div>
    <div className="photo-privacy"><ShieldCheck size={18} /><p>Vérifiez l’absence de résidu, de trace d’humidité et d’objet personnel dans le cadre avant l’envoi.</p></div>
    <section className="photo-grid">{photoSlots.map((slot) => {
      const upload = uploads[slot.type]; const source = upload?.url ?? upload?.preview;
      return <article className={`photo-slot ${upload?.id ? "complete" : ""} ${upload?.status === "error" ? "failed" : ""}`} key={slot.type}>
        <div className="photo-preview">{source ? <Image src={source} alt={`Aperçu ${slot.label}`} width={800} height={500} unoptimized /> : <ImageIcon size={26} />}{upload?.status === "uploading" && <span className="photo-uploading"><LoaderCircle size={22} />Traitement…</span>}{upload?.id && <span className="photo-complete"><CheckCircle2 size={17} />Enregistrée</span>}</div>
        <div className="photo-slot-copy"><div><strong>{slot.label}</strong><span>{slot.required ? "Obligatoire" : "Si visible"}</span></div><p>{slot.hint}</p>{upload?.error && <small><AlertTriangle size={13} />{upload.error}</small>}</div>
        <label className="photo-capture"><Camera size={17} />{upload?.id ? "Refaire" : upload?.status === "error" ? "Réessayer" : "Prendre la photo"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => uploadPhoto(slot, event)} disabled={upload?.status === "uploading"} /></label>
      </article>;
    })}</section>
    <div className="precheck-action"><div><strong>{canContinue ? "Dossier photo complet" : `${requiredSlots.length - completed} photo${requiredSlots.length - completed > 1 ? "s" : ""} restante${requiredSlots.length - completed > 1 ? "s" : ""}`}</strong><span>Les vues échangeur et turbine restent facultatives si elles ne sont plus accessibles.</span></div><Link className={`primary-tech-action ${canContinue ? "" : "disabled"}`} aria-disabled={!canContinue} href={canContinue ? `/app/jobs/${job.id}` : "#"}>Continuer vers le test<ArrowRight size={19} /></Link></div>
  </div>;
}
