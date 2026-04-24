import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { ComplaintCategory, ComplaintPriority, LeadStage, Role } from "@prisma/client";
import { prisma } from "./prisma";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const mlBaseUrl = process.env.ML_BASE_URL ?? "http://localhost:8000";

const computeSlaDeadline = (priority: ComplaintPriority): Date => {
  const now = Date.now();
  const hours = priority === "CRITICAL" ? 4 : priority === "HIGH" ? 8 : priority === "MEDIUM" ? 24 : 48;
  return new Date(now + hours * 60 * 60 * 1000);
};

const getComplaintPriority = (incoming: string): ComplaintPriority => {
  if (incoming === "HIGH") return "HIGH";
  if (incoming === "LOW") return "LOW";
  if (incoming === "CRITICAL") return "CRITICAL";
  return "MEDIUM";
};

const getComplaintCategory = (incoming: string): ComplaintCategory => {
  const allowed = new Set(["LOAN", "KYC", "PAYMENT", "FRAUD", "TECHNICAL", "OTHER"]);
  return allowed.has(incoming) ? (incoming as ComplaintCategory) : "OTHER";
};

const inferLeadScore = async (input: {
  income?: number;
  creditScore?: number;
  monthlyObligations?: number;
  complaintCount?: number;
}): Promise<number | null> => {
  try {
    const response = await fetch(`${mlBaseUrl}/score-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        income: input.income ?? 0,
        credit_score: input.creditScore ?? 300,
        monthly_obligations: input.monthlyObligations ?? 0,
        complaint_count: input.complaintCount ?? 0
      })
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { score: number };
    return data.score ?? null;
  } catch {
    return null;
  }
};

const classifyComplaint = async (text: string, language: string) => {
  try {
    const response = await fetch(`${mlBaseUrl}/classify-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language })
    });
    if (!response.ok) return null;
    return (await response.json()) as {
      category: string;
      priority: string;
      sentiment: string;
      assigned_team: string;
    };
  } catch {
    return null;
  }
};

type KioskUserType = "CUSTOMER" | "AGENT" | "ADMIN";
type BankingActionType = "BALANCE_CHECK" | "MINI_STATEMENT" | "CASH_DEPOSIT" | "CASH_WITHDRAWAL" | "FUND_TRANSFER" | "BILL_PAYMENT";
type KioskServiceType = "LOAN_APPLICATION" | "ACCOUNT_OPENING" | "INSURANCE_ENROLLMENT" | "CARD_APPLICATION";

const kioskFeatureMap: Record<KioskUserType, string[]> = {
  CUSTOMER: ["Apply Loan", "Raise Complaint", "Balance Check", "Mini Statement", "Bill Payment"],
  AGENT: ["Lead Onboarding", "KYC Assist", "Loan Application", "Cash Services", "Complaint Registration"],
  ADMIN: ["Kiosk Monitoring", "Agent Performance", "Risk Alerts", "Complaint SLA", "Settlement Reports"]
};

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, service: "backend" });
});

app.post("/api/bootstrap", async (_req, res) => {
  const [admin, agent] = await Promise.all([
    prisma.user.upsert({
      where: { phone: "9000000001" },
      update: {},
      create: {
        fullName: "Admin User",
        phone: "9000000001",
        email: "admin@banksathi.local",
        role: "ADMIN",
        kycVerified: true
      }
    }),
    prisma.user.upsert({
      where: { phone: "9000000002" },
      update: {},
      create: {
        fullName: "Rohit Sathi",
        phone: "9000000002",
        email: "agent@banksathi.local",
        role: "AGENT",
        kycVerified: true,
        preferredLang: "hi"
      }
    })
  ]);

  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: "cma1loanpersonal0000000000001" },
      update: {},
      create: {
        id: "cma1loanpersonal0000000000001",
        name: "Personal Loan - QuickCash",
        type: "loan_personal",
        provider: "ABC Finance",
        minInterest: 10.99,
        maxInterest: 16.5
      }
    }),
    prisma.product.upsert({
      where: { id: "cma1creditcard00000000000002" },
      update: {},
      create: {
        id: "cma1creditcard00000000000002",
        name: "Rewards Credit Card",
        type: "credit_card",
        provider: "XYZ Bank",
        minInterest: 24,
        maxInterest: 36
      }
    })
  ]);

  return res.json({ admin, agent, products });
});

