import type { Complaint, ComplaintStatus, Lead, LeadStage, Product, User } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API ${res.status}: ${errBody}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => call<{ admin: User; agent: User; products: Product[] }>("/api/bootstrap", { method: "POST" }),
  listAgents: () => call<User[]>("/api/users?role=AGENT"),
  listProducts: () => call<Product[]>("/api/products"),
  listLeads: () => call<Lead[]>("/api/leads"),
  createLead: (payload: {
    customerName: string;
    customerPhone: string;
    assignedAgentId: string;
    customerIncome?: number;
    creditScore?: number;
    monthlyObligations?: number;
    productId?: string;
    notes?: string;
  }) => call<Lead>("/api/leads", { method: "POST", body: JSON.stringify(payload) }),
  updateLeadStage: (leadId: string, stage: LeadStage) =>
    call<Lead>(`/api/leads/${leadId}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
  listComplaints: () => call<Complaint[]>("/api/complaints"),
  createComplaint: (payload: { title: string; description: string; userId: string; leadId?: string; language: string }) =>
    call<Complaint>("/api/complaints", { method: "POST", body: JSON.stringify(payload) }),
  updateComplaintStatus: (id: string, status: ComplaintStatus) =>
    call<Complaint>(`/api/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  kioskFeatures: (userType: "CUSTOMER" | "AGENT" | "ADMIN") =>
    call<{ userType: string; features: string[]; languages: string[]; accessibility: string[] }>(
      `/api/kiosk/features?userType=${userType}`
    ),
  kioskBankingAction: (payload: {
    userType: "CUSTOMER" | "AGENT" | "ADMIN";
    action: "BALANCE_CHECK" | "MINI_STATEMENT" | "CASH_DEPOSIT" | "CASH_WITHDRAWAL" | "FUND_TRANSFER" | "BILL_PAYMENT";
    accountNumber: string;
    amount?: number;
    receiverAccount?: string;
  }) => call<{ referenceId: string; message?: string; availableBalance?: number; transactions?: Array<{ date: string; type: string; amount: number }> }>(
    "/api/kiosk/banking-action",
    { method: "POST", body: JSON.stringify(payload) }
  ),
  kioskDocumentHelp: (payload: {
    serviceType: "LOAN_APPLICATION" | "ACCOUNT_OPENING" | "INSURANCE_ENROLLMENT" | "CARD_APPLICATION";
    language: "en" | "hi" | "mr" | "ta";
  }) =>
    call<{ serviceType: string; requiredDocuments: string[]; formFields: string[]; helperHint: string }>(
      "/api/kiosk/document-help",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  kioskGenerateReceipt: (payload: {
    userType: "CUSTOMER" | "AGENT" | "ADMIN";
    accountNumber: string;
    service: string;
    amount?: number;
    customerName: string;
  }) =>
    call<{
      receiptId: string;
      date: string;
      userType: string;
      customerName: string;
      accountNumberMasked: string;
      service: string;
      amount: number;
      branch: string;
      status: string;
      note: string;
    }>("/api/kiosk/generate-receipt", { method: "POST", body: JSON.stringify(payload) })
  ,
  kioskOcrExtract: (payload: {
    documentType: "AADHAAR" | "PAN" | "BANK_STATEMENT" | "SALARY_SLIP";
    fileName: string;
  }) =>
    call<{
      documentType: string;
      fileName: string;
      confidence: number;
      extractedFields: Record<string, string>;
      suggestion: string;
    }>("/api/kiosk/ocr-extract", { method: "POST", body: JSON.stringify(payload) }),
  kioskBalanceInsights: (payload: { accountNumber: string }) =>
    call<{
      accountNumberMasked: string;
      currentBalance: number;
      avgMonthlyCredit: number;
      avgMonthlyDebit: number;
      savingsRate: number;
      advice: string[];
    }>("/api/kiosk/balance-insights", { method: "POST", body: JSON.stringify(payload) }),
  kioskQuerySolve: (payload: { query: string; language: "en" | "hi" | "mr" | "ta" }) =>
    call<{
      category: string;
      answer: string;
      escalate: boolean;
      ticketSuggestion: string | null;
    }>("/api/kiosk/query-solve", { method: "POST", body: JSON.stringify(payload) })
};
