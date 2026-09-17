export type JobStatus = "Planifiee" | "En route" | "En cours" | "Bloquee" | "Terminee";
export type PaymentStatus = "Paye" | "En attente" | "A facturer";

export type Job = {
  id: string;
  time: string;
  endTime: string;
  customer: string;
  city: string;
  address: string;
  technician: string;
  technicianInitials: string;
  equipmentCount: number;
  status: JobStatus;
  payment: PaymentStatus;
  amount: number;
  completeness: number;
  note?: string;
  incident?: string;
};

export const jobs: Job[] = [
  { id: "INT-2026-000123", time: "08:30", endTime: "10:15", customer: "Maison Lenoir", city: "Evry-Courcouronnes", address: "18 rue des Mazieres, 91000 Evry-Courcouronnes", technician: "Thomas Renard", technicianInitials: "TR", equipmentCount: 2, status: "Terminee", payment: "Paye", amount: 159, completeness: 100 },
  { id: "INT-2026-000124", time: "10:45", endTime: "12:00", customer: "Camille Dupont", city: "Corbeil-Essonnes", address: "7 avenue Carnot, 91100 Corbeil-Essonnes", technician: "Nora Bensaid", technicianInitials: "NB", equipmentCount: 1, status: "En cours", payment: "En attente", amount: 99, completeness: 62, note: "Acces par la cour. Interphone 24B." },
  { id: "INT-2026-000125", time: "11:30", endTime: "13:45", customer: "Cabinet Rivoli", city: "Paris 1er", address: "34 rue de Rivoli, 75001 Paris", technician: "Thomas Renard", technicianInitials: "TR", equipmentCount: 3, status: "Bloquee", payment: "A facturer", amount: 249, completeness: 48, incident: "Acces impossible a l'unite de la salle de reunion" },
  { id: "INT-2026-000126", time: "14:00", endTime: "15:30", customer: "Sarah Martin", city: "Massy", address: "5 allee du Japon, 91300 Massy", technician: "Leo Marchand", technicianInitials: "LM", equipmentCount: 2, status: "En route", payment: "En attente", amount: 159, completeness: 12, note: "Stationnement au parking visiteurs." },
  { id: "INT-2026-000127", time: "16:15", endTime: "17:30", customer: "Atelier Voltaire", city: "Paris 11e", address: "81 boulevard Voltaire, 75011 Paris", technician: "Nora Bensaid", technicianInitials: "NB", equipmentCount: 1, status: "Planifiee", payment: "A facturer", amount: 119, completeness: 0 },
];

export const activity = [
  { label: "Lun", planned: 7, completed: 6 }, { label: "Mar", planned: 9, completed: 8 },
  { label: "Mer", planned: 8, completed: 8 }, { label: "Jeu", planned: 11, completed: 9 },
  { label: "Ven", planned: 10, completed: 7 }, { label: "Sam", planned: 5, completed: 4 },
  { label: "Dim", planned: 2, completed: 2 },
];

export const alerts = [
  { level: "Critique", title: "Incident a examiner", detail: "INT-2026-000125 · Cabinet Rivoli", time: "il y a 18 min" },
  { level: "Attention", title: "Assurance bientot expiree", detail: "Leo Marchand · expiration dans 12 jours", time: "aujourd'hui" },
  { level: "Information", title: "Synchronisation Twenty retardee", detail: "3 evenements seront retentes automatiquement", time: "il y a 4 min" },
];
