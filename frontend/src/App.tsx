import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Complaint, ComplaintStatus, Lead, LeadStage, Product, User } from "./types";
import { jsPDF } from "jspdf";

type Tab = "dashboard" | "leads" | "complaints" | "kiosk";

const stages: LeadStage[] = ["NEW", "VERIFIED", "APPLIED", "APPROVED", "DISBURSED", "REJECTED"];
const complaintStatuses: ComplaintStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const kioskActions = ["BALANCE_CHECK", "MINI_STATEMENT", "CASH_DEPOSIT", "CASH_WITHDRAWAL", "FUND_TRANSFER", "BILL_PAYMENT"] as const;
const docServiceTypes = ["LOAN_APPLICATION", "ACCOUNT_OPENING", "INSURANCE_ENROLLMENT", "CARD_APPLICATION"] as const;
const ocrDocTypes = ["AADHAAR", "PAN", "BANK_STATEMENT", "SALARY_SLIP"] as const;
const languagePrompts = {
  en: "Welcome to BankSathi Kiosk. Please select your service.",
  hi: "BankSathi Kiosk mein swagat hai. Kripya seva chunen.",
  mr: "BankSathi Kiosk madhe tumcha swagat aahe. Krupaya seva nivda.",
  ta: "BankSathi Kiosk-kku varaverkirOm. Sevaith therivuseiyungal."
} as const;
type KioskUserType = "CUSTOMER" | "AGENT" | "ADMIN";
type KioskAction = (typeof kioskActions)[number];
type KioskDocService = (typeof docServiceTypes)[number];
type OcrDocType = (typeof ocrDocTypes)[number];
type WizardStep = 1 | 2 | 3 | 4;

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [kioskUserType, setKioskUserType] = useState<KioskUserType>("CUSTOMER");
  const [kioskFeatures, setKioskFeatures] = useState<string[]>([]);
  const [kioskResponse, setKioskResponse] = useState<string>("");
  const [kioskStatement, setKioskStatement] = useState<Array<{ date: string; type: string; amount: number }>>([]);
  const [docHelp, setDocHelp] = useState<{ requiredDocuments: string[]; formFields: string[]; helperHint: string } | null>(null);
  const [receipt, setReceipt] = useState<{
    receiptId: string;
    date: string;
    customerName: string;
    accountNumberMasked: string;
    service: string;
    amount: number;
    branch: string;
    status: string;
  } | null>(null);
  const [ocrForm, setOcrForm] = useState({
    documentType: "AADHAAR" as OcrDocType,
    fileName: ""
  });
  const [ocrResult, setOcrResult] = useState<{ confidence: number; extractedFields: Record<string, string>; suggestion: string } | null>(null);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi" | "mr" | "ta">("en");
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardService, setWizardService] = useState<KioskDocService>("LOAN_APPLICATION");
  const [wizardDocType, setWizardDocType] = useState<OcrDocType>("AADHAAR");
  const [wizardFields, setWizardFields] = useState<Record<string, string>>({});
  const [wizardReceiptId, setWizardReceiptId] = useState<string>("");
  const [balanceInsights, setBalanceInsights] = useState<{
    accountNumberMasked: string;
    currentBalance: number;
    avgMonthlyCredit: number;
    avgMonthlyDebit: number;
    savingsRate: number;
    advice: string[];
  } | null>(null);
  const [queryAssistantForm, setQueryAssistantForm] = useState({
    query: "",
    language: "en" as "en" | "hi" | "mr" | "ta"
  });
  const [queryAssistantResult, setQueryAssistantResult] = useState<{
    category: string;
    answer: string;
    escalate: boolean;
    ticketSuggestion: string | null;
  } | null>(null);
  const [kioskForm, setKioskForm] = useState({
    action: "BALANCE_CHECK" as KioskAction,
    accountNumber: "1234567890",
    amount: "",
    receiverAccount: ""
  });
  const [docForm, setDocForm] = useState({
    serviceType: "LOAN_APPLICATION" as KioskDocService,
    language: "en" as "en" | "hi" | "mr" | "ta"
  });
  const [receiptForm, setReceiptForm] = useState({
    customerName: "Demo Customer",
    service: "Cash Deposit",
    amount: "",
    accountNumber: "1234567890"
  });

  const [leadForm, setLeadForm] = useState({
    customerName: "",
    customerPhone: "",
    assignedAgentId: "",
    customerIncome: "",
    creditScore: "",
    monthlyObligations: "",
    productId: "",
    notes: ""
  });
  const [complaintForm, setComplaintForm] = useState({
    title: "",
    description: "",
    userId: "",
    leadId: "",
    language: "en"
  });

  const refresh = async () => {
    setError(null);
    const [agentList, productList, leadList, complaintList] = await Promise.all([
      api.listAgents(),
      api.listProducts(),
      api.listLeads(),
      api.listComplaints()
    ]);
    setAgents(agentList);
    setProducts(productList);
    setLeads(leadList);
    setComplaints(complaintList);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await api.bootstrap();
        await refresh();
        const kiosk = await api.kioskFeatures("CUSTOMER");
        setKioskFeatures(kiosk.features);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const loadKiosk = async () => {
      try {
        const data = await api.kioskFeatures(kioskUserType);
        setKioskFeatures(data.features);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    loadKiosk();
  }, [kioskUserType]);

  const topLeads = useMemo(() => leads.slice(0, 5), [leads]);
  const highPriorityComplaints = useMemo(() => complaints.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL"), [complaints]);
  const disbursedCount = useMemo(() => leads.filter((l) => l.stage === "DISBURSED").length, [leads]);

  const onCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLead({
        customerName: leadForm.customerName,
        customerPhone: leadForm.customerPhone,
        assignedAgentId: leadForm.assignedAgentId,
        customerIncome: leadForm.customerIncome ? Number(leadForm.customerIncome) : undefined,
        creditScore: leadForm.creditScore ? Number(leadForm.creditScore) : undefined,
        monthlyObligations: leadForm.monthlyObligations ? Number(leadForm.monthlyObligations) : undefined,
        productId: leadForm.productId || undefined,
        notes: leadForm.notes || undefined
      });
      setLeadForm({
        customerName: "",
        customerPhone: "",
        assignedAgentId: leadForm.assignedAgentId,
        customerIncome: "",
        creditScore: "",
        monthlyObligations: "",
        productId: "",
        notes: ""
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createComplaint({
        title: complaintForm.title,
        description: complaintForm.description,
        userId: complaintForm.userId,
        leadId: complaintForm.leadId || undefined,
        language: complaintForm.language
      });
      setComplaintForm({ ...complaintForm, title: "", description: "", leadId: "" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateLeadStage = async (id: string, stage: LeadStage) => {
    try {
      await api.updateLeadStage(id, stage);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateComplaintStatus = async (id: string, status: ComplaintStatus) => {
    try {
      await api.updateComplaintStatus(id, status);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runKioskAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setKioskResponse("");
    setKioskStatement([]);
    try {
      const result = await api.kioskBankingAction({
        userType: kioskUserType,
        action: kioskForm.action,
        accountNumber: kioskForm.accountNumber,
        amount: kioskForm.amount ? Number(kioskForm.amount) : undefined,
        receiverAccount: kioskForm.receiverAccount || undefined
      });

      if (result.availableBalance !== undefined) {
        setKioskResponse(`Ref ${result.referenceId}: Available balance is INR ${result.availableBalance.toFixed(2)}.`);
      } else if (result.transactions?.length) {
        setKioskStatement(result.transactions);
        setKioskResponse(`Ref ${result.referenceId}: Mini statement fetched.`);
      } else {
        setKioskResponse(`Ref ${result.referenceId}: ${result.message ?? "Action completed."}`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runDocumentHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.kioskDocumentHelp({
        serviceType: docForm.serviceType,
        language: docForm.language
      });
      setDocHelp({
        requiredDocuments: result.requiredDocuments,
        formFields: result.formFields,
        helperHint: result.helperHint
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runReceiptGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.kioskGenerateReceipt({
        userType: kioskUserType,
        accountNumber: receiptForm.accountNumber,
        service: receiptForm.service,
        amount: receiptForm.amount ? Number(receiptForm.amount) : undefined,
        customerName: receiptForm.customerName
      });
      setReceipt({
        receiptId: result.receiptId,
        date: result.date,
        customerName: result.customerName,
        accountNumberMasked: result.accountNumberMasked,
        service: result.service,
        amount: result.amount,
        branch: result.branch,
        status: result.status
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const downloadReceiptPdf = () => {
    if (!receipt) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("BankSathi Kiosk Receipt", 20, 20);
    doc.setFontSize(11);
    doc.text(`Receipt ID: ${receipt.receiptId}`, 20, 35);
    doc.text(`Date: ${new Date(receipt.date).toLocaleString()}`, 20, 43);
    doc.text(`Customer: ${receipt.customerName}`, 20, 51);
    doc.text(`Account: ${receipt.accountNumberMasked}`, 20, 59);
    doc.text(`Service: ${receipt.service}`, 20, 67);
    doc.text(`Amount: INR ${receipt.amount.toFixed(2)}`, 20, 75);
    doc.text(`Branch: ${receipt.branch}`, 20, 83);
    doc.text(`Status: ${receipt.status}`, 20, 91);
    doc.save(`${receipt.receiptId}.pdf`);
  };

  const runOcrExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.kioskOcrExtract({
        documentType: ocrForm.documentType,
        fileName: ocrForm.fileName || `sample-${ocrForm.documentType.toLowerCase()}.jpg`
      });
      setOcrResult({
        confidence: result.confidence,
        extractedFields: result.extractedFields,
        suggestion: result.suggestion
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runWizardOcr = async () => {
    try {
      const result = await api.kioskOcrExtract({
        documentType: wizardDocType,
        fileName: `wizard-${wizardDocType.toLowerCase()}.jpg`
      });
      setWizardFields(result.extractedFields);
      setWizardStep(3);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runWizardSubmit = async () => {
    try {
      const name = wizardFields.fullName || receiptForm.customerName || "Kiosk Customer";
      const accountNumber = wizardFields.accountNumber?.replace(/X/g, "1") || receiptForm.accountNumber || "1234567890";
      const result = await api.kioskGenerateReceipt({
        userType: kioskUserType,
        customerName: name,
        accountNumber,
        service: wizardService.replace(/_/g, " "),
        amount: receiptForm.amount ? Number(receiptForm.amount) : 0
      });
      setReceipt({
        receiptId: result.receiptId,
        date: result.date,
        customerName: result.customerName,
        accountNumberMasked: result.accountNumberMasked,
        service: result.service,
        amount: result.amount,
        branch: result.branch,
        status: result.status
      });
      setWizardReceiptId(result.receiptId);
      setWizardStep(4);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fetchBalanceInsights = async () => {
    try {
      const result = await api.kioskBalanceInsights({ accountNumber: kioskForm.accountNumber });
      setBalanceInsights(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runQueryAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.kioskQuerySolve({
        query: queryAssistantForm.query,
        language: queryAssistantForm.language
      });
      setQueryAssistantResult(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const speakGuide = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(languagePrompts[voiceLang]);
    utterance.lang = voiceLang === "en" ? "en-IN" : voiceLang === "hi" ? "hi-IN" : voiceLang === "mr" ? "mr-IN" : "ta-IN";
    synth.speak(utterance);
  };

  if (loading) return <div className="screen-center">Loading BankSathi...</div>;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>BankSathi AI Platform</h1>
          <p>Lead conversion, complaint intelligence, and assisted kiosk operations</p>
        </div>
        <button className="secondary" onClick={refresh}>Refresh</button>
      </header>

      <nav className="tabs">
        {(["dashboard", "leads", "complaints", "kiosk"] as const).map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {error && <div className="error">{error}</div>}

      {activeTab === "dashboard" && (
        <section className="grid">
          <div className="card stat"><h3>Total Leads</h3><strong>{leads.length}</strong></div>
          <div className="card stat"><h3>Disbursed</h3><strong>{disbursedCount}</strong></div>
          <div className="card stat"><h3>Open Complaints</h3><strong>{complaints.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length}</strong></div>
          <div className="card stat"><h3>High Priority Tickets</h3><strong>{highPriorityComplaints.length}</strong></div>

          <div className="card wide">
            <h3>Smart Lead Prioritization (ML)</h3>
            <table>
              <thead><tr><th>Name</th><th>Agent</th><th>Stage</th><th>ML Score</th></tr></thead>
              <tbody>
                {topLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.customerName}</td>
                    <td>{lead.assignedAgent?.fullName}</td>
                    <td>{lead.stage}</td>
                    <td>{lead.mlScore?.toFixed(1) ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "leads" && (
        <section className="grid split">
          <form className="card" onSubmit={onCreateLead}>
            <h3>Add Lead</h3>
            <input placeholder="Customer name" value={leadForm.customerName} onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })} required />
            <input placeholder="Customer phone" value={leadForm.customerPhone} onChange={(e) => setLeadForm({ ...leadForm, customerPhone: e.target.value })} required />
            <select value={leadForm.assignedAgentId} onChange={(e) => setLeadForm({ ...leadForm, assignedAgentId: e.target.value })} required>
              <option value="">Select agent</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
            </select>
            <select value={leadForm.productId} onChange={(e) => setLeadForm({ ...leadForm, productId: e.target.value })}>
              <option value="">Select product (optional)</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Monthly income" value={leadForm.customerIncome} onChange={(e) => setLeadForm({ ...leadForm, customerIncome: e.target.value })} />
            <input type="number" placeholder="Credit score" value={leadForm.creditScore} onChange={(e) => setLeadForm({ ...leadForm, creditScore: e.target.value })} />
            <input type="number" placeholder="Monthly obligations" value={leadForm.monthlyObligations} onChange={(e) => setLeadForm({ ...leadForm, monthlyObligations: e.target.value })} />
            <textarea placeholder="Notes" value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} />
            <button type="submit">Create Lead</button>
          </form>

          <div className="card">
            <h3>Lead Pipeline</h3>
            <div className="list">
              {leads.map((lead) => (
                <div className="item" key={lead.id}>
                  <div>
                    <strong>{lead.customerName}</strong>
                    <p>{lead.customerPhone} | ML: {lead.mlScore?.toFixed(1) ?? "N/A"} | Agent: {lead.assignedAgent.fullName}</p>
                  </div>
                  <select value={lead.stage} onChange={(e) => updateLeadStage(lead.id, e.target.value as LeadStage)}>
                    {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "complaints" && (
        <section className="grid split">
          <form className="card" onSubmit={onCreateComplaint}>
            <h3>Create Complaint</h3>
            <input placeholder="Title" value={complaintForm.title} onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })} required />
            <textarea placeholder="Describe issue" value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} required />
            <select value={complaintForm.userId} onChange={(e) => setComplaintForm({ ...complaintForm, userId: e.target.value })} required>
              <option value="">Raised by user</option>
              {agents.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
            <select value={complaintForm.leadId} onChange={(e) => setComplaintForm({ ...complaintForm, leadId: e.target.value })}>
              <option value="">Related lead (optional)</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.customerName}</option>)}
            </select>
            <select value={complaintForm.language} onChange={(e) => setComplaintForm({ ...complaintForm, language: e.target.value })}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="ta">Tamil</option>
            </select>
            <button type="submit">Submit Complaint</button>
          </form>

          <div className="card">
            <h3>Complaint Desk (AI Classified)</h3>
            <div className="list">
              {complaints.map((c) => (
                <div className="item" key={c.id}>
                  <div>
                    <strong>{c.ticketId} - {c.title}</strong>
                    <p>{c.category} | {c.priority} | {c.assignedTeam ?? "support"} | {c.language}</p>
                  </div>
                  <select value={c.status} onChange={(e) => updateComplaintStatus(c.id, e.target.value as ComplaintStatus)}>
                    {complaintStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "kiosk" && (
        <section className="grid">
          <div className="card wide">
            <h3>Kiosk Assisted Mode (All Users)</h3>
            <p>Supports customer, agent, and admin journeys with low-literacy friendly interaction.</p>
            <div className="kiosk-role-switch">
              <label>User type</label>
              <select value={kioskUserType} onChange={(e) => setKioskUserType(e.target.value as KioskUserType)}>
                <option value="CUSTOMER">Customer</option>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="kiosk-icons">
              <div className="icon-card">🏦<span>Loan</span></div>
              <div className="icon-card">💳<span>Card</span></div>
              <div className="icon-card">🛡️<span>Insurance</span></div>
              <div className="icon-card">⚠️<span>Complaint</span></div>
            </div>
            <div className="kiosk-features">
              {kioskFeatures.map((feature) => (
                <span key={feature} className="chip">{feature}</span>
              ))}
            </div>
            <div className="voice-guide">
              <select value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as "en" | "hi" | "mr" | "ta")}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
              </select>
              <button type="button" onClick={speakGuide}>Play Voice Guidance</button>
            </div>
            <p className="muted">Voice UX prompt: "Namaste! Aap kya service lena chahte hain?"</p>
          </div>

          <div className="card wide">
            <h3>Kiosk Assistant Wizard</h3>
            <p className="muted">Step-by-step flow for assisted users: service to OCR to auto-fill to receipt.</p>
            <div className="wizard-steps">
              <span className={wizardStep === 1 ? "chip active-chip" : "chip"}>1. Select Service</span>
              <span className={wizardStep === 2 ? "chip active-chip" : "chip"}>2. OCR Extract</span>
              <span className={wizardStep === 3 ? "chip active-chip" : "chip"}>3. Verify Form</span>
              <span className={wizardStep === 4 ? "chip active-chip" : "chip"}>4. Submit & Receipt</span>
            </div>

            {wizardStep === 1 && (
              <div className="assist-box">
                <label>Service</label>
                <select value={wizardService} onChange={(e) => setWizardService(e.target.value as KioskDocService)}>
                  {docServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <button type="button" onClick={() => setWizardStep(2)}>Next: OCR Step</button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="assist-box">
                <label>Document type for OCR</label>
                <select value={wizardDocType} onChange={(e) => setWizardDocType(e.target.value as OcrDocType)}>
                  {ocrDocTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <div className="wizard-actions">
                  <button type="button" onClick={() => setWizardStep(1)}>Back</button>
                  <button type="button" onClick={runWizardOcr}>Run OCR & Continue</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="assist-box">
                <p><strong>Auto-filled fields (editable):</strong></p>
                {Object.entries(wizardFields).map(([key, value]) => (
                  <input
                    key={key}
                    value={value}
                    onChange={(e) => setWizardFields({ ...wizardFields, [key]: e.target.value })}
                    placeholder={key}
                  />
                ))}
                <div className="wizard-actions">
                  <button type="button" onClick={() => setWizardStep(2)}>Back</button>
                  <button type="button" onClick={runWizardSubmit}>Submit & Generate Receipt</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="assist-box">
                <p><strong>Submission complete.</strong></p>
                <p>Receipt generated: {wizardReceiptId}</p>
                <div className="wizard-actions">
                  <button type="button" onClick={downloadReceiptPdf} disabled={!receipt}>Download PDF</button>
                  <button type="button" onClick={() => { setWizardStep(1); setWizardFields({}); setWizardReceiptId(""); }}>Start New Flow</button>
                </div>
              </div>
            )}
          </div>

          <div className="card wide">
            <h3>Basic Banking Features</h3>
            <form className="kiosk-form" onSubmit={runKioskAction}>
              <select value={kioskForm.action} onChange={(e) => setKioskForm({ ...kioskForm, action: e.target.value as KioskAction })}>
                {kioskActions.map((action) => (
                  <option value={action} key={action}>{action}</option>
                ))}
              </select>
              <input
                value={kioskForm.accountNumber}
                onChange={(e) => setKioskForm({ ...kioskForm, accountNumber: e.target.value })}
                placeholder="Account number"
                required
              />
              <input
                type="number"
                value={kioskForm.amount}
                onChange={(e) => setKioskForm({ ...kioskForm, amount: e.target.value })}
                placeholder="Amount (optional for balance/statement)"
              />
              <input
                value={kioskForm.receiverAccount}
                onChange={(e) => setKioskForm({ ...kioskForm, receiverAccount: e.target.value })}
                placeholder="Receiver account (for transfer)"
              />
              <button type="submit">Run Banking Action</button>
            </form>

            {kioskResponse && <p className="kiosk-result">{kioskResponse}</p>}
            {kioskStatement.length > 0 && (
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {kioskStatement.map((row, idx) => (
                    <tr key={`${row.date}-${idx}`}>
                      <td>{row.date}</td>
                      <td>{row.type}</td>
                      <td>{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button type="button" onClick={fetchBalanceInsights}>Get Balance Insights</button>
            {balanceInsights && (
              <div className="assist-box">
                <p><strong>Account:</strong> {balanceInsights.accountNumberMasked}</p>
                <p><strong>Current Balance:</strong> INR {balanceInsights.currentBalance.toFixed(2)}</p>
                <p><strong>Avg Monthly Credit:</strong> INR {balanceInsights.avgMonthlyCredit}</p>
                <p><strong>Avg Monthly Debit:</strong> INR {balanceInsights.avgMonthlyDebit}</p>
                <p><strong>Savings Rate:</strong> {balanceInsights.savingsRate.toFixed(2)}%</p>
                <strong>Suggestions</strong>
                <ul>{balanceInsights.advice.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="card wide">
            <h3>Query Solving Assistant</h3>
            <form className="kiosk-form" onSubmit={runQueryAssistant}>
              <input
                value={queryAssistantForm.query}
                onChange={(e) => setQueryAssistantForm({ ...queryAssistantForm, query: e.target.value })}
                placeholder="Ask query: loan delay, balance mismatch, KYC issue..."
                required
              />
              <select
                value={queryAssistantForm.language}
                onChange={(e) => setQueryAssistantForm({ ...queryAssistantForm, language: e.target.value as "en" | "hi" | "mr" | "ta" })}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
              </select>
              <button type="submit">Solve Query</button>
            </form>
            {queryAssistantResult && (
              <div className="assist-box">
                <p><strong>Category:</strong> {queryAssistantResult.category}</p>
                <p><strong>Response:</strong> {queryAssistantResult.answer}</p>
                <p><strong>Escalation:</strong> {queryAssistantResult.escalate ? "Yes" : "No"}</p>
                {queryAssistantResult.ticketSuggestion && <p><strong>Escalation Ticket:</strong> {queryAssistantResult.ticketSuggestion}</p>}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Document Filling Help</h3>
            <form onSubmit={runDocumentHelp}>
              <select value={docForm.serviceType} onChange={(e) => setDocForm({ ...docForm, serviceType: e.target.value as KioskDocService })}>
                {docServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={docForm.language} onChange={(e) => setDocForm({ ...docForm, language: e.target.value as "en" | "hi" | "mr" | "ta" })}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
              </select>
              <button type="submit">Get Document Checklist</button>
            </form>

            {docHelp && (
              <div className="assist-box">
                <strong>Required Documents</strong>
                <ul>{docHelp.requiredDocuments.map((item) => <li key={item}>{item}</li>)}</ul>
                <strong>Form Fields to Fill</strong>
                <ul>{docHelp.formFields.map((item) => <li key={item}>{item}</li>)}</ul>
                <p className="muted">{docHelp.helperHint}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Bank Receipt Generator</h3>
            <form onSubmit={runReceiptGeneration}>
              <input value={receiptForm.customerName} onChange={(e) => setReceiptForm({ ...receiptForm, customerName: e.target.value })} placeholder="Customer name" required />
              <input value={receiptForm.service} onChange={(e) => setReceiptForm({ ...receiptForm, service: e.target.value })} placeholder="Service name" required />
              <input value={receiptForm.accountNumber} onChange={(e) => setReceiptForm({ ...receiptForm, accountNumber: e.target.value })} placeholder="Account number" required />
              <input type="number" value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} placeholder="Amount" />
              <button type="submit">Generate Receipt</button>
            </form>

            {receipt && (
              <div className="assist-box">
                <p><strong>Receipt ID:</strong> {receipt.receiptId}</p>
                <p><strong>Date:</strong> {new Date(receipt.date).toLocaleString()}</p>
                <p><strong>Customer:</strong> {receipt.customerName}</p>
                <p><strong>Account:</strong> {receipt.accountNumberMasked}</p>
                <p><strong>Service:</strong> {receipt.service}</p>
                <p><strong>Amount:</strong> INR {receipt.amount.toFixed(2)}</p>
                <p><strong>Branch:</strong> {receipt.branch}</p>
                <p><strong>Status:</strong> {receipt.status}</p>
                <button type="button" onClick={downloadReceiptPdf}>Download PDF Receipt</button>
              </div>
            )}
          </div>

          <div className="card wide">
            <h3>Auto Form Filling (OCR Simulation)</h3>
            <form className="kiosk-form" onSubmit={runOcrExtract}>
              <select value={ocrForm.documentType} onChange={(e) => setOcrForm({ ...ocrForm, documentType: e.target.value as OcrDocType })}>
                {ocrDocTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input
                value={ocrForm.fileName}
                onChange={(e) => setOcrForm({ ...ocrForm, fileName: e.target.value })}
                placeholder="Document file name (example: aadhaar.jpg)"
              />
              <button type="submit">Extract & Auto-fill</button>
            </form>
            {ocrResult && (
              <div className="assist-box">
                <p><strong>Confidence:</strong> {(ocrResult.confidence * 100).toFixed(1)}%</p>
                {Object.entries(ocrResult.extractedFields).map(([key, value]) => (
                  <p key={key}><strong>{key}:</strong> {value}</p>
                ))}
                <p className="muted">{ocrResult.suggestion}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