app.get("/api/users", async (req, res) => {
  const role = z.nativeEnum(Role).optional().safeParse(req.query.role);
  const users = await prisma.user.findMany({
    where: role.success && role.data ? { role: role.data } : undefined,
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
});

app.post("/api/auth/login", async (req, res) => {
  const payload = z
    .object({
      phone: z.string().min(8)
    })
    .safeParse(req.body);
  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  const user = await prisma.user.findUnique({ where: { phone: payload.data.phone } });
  if (!user) return res.status(404).json({ error: "User not found. Run /api/bootstrap first." });
  return res.json({ user, token: `demo-token-${user.id}` });
});

app.get("/api/products", async (_req, res) => {
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  res.json(products);
});

app.post("/api/leads", async (req, res) => {
  const payload = z
    .object({
      customerName: z.string().min(2),
      customerPhone: z.string().min(8),
      assignedAgentId: z.string().min(5),
      customerIncome: z.number().optional(),
      creditScore: z.number().int().min(300).max(900).optional(),
      monthlyObligations: z.number().optional(),
      productId: z.string().optional(),
      notes: z.string().optional()
    })
    .safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({ error: payload.error.flatten() });
  }

  const leadScore = await inferLeadScore({
    income: payload.data.customerIncome,
    creditScore: payload.data.creditScore,
    monthlyObligations: payload.data.monthlyObligations
  });

  const lead = await prisma.lead.create({
    data: {
      customerName: payload.data.customerName,
      customerPhone: payload.data.customerPhone,
      assignedAgentId: payload.data.assignedAgentId,
      customerIncome: payload.data.customerIncome,
      creditScore: payload.data.creditScore,
      productId: payload.data.productId,
      notes: payload.data.notes,
      mlScore: leadScore
    }
  });
  return res.status(201).json(lead);
});

app.patch("/api/leads/:leadId/stage", async (req, res) => {
  const params = z.object({ leadId: z.string().min(5) }).safeParse(req.params);
  const payload = z.object({ stage: z.nativeEnum(LeadStage) }).safeParse(req.body);
  if (!params.success || !payload.success) {
    return res.status(400).json({ error: "Invalid stage update payload." });
  }
  const lead = await prisma.lead.update({
    where: { id: params.data.leadId },
    data: { stage: payload.data.stage }
  });
  return res.json(lead);
});

app.get("/api/leads", async (_req, res) => {
  const leads = await prisma.lead.findMany({
    include: { assignedAgent: true, product: true },
    orderBy: [{ mlScore: "desc" }, { createdAt: "desc" }]
  });
  res.json(leads);
});

app.post("/api/complaints", async (req, res) => {
  const payload = z
    .object({
      title: z.string().min(3),
      description: z.string().min(5),
      userId: z.string().min(5),
      leadId: z.string().optional(),
      language: z.string().default("en")
    })
    .safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({ error: payload.error.flatten() });
  }

  const mlResult = await classifyComplaint(payload.data.description, payload.data.language);
  const priority = getComplaintPriority(mlResult?.priority ?? "MEDIUM");
  const category = getComplaintCategory(mlResult?.category ?? "OTHER");
  const ticketId = `BKS-${Date.now().toString().slice(-8)}`;
  const complaint = await prisma.complaint.create({
    data: {
      ...payload.data,
      ticketId,
      category,
      priority,
      assignedTeam: mlResult?.assigned_team ?? "support",
      sentimentScore: mlResult?.sentiment === "negative" ? -1 : mlResult?.sentiment === "positive" ? 1 : 0,
      slaDeadline: computeSlaDeadline(priority)
    }
  });

  return res.status(201).json(complaint);
});

app.get("/api/complaints", async (_req, res) => {
  const complaints = await prisma.complaint.findMany({
    include: { user: true, lead: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });
  res.json(complaints);
});

app.patch("/api/complaints/:id/status", async (req, res) => {
  const params = z.object({ id: z.string().min(5) }).safeParse(req.params);
  const payload = z
    .object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) })
    .safeParse(req.body);
  if (!params.success || !payload.success) return res.status(400).json({ error: "Invalid complaint update payload." });

  const complaint = await prisma.complaint.update({
    where: { id: params.data.id },
    data: { status: payload.data.status }
  });
  return res.json(complaint);
});

