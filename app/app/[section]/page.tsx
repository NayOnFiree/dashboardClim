import { ArrowLeft, Clock3 } from "lucide-react";
import Link from "next/link";

const labels: Record<string, string> = {
  history: "Historique",
  sync: "Synchronisation",
  profile: "Profil technicien",
};

export default async function TechnicianSectionPage({ params }: PageProps<"/app/[section]">) {
  const { section } = await params;
  return <div className="tech-placeholder"><span><Clock3 size={27} /></span><small>Prochain écran terrain</small><h1>{labels[section] ?? "Module"}</h1><p>La navigation est prête. Ce module sera raccordé aux données de l’utilisateur dans le prochain lot.</p><Link className="primary-tech-action" href="/app/today"><ArrowLeft size={18} />Retour à aujourd’hui</Link></div>;
}
