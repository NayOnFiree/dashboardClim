import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

const names: Record<string, string> = {
  calendar: "Planning",
  jobs: "Interventions",
  incidents: "Incidents",
  customers: "Clients et sites",
  technicians: "Techniciens",
  equipment: "Équipements",
  quality: "Contrôle qualité",
  products: "Produits et protocoles",
};

export default async function AdminSectionPage({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  const title = names[section] ?? "Module";
  return <main className="placeholder-page"><div className="placeholder-card"><span><Construction size={26} /></span><p>Prochain module</p><h1>{title}</h1><p>La structure de navigation est prête. Cet écran sera raccordé aux données opérationnelles dans le prochain lot.</p><Link className="primary-button" href="/admin/dashboard"><ArrowLeft size={17} />Retour au dashboard</Link></div></main>;
}
