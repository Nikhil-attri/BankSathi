export type Role = "AGENT" | "ADMIN";
export type LeadStage = "NEW" | "VERIFIED" | "APPLIED" | "APPROVED" | "DISBURSED" | "REJECTED";
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  preferredLang: string;
}

export interface Product {
  id: string;
  name: string;
  type: string;
  provider: string;
  minInterest: number | null;
  maxInterest: number | null;
}

export interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerIncome: number | null;
  creditScore: number | null;
  monthlyObligations: number | null;
  stage: LeadStage;
  mlScore: number | null;
  notes: string | null;
  product?: Product | null;
  assignedAgent: User;
}

export interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: ComplaintStatus;
  language: string;
  assignedTeam: string | null;
  user: User;
  lead?: Lead | null;
}