app.get("/api/kiosk/features", (req, res) => {
  const payload = z
    .object({
      userType: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).default("CUSTOMER")
    })
    .safeParse(req.query);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });
  return res.json({
    userType: payload.data.userType,
    features: kioskFeatureMap[payload.data.userType],
    languages: ["en", "hi", "mr", "ta"],
    accessibility: ["voice-guidance", "large-buttons", "icon-navigation", "assisted-mode"]
  });
});

app.post("/api/kiosk/banking-action", async (req, res) => {
  const payload = z
    .object({
      userType: z.enum(["CUSTOMER", "AGENT", "ADMIN"]),
      action: z.enum(["BALANCE_CHECK", "MINI_STATEMENT", "CASH_DEPOSIT", "CASH_WITHDRAWAL", "FUND_TRANSFER", "BILL_PAYMENT"]),
      accountNumber: z.string().min(6),
      amount: z.number().nonnegative().optional(),
      receiverAccount: z.string().optional()
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  const baseResponse = {
    referenceId: `KSK-${Date.now().toString().slice(-9)}`,
    userType: payload.data.userType,
    action: payload.data.action as BankingActionType
  };

  if (payload.data.action === "BALANCE_CHECK") {
    return res.json({ ...baseResponse, success: true, availableBalance: 57250.35, message: "Balance fetched successfully." });
  }
  if (payload.data.action === "MINI_STATEMENT") {
    return res.json({
      ...baseResponse,
      success: true,
      transactions: [
        { date: "2026-04-22", type: "credit", amount: 14000 },
        { date: "2026-04-21", type: "debit", amount: 3500 },
        { date: "2026-04-20", type: "debit", amount: 799 }
      ]
    });
  }
  if ((payload.data.action === "CASH_DEPOSIT" || payload.data.action === "CASH_WITHDRAWAL" || payload.data.action === "BILL_PAYMENT") && !payload.data.amount) {
    return res.status(400).json({ error: "Amount is required for this action." });
  }
  if (payload.data.action === "FUND_TRANSFER" && (!payload.data.amount || !payload.data.receiverAccount)) {
    return res.status(400).json({ error: "Amount and receiver account are required for transfer." });
  }

  return res.json({
    ...baseResponse,
    success: true,
    amount: payload.data.amount ?? 0,
    receiverAccount: payload.data.receiverAccount ?? null,
    message: "Transaction simulated successfully. Use bank APIs for live settlement."
  });
});

app.post("/api/kiosk/document-help", (req, res) => {
  const payload = z
    .object({
      serviceType: z.enum(["LOAN_APPLICATION", "ACCOUNT_OPENING", "INSURANCE_ENROLLMENT", "CARD_APPLICATION"]),
      language: z.enum(["en", "hi", "mr", "ta"]).default("en")
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  const requirements: Record<KioskServiceType, string[]> = {
    LOAN_APPLICATION: ["Aadhaar Card", "PAN Card", "Last 3 month bank statement", "Income proof"],
    ACCOUNT_OPENING: ["Aadhaar Card", "PAN Card", "Passport-size photo", "Address proof"],
    INSURANCE_ENROLLMENT: ["Aadhaar Card", "Medical history (if applicable)", "Nominee details"],
    CARD_APPLICATION: ["Aadhaar Card", "PAN Card", "Salary slip or income proof"]
  };

  const hintsByLanguage: Record<string, string> = {
    en: "Upload clear front-side images. Ensure all text is readable.",
    hi: "Saf photo upload karein, text saaf dikhna chahiye.",
    mr: "Document cha photo spashta asava ani text vachnyas sope asave.",
    ta: "Document photo thelivaga upload seiyungal; text clear-a irukkanum."
  };

  return res.json({
    serviceType: payload.data.serviceType,
    requiredDocuments: requirements[payload.data.serviceType],
    formFields: ["Full Name", "Mobile Number", "Date of Birth", "Address", "Occupation"],
    helperHint: hintsByLanguage[payload.data.language]
  });
});

app.post("/api/kiosk/generate-receipt", (req, res) => {
  const payload = z
    .object({
      userType: z.enum(["CUSTOMER", "AGENT", "ADMIN"]),
      accountNumber: z.string().min(6),
      service: z.string().min(3),
      amount: z.number().nonnegative().optional(),
      customerName: z.string().min(2)
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  const now = new Date();
  return res.json({
    receiptId: `RCP-${Date.now().toString().slice(-10)}`,
    date: now.toISOString(),
    userType: payload.data.userType,
    customerName: payload.data.customerName,
    accountNumberMasked: `XXXXXX${payload.data.accountNumber.slice(-4)}`,
    service: payload.data.service,
    amount: payload.data.amount ?? 0,
    branch: "BankSathi Kiosk Branch - Demo",
    status: "SUCCESS",
    note: "This is a demo receipt. Integrate CBS/bank APIs for production settlement."
  });
});

app.post("/api/kiosk/ocr-extract", (req, res) => {
  const payload = z
    .object({
      documentType: z.enum(["AADHAAR", "PAN", "BANK_STATEMENT", "SALARY_SLIP"]),
      fileName: z.string().min(3)
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  const extractedByType: Record<string, Record<string, string>> = {
    AADHAAR: {
      fullName: "Ravi Kumar",
      aadhaarNumber: "XXXX-XXXX-1234",
      dob: "1995-08-12",
      address: "Lucknow, Uttar Pradesh"
    },
    PAN: {
      fullName: "Ravi Kumar",
      panNumber: "ABCDE1234F",
      fatherName: "Mahesh Kumar"
    },
    BANK_STATEMENT: {
      accountNumber: "XXXXXX7890",
      avgMonthlyCredit: "55000",
      avgMonthlyDebit: "33200"
    },
    SALARY_SLIP: {
      employer: "ABC Pvt Ltd",
      netSalary: "62000",
      month: "March 2026"
    }
  };

  return res.json({
    documentType: payload.data.documentType,
    fileName: payload.data.fileName,
    confidence: 0.94,
    extractedFields: extractedByType[payload.data.documentType],
    suggestion: "Auto-fill recommended. Please verify before submission."
  });
});

app.post("/api/kiosk/balance-insights", (req, res) => {
  const payload = z
    .object({
      accountNumber: z.string().min(6)
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });

  return res.json({
    accountNumberMasked: `XXXXXX${payload.data.accountNumber.slice(-4)}`,
    currentBalance: 57250.35,
    avgMonthlyCredit: 55000,
    avgMonthlyDebit: 33200,
    savingsRate: 39.64,
    advice: [
      "You maintain a healthy savings pattern.",
      "Set auto-transfer of INR 3000 monthly to recurring deposit.",
      "Avoid late utility bill payments to improve credit profile."
    ]
  });
});

app.post("/api/kiosk/query-solve", (req, res) => {
  const payload = z
    .object({
      query: z.string().min(4),
      language: z.enum(["en", "hi", "mr", "ta"]).default("en")
    })
    .safeParse(req.body);

  if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });
  const q = payload.data.query.toLowerCase();

  let answer = "Your query is received. A support executive will assist shortly.";
  let category = "GENERAL";
  let escalate = false;

  if (q.includes("balance")) {
    category = "ACCOUNT";
    answer = "Use Balance Check in Banking Features. If mismatch remains, raise a ticket with last transaction details.";
  } else if (q.includes("loan") && (q.includes("delay") || q.includes("status"))) {
    category = "LOAN";
    answer = "Loan status is usually updated within 24 hours after verification. Please keep application ID ready.";
  } else if (q.includes("fraud") || q.includes("money deducted") || q.includes("scam")) {
    category = "FRAUD";
    answer = "Immediate escalation triggered. Block the account/card and submit complaint with transaction reference.";
    escalate = true;
  } else if (q.includes("kyc") || q.includes("aadhaar") || q.includes("pan")) {
    category = "KYC";
    answer = "For KYC issues, re-upload clear Aadhaar and PAN images. Ensure name and DOB exactly match.";
  }

  return res.json({
    category,
    answer,
    escalate,
    ticketSuggestion: escalate ? `ESC-${Date.now().toString().slice(-7)}` : null
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Backend running on ${port}`);
});
