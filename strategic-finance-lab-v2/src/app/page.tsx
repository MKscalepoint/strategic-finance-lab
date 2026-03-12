"use client";

import { useState, useRef, useEffect } from "react";
import { QUESTIONS } from "@/lib/prompt";
import { ArrowRight, RotateCcw, Send, FileText, Table, X, ChevronDown } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

type Stage = "landing" | "select" | "subsector" | "intake" | "analysis";
type EmailStatus = "idle" | "sending" | "sent" | "error";
type SendChoice = "none" | "both" | "report" | "model";
type DomainState = "inactive" | "touched" | "active";
type ScenarioKey = "base" | "upside" | "downside";
type IntakeStep = 0 | 1 | 2 | 3; // 0=revenue model, 1=scale, 2=concern, 3=prompt

const SUBSECTORS = [
  { id: "processor", label: "Payments Processor", desc: "Card acquiring, switching, gateway" },
  { id: "fx", label: "FX / Cross-border", desc: "FX forwards, remittance, international payments" },
  { id: "merchant", label: "Merchant Platform", desc: "POS, SME payments, merchant acquiring" },
  { id: "infrastructure", label: "Core Banking / Infrastructure", desc: "Banking-as-a-service platform, core systems" },
  { id: "baas", label: "BaaS / Embedded Finance", desc: "Embedded payments, lending, or banking products" },
  { id: "issuing", label: "Card Issuing", desc: "Prepaid, credit or debit card programmes" },
  { id: "openbanking", label: "Open Banking / A2A", desc: "Account-to-account payments, VRP, data services" },
];

const REVENUE_MODELS = [
  "Per transaction fee",
  "Spread on volume / FX margin",
  "Monthly platform or SaaS fee",
  "Implementation fee + recurring licence",
  "Interchange share",
  "Interest income on balances",
  "Blended / multiple streams",
];

const ARR_BANDS = [
  "Pre-revenue",
  "Under £500k ARR",
  "£500k – £2m ARR",
  "£2m – £5m ARR",
  "£5m – £20m ARR",
  "£20m+ ARR",
];

const CONCERNS: Record<string, string[]> = {
  processor: ["Margin compression at volume", "Scheme fee exposure", "Client concentration", "Fraud and risk cost", "Geographic expansion complexity"],
  fx: ["Corridor profitability", "Hedge cost at scale", "Regulatory capital requirements", "Operational cost per trade", "Spread compression"],
  merchant: ["CAC vs LTV deterioration", "Merchant churn in lower cohorts", "Support cost scaling", "Take rate pressure", "Activation rates"],
  infrastructure: ["Implementation bottleneck", "Bespoke vs productised delivery", "Recurring vs one-time revenue mix", "Engineering split", "Sales cycle length"],
  baas: ["Partner onboarding complexity", "Compliance cost growth", "Balance sheet requirements", "Integration bespoke work", "Partner concentration"],
  issuing: ["Programme economics", "Interchange dependency", "Fraud exposure", "BIN sponsorship risk", "Cardholder acquisition cost"],
  openbanking: ["Monetisation clarity", "API reliability and SLA cost", "Bank partnership dependency", "Regulatory change exposure", "Volume to fee conversion"],
};

const DEFAULT_CONCERNS = ["Margin pressure", "Cost structure", "Capital efficiency", "Team scaling", "Revenue quality"];

// Q1 multiple choice options per subsector (what the business does / how it works)
const Q1_OPTIONS: Record<string, string[]> = {
  processor: ["Card acquiring for merchants", "Payment switching / routing", "Gateway services only", "Full-stack acquiring + gateway", "White-label processing for other issuers"],
  fx: ["FX forwards / hedging for corporates", "Remittance / consumer cross-border", "B2B international payments platform", "Treasury infrastructure / FX-as-a-service", "Multi-currency accounts + FX execution"],
  merchant: ["POS hardware + payments for SMEs", "Online checkout / e-commerce payments", "Marketplace payments infrastructure", "Vertical SaaS with embedded payments", "Multi-channel merchant acquiring"],
  infrastructure: ["Core banking platform (SaaS)", "Banking infrastructure / BaaS platform", "Payments infrastructure for fintechs", "Ledger / money movement infrastructure", "Compliance and regulatory infrastructure"],
  baas: ["Embedded banking for non-financial brands", "Lending-as-a-service", "Card issuing for fintechs", "Savings / deposits infrastructure", "Full-stack BaaS (accounts + cards + payments)"],
  issuing: ["Prepaid programme management", "Credit card issuing", "Corporate / expense card programme", "Virtual card infrastructure", "Debit card programme for fintechs"],
  openbanking: ["Payment initiation (PIS)", "Account information services (AIS)", "Variable recurring payments (VRP)", "Open banking data platform", "Account-to-account checkout product"],
};

// Extract <options> tag from model response
function extractOptions(text: string): string[] {
  const match = text.match(/<options>([\s\S]*?)<\/options>/);
  if (!match) return [];
  return match[1].split("|").map(s => s.trim()).filter(Boolean);
}

// Strip <options> tag from displayed text  
function stripOptionsTag(text: string): string {
  return text.replace(/<options>[\s\S]*?<\/options>/g, "").trim();
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SelectedQuestion {
  id: number;
  label: string;
  question: string;
  description: string;
}

interface Domain {
  id: number;
  label: string;
  short: string;
  question: string;
  description: string;
}

interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

interface ChartScenario {
  data: ChartDataPoint[];
  summary?: string;
}

interface ChartSpec {
  type: "line" | "bar";
  title: string;
  subtitle?: string;
  xKey: string;
  yKey: string;
  yLabel?: string;
  scenarios: {
    base: ChartScenario;
    upside: ChartScenario;
    downside: ChartScenario;
  };
}

const DOMAINS: Domain[] = [
  {
    id: 1,
    label: "Growth Quality",
    short: "Growth Quality",
    question: "Is the growth we are seeing real, structural and repeatable — or are we riding a wave?",
    description: "Examines whether growth is driven by structural demand, improving cohort economics, and repeatable acquisition — or by temporary tailwinds that will fade.",
  },
  {
    id: 2,
    label: "Scaling Behaviour",
    short: "Scaling Behaviour",
    question: "How does this business behave at two or three times its current scale?",
    description: "Examines how margins, operating complexity, and cost structure respond as revenue compounds — and where leverage and friction emerge.",
  },
  {
    id: 3,
    label: "Profitability Path",
    short: "Profitability Path",
    question: "What does the path to profitability actually look like for this business?",
    description: "Maps the specific conditions, thresholds, and sequencing that determine when and whether profitability is achievable.",
  },
  {
    id: 4,
    label: "Capital Allocation",
    short: "Capital Allocation",
    question: "Where should this business allocate its next dollar of capital?",
    description: "Evaluates competing investment options through the lens of structural return, sequencing logic, and runway impact.",
  },
  {
    id: 5,
    label: "Hiring Ahead",
    short: "Hiring Ahead",
    question: "Can this business afford to hire ahead of revenue?",
    description: "Examines whether headcount investment accelerates the system or destabilises it — and what conditions must hold for hiring to pay off.",
  },
];

// Extract domain numbers from model-emitted <domains> tag
function extractDomains(text: string): number[] {
  const match = text.match(/<domains>([\d,\s]+)<\/domains>/);
  if (!match) return [];
  return match[1].split(",").map(s => parseInt(s.trim())).filter(n => n >= 1 && n <= 5);
}

// Strip <domains> tag from displayed text
function stripDomainTag(text: string): string {
  return text.replace(/<domains>[\d,\s]*<\/domains>/g, "").trim();
}

// During streaming: hide any partial or complete chart/options block so raw JSON never shows
function hideChartBlock(text: string): string {
  let clean = text.replace(/<chart>[\s\S]*?<\/chart>/g, "");
  const partialStart = clean.indexOf("<chart>");
  if (partialStart !== -1) clean = clean.substring(0, partialStart);
  clean = stripOptionsTag(stripDomainTag(clean));
  return clean.trim();
}

// Extract chart JSON and strip all hidden tags from text
function extractChart(text: string): { clean: string; chart: ChartSpec | null } {
  const match = text.match(/<chart>([\s\S]*?)<\/chart>/);
  let chart: ChartSpec | null = null;
  if (match) {
    try { chart = JSON.parse(match[1].trim()) as ChartSpec; } catch {}
  }
  const clean = stripOptionsTag(stripDomainTag(
    text.replace(/<chart>[\s\S]*?<\/chart>/g, "")
  )).trim();
  return { clean, chart };
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, (m) =>
      m.startsWith("<") ? m : `<p>${m}</p>`
    );
}

// Chart component
function ChartBlock({ spec }: { spec: ChartSpec }) {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");
  const scenario = spec.scenarios[activeScenario];

  const COLORS = {
    base: "#2E75B6",
    upside: "#1a9a5c",
    downside: "#c0392b",
  };

  const scenarioColor = COLORS[activeScenario];

  return (
    <div className="my-6 border border-mist bg-white/60 p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-ink">{spec.title}</p>
          {spec.subtitle && <p className="text-xs text-slate mt-0.5">{spec.subtitle}</p>}
        </div>
        {/* Scenario switcher */}
        <div className="flex gap-1">
          {(["base", "upside", "downside"] as ScenarioKey[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveScenario(s)}
              className={`px-3 py-1 text-xs font-mono tracking-wide transition-all border ${
                activeScenario === s
                  ? s === "base" ? "bg-accent text-paper border-accent"
                  : s === "upside" ? "bg-green-600 text-white border-green-600"
                  : "bg-red-600 text-white border-red-600"
                  : "bg-transparent text-slate border-mist hover:border-slate"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        {spec.type === "line" ? (
          <LineChart data={scenario.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 11, fill: "#888" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#aaa" } } : undefined} />
            <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #e5e5e5" }} />
            <Line type="monotone" dataKey={spec.yKey} stroke={scenarioColor} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={scenario.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 11, fill: "#888" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#aaa" } } : undefined} />
            <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #e5e5e5" }} />
            <Bar dataKey={spec.yKey} fill={scenarioColor} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>

      {/* Scenario summary */}
      {scenario.summary && (
        <p className="text-xs text-slate mt-3 pt-3 border-t border-mist leading-relaxed">
          <span className="font-medium text-ink">{activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}:</span>{" "}
          {scenario.summary}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedQ, setSelectedQ] = useState<SelectedQuestion | null>(null);
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>(0);
  const [revenueModel, setRevenueModel] = useState("");
  const [arrBand, setArrBand] = useState("");
  const [biggestConcern, setBiggestConcern] = useState("");
  const [promptText, setPromptText] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [sendChoice, setSendChoice] = useState<SendChoice>("none");
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingEmail, setFloatingEmail] = useState("");
  const [floatingStatus, setFloatingStatus] = useState<EmailStatus>("idle");
  const [domainStates, setDomainStates] = useState<Record<number, DomainState>>({});
  const [q1Answer, setQ1Answer] = useState("");
  const [q1FreeText, setQ1FreeText] = useState("");
  const [inlineOptions, setInlineOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [optionFreeText, setOptionFreeText] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState("");
  const [summaryStatus, setSummaryStatus] = useState<EmailStatus>("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const intakeTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  // Scroll to top of intake on every step change
  useEffect(() => {
    if (stage === "intake") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [intakeStep, stage]);

  function updateDomains(latestResponse: string, primaryId: number) {
    const tagged = extractDomains(latestResponse);
    setDomainStates(prev => {
      const newStates: Record<number, DomainState> = { ...prev };
      // Primary domain always active
      newStates[primaryId] = "active";
      // Domains tagged in this response: promote to active
      tagged.forEach(id => { newStates[id] = "active"; });
      // Domains previously touched stay touched unless promoted
      DOMAINS.forEach(d => {
        if (newStates[d.id] === undefined) newStates[d.id] = "inactive";
      });
      return newStates;
    });
  }

  async function startAnalysis() {
    if (!selectedQ || !promptText.trim()) return;
    const subsectorLabel = SUBSECTORS.find(s => s.id === selectedSubsector)?.label || selectedSubsector;
    const structuredContext = [
      `Subsector: ${subsectorLabel}`,
      `Revenue model: ${revenueModel}`,
      `Current scale: ${arrBand}`,
      `Biggest concern: ${biggestConcern}`,
      `In their own words: ${promptText}`,
    ].join("\n");
    setBusinessContext(structuredContext);
    const initialMessage = `Business: ${businessName || subsectorLabel}\n\n${structuredContext}\n\nPlease begin the analysis.`;
    const newMessages: Message[] = [{ role: "user", content: initialMessage }];
    setMessages(newMessages);
    const newStates: Record<number, DomainState> = {};
    DOMAINS.forEach(d => { newStates[d.id] = d.id === selectedQ.id ? "active" : "inactive"; });
    setDomainStates(newStates);
    setStage("analysis");
    await streamResponse(newMessages, selectedQ.id);
  }

  async function streamResponse(msgs: Message[], primaryId?: number) {
    if (!selectedQ) return;
    setStreaming(true);
    setStreamedText("");
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, questionLabel: selectedQ.label, question: selectedQ.question }),
      });
      if (!res.ok) throw new Error("API error");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamedText(accumulated);
      }
      const finalMessages = [...msgs, { role: "assistant" as const, content: accumulated }];
      setMessages(finalMessages);
      setStreamedText("");
      updateDomains(accumulated, primaryId ?? selectedQ.id);
      // Detect model-emitted options for Q2
      const opts = extractOptions(accumulated);
      if (opts.length > 0) {
        setInlineOptions(opts);
        setSelectedOption("");
        setOptionFreeText("");
      } else {
        setInlineOptions([]);
      }
      if (
        accumulated.toLowerCase().includes("send them to you directly") ||
        accumulated.toLowerCase().includes("supporting model") ||
        accumulated.toLowerCase().includes("strategic finance questions this business")
      ) {
        setAnalysisComplete(true);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error. Please check your API key configuration and try again." }]);
    } finally {
      setStreaming(false);
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || streaming) return;
    const newMessages: Message[] = [...messages, { role: "user", content: userInput.trim() }];
    setMessages(newMessages);
    setUserInput("");
    await streamResponse(newMessages);
  }

  async function sendByEmail() {
    if (!selectedQ || !userEmail.trim() || emailStatus === "sending") return;
    setEmailStatus("sending");
    const allText = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail.trim(),
          question: selectedQ.question,
          businessName: businessName || "Business",
          context: businessContext,
          findings: allText,
          choice: sendChoice,
          timestamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setEmailStatus("sent");
    } catch {
      setEmailStatus("error");
    }
  }

  async function sendSummary() {
    if (!selectedQ || !summaryEmail.trim() || summaryStatus === "sending") return;
    setSummaryStatus("sending");
    const allText = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: summaryEmail.trim(),
          question: selectedQ.question,
          businessName: businessName || SUBSECTORS.find(s => s.id === selectedSubsector)?.label || "Business",
          context: businessContext,
          findings: allText,
          choice: "report",
          timestamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSummaryStatus("sent");
    } catch {
      setSummaryStatus("error");
    }
  }

  async function sendFromFloating(choice: "both" | "report" | "model") {
    if (!selectedQ || !floatingEmail.trim() || floatingStatus === "sending") return;
    setFloatingStatus("sending");
    const allText = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: floatingEmail.trim(),
          question: selectedQ.question,
          businessName: businessName || "Business",
          context: businessContext,
          findings: allText,
          choice,
          timestamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setFloatingStatus("sent");
    } catch {
      setFloatingStatus("error");
    }
  }

  function reset() {
    setStage("landing");
    setSelectedQ(null);
    setSelectedSubsector("");
    setIntakeStep(0);
    setRevenueModel("");
    setArrBand("");
    setBiggestConcern("");
    setPromptText("");
    setUserEmail("");
    setBusinessName("");
    setBusinessContext("");
    setMessages([]);
    setUserInput("");
    setStreamedText("");
    setAnalysisComplete(false);
    setHasContinued(false);
    setEmailStatus("idle");
    setSendChoice("none");
    setFloatingOpen(false);
    setFloatingEmail("");
    setFloatingStatus("idle");
    setDomainStates({});
    setQ1Answer("");
    setQ1FreeText("");
    setInlineOptions([]);
    setSelectedOption("");
    setOptionFreeText("");
    setSummaryOpen(false);
    setSummaryEmail("");
    setSummaryStatus("idle");
  }

  function FrameworkMap() {
    return (
      <div className="border-b border-mist bg-paper/90 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate/50 uppercase tracking-widest mr-2 hidden sm:block">Framework</span>
            <div className="flex flex-1 gap-2">
              {DOMAINS.map((d) => {
                const state = domainStates[d.id] || "inactive";
                return (
                  <div
                    key={d.id}
                    title={d.question}
                    className={`flex-1 px-2 py-1.5 text-center transition-all duration-500 border ${
                      state === "active" ? "border-accent bg-accent/10 text-accent"
                      : state === "touched" ? "border-accent/30 bg-accent/5 text-slate"
                      : "border-mist bg-transparent text-slate/30"
                    }`}
                  >
                    <div className={`text-xs font-mono leading-tight ${state === "active" ? "font-medium" : ""}`}>{d.short}</div>
                    <div className="flex justify-center mt-1 gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${
                          state === "active" ? "bg-accent"
                          : state === "touched" && i === 0 ? "bg-accent/40"
                          : "bg-mist"
                        }`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="fixed top-0 left-0 right-0 z-50 bg-paper/90 backdrop-blur-sm">
        <div className="border-b border-mist">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={reset} className="font-display text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors">Scaler</button>
            {stage !== "landing" && (
              <button onClick={reset} className="flex items-center gap-2 text-sm text-slate hover:text-ink transition-colors">
                <RotateCcw size={14} />Start over
              </button>
            )}
          </div>
        </div>
        {stage === "analysis" && selectedQ && (
          <>
            <FrameworkMap />
            <div className="border-b border-mist bg-paper/80 px-6 py-3">
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <span className="font-mono text-xs text-accent">{selectedQ.label}</span>
                <span className="text-slate text-xs">·</span>
                <span className="text-xs text-slate italic">{selectedQ.question}</span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* LANDING */}
      {stage === "landing" && (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              <p className="text-slate text-sm tracking-widest uppercase mb-6 font-mono">Pilot — Invitation Only</p>
            </div>
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.25s" }}>
              <h1 className="font-display text-5xl font-medium leading-tight mb-6 text-ink">Scaler</h1>
            </div>
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.4s" }}>
              <p className="text-slate text-lg mb-4 leading-relaxed">Structural finance analysis for payments and fintech businesses.</p>
              <p className="text-slate text-base mb-12 leading-relaxed">Not a reporting tool. Not a forecast generator. A framework for understanding how your business actually behaves as it scales.</p>
            </div>
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.55s" }}>
              <button onClick={() => setStage("select")} className="inline-flex items-center gap-3 bg-ink text-paper px-8 py-4 text-sm tracking-wide hover:bg-accent transition-colors duration-300">
                Begin analysis <ArrowRight size={16} />
              </button>
            </div>
            <div className="opacity-0 animate-fade-up mt-20 border-t border-mist pt-12" style={{ animationFillMode: "forwards", animationDelay: "0.7s" }}>
              <div className="grid grid-cols-3 gap-8 text-left">
                {[
                  { n: "01", t: "Select a domain", d: "Choose the scaling question most relevant to your current decision." },
                  { n: "02", t: "Describe your business", d: "Tell Scaler about your revenue model, stage, and what you are trying to understand." },
                  { n: "03", t: "Receive your analysis", d: "Scaler delivers structured analysis with visual scenario modelling. Enter your email to receive the full briefing." },
                ].map((s) => (
                  <div key={s.n}>
                    <p className="font-mono text-xs text-accent mb-2">{s.n}</p>
                    <p className="font-display text-sm font-medium text-ink mb-1">{s.t}</p>
                    <p className="text-xs text-slate leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* SELECT */}
      {stage === "select" && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="opacity-0 animate-fade-up mb-10" style={{ animationFillMode: "forwards" }}>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">The Scaler Framework</p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">Select your domain</h2>
              <p className="text-slate text-base">Five analytical domains for scaling payments and fintech businesses. Select the one most relevant to your current decision.</p>
            </div>
            <div className="opacity-0 animate-fade-up mb-8 flex gap-2" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              {DOMAINS.map((d) => <div key={d.id} className="flex-1 h-1 bg-mist rounded-full" />)}
            </div>
            <div className="space-y-3">
              {DOMAINS.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedQ(d); setStage("subsector"); }}
                  className="opacity-0 animate-fade-up w-full text-left border border-mist bg-paper hover:border-accent hover:bg-white/60 transition-all duration-200 p-6 group"
                  style={{ animationFillMode: "forwards", animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-xs text-slate">0{d.id}</span>
                        <span className="text-xs text-accent font-medium tracking-wide uppercase">{d.label}</span>
                      </div>
                      <p className="font-display text-lg font-medium text-ink mb-2 leading-snug">{d.question}</p>
                      <p className="text-sm text-slate leading-relaxed">{d.description}</p>
                    </div>
                    <ArrowRight size={18} className="text-mist group-hover:text-accent transition-colors mt-1 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* SUBSECTOR */}
      {stage === "subsector" && selectedQ && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="opacity-0 animate-fade-up mb-3" style={{ animationFillMode: "forwards" }}>
              <div className="border-l-2 border-accent pl-4 py-1 mb-8">
                <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">{selectedQ.label}</p>
                <p className="text-sm text-slate italic">{selectedQ.question}</p>
              </div>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">Step 1 of 5</p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">Which best describes your business?</h2>
              <p className="text-slate text-sm">Select your payments or fintech category.</p>
            </div>
            <div className="opacity-0 animate-fade-up space-y-2 mt-8" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              {SUBSECTORS.map((s, i) => (
                <button key={s.id}
                  onClick={() => { setSelectedSubsector(s.id); setIntakeStep(0); setStage("intake"); }}
                  className="w-full text-left border border-mist bg-paper hover:border-accent hover:bg-white/60 transition-all duration-150 px-5 py-4 group flex items-center justify-between"
                  style={{ animationFillMode: "forwards" }}>
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors">{s.label}</p>
                    <p className="text-xs text-slate mt-0.5">{s.desc}</p>
                  </div>
                  <ArrowRight size={15} className="text-mist group-hover:text-accent transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
            <button onClick={() => setStage("select")} className="mt-8 text-sm text-slate hover:text-ink transition-colors">← Change domain</button>
          </div>
        </main>
      )}

      {/* INTAKE — guided one question at a time */}
      {stage === "intake" && selectedQ && selectedSubsector && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-xl mx-auto" ref={intakeTopRef}>
            {/* Progress */}
            <div className="opacity-0 animate-fade-up mb-8" style={{ animationFillMode: "forwards" }}>
              <div className="border-l-2 border-accent pl-4 py-1 mb-6">
                <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">{selectedQ.label} · {SUBSECTORS.find(s => s.id === selectedSubsector)?.label}</p>
                <p className="text-sm text-slate italic">{selectedQ.question}</p>
              </div>
              <div className="flex gap-1.5 mb-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`h-0.5 flex-1 transition-all duration-300 ${i <= intakeStep ? "bg-accent" : "bg-mist"}`} />
                ))}
              </div>
            </div>

            {/* Step 0 — Revenue model */}
            <div className="space-y-3">
              <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
                <p className="font-mono text-xs text-slate uppercase tracking-wide mb-1">Step {intakeStep + 2} of 5</p>
                <h2 className="font-display text-2xl font-medium text-ink mb-6">
                  {intakeStep === 0 && "How does revenue flow in?"}
                  {intakeStep === 1 && "Where are you today?"}
                  {intakeStep === 2 && "What is the biggest concern right now?"}
                  {intakeStep === 3 && "What has prompted this question?"}
                </h2>
              </div>

              {intakeStep === 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-2">
                    {(Q1_OPTIONS[selectedSubsector] || REVENUE_MODELS).map(r => (
                      <button key={r} onClick={() => setQ1Answer(prev => prev === r ? "" : r)}
                        className={`w-full text-left border px-5 py-3.5 text-sm transition-all flex justify-between items-center ${q1Answer === r ? "border-accent bg-accent/10 text-accent" : "border-mist text-ink hover:border-accent hover:text-accent hover:bg-white/60"}`}>
                        {r}
                        {q1Answer === r && <span className="text-accent text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={q1FreeText}
                    onChange={e => setQ1FreeText(e.target.value)}
                    placeholder="Add more detail (optional)…"
                    rows={2}
                    className="w-full border border-mist bg-white/60 px-4 py-2.5 text-sm text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors resize-none"
                  />
                  <button
                    disabled={!q1Answer}
                    onClick={() => { setRevenueModel(q1Answer + (q1FreeText ? ` — ${q1FreeText}` : "")); setIntakeStep(1); }}
                    className="w-full bg-ink text-paper text-sm py-3 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    Next <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {intakeStep === 1 && (
                <div className="space-y-2 animate-fade-in">
                  {ARR_BANDS.map(a => (
                    <button key={a} onClick={() => { setArrBand(a); setIntakeStep(2); }}
                      className="w-full text-left border border-mist px-5 py-3.5 text-sm text-ink hover:border-accent hover:text-accent hover:bg-white/60 transition-all group flex justify-between items-center">
                      {a} <ArrowRight size={14} className="text-mist group-hover:text-accent transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {intakeStep === 2 && (
                <div className="space-y-2 animate-fade-in">
                  {(CONCERNS[selectedSubsector] || DEFAULT_CONCERNS).map(c => (
                    <button key={c} onClick={() => { setBiggestConcern(c); setIntakeStep(3); }}
                      className="w-full text-left border border-mist px-5 py-3.5 text-sm text-ink hover:border-accent hover:text-accent hover:bg-white/60 transition-all group flex justify-between items-center">
                      {c} <ArrowRight size={14} className="text-mist group-hover:text-accent transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {intakeStep === 3 && (
                <div className="animate-fade-in space-y-4">
                  <p className="text-xs text-slate leading-relaxed">You have selected: <span className="text-ink font-medium">{revenueModel}</span> · <span className="text-ink font-medium">{arrBand}</span> · Concern: <span className="text-ink font-medium">{biggestConcern}</span></p>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Tell us a bit more — what is happening in the business right now that has brought you to this question?"
                    rows={5}
                    className="w-full border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <button onClick={() => setIntakeStep(2)} className="text-sm text-slate hover:text-ink transition-colors">← Back</button>
                    <button onClick={startAnalysis} disabled={!promptText.trim()}
                      className="inline-flex items-center gap-3 bg-ink text-paper px-8 py-3 text-sm tracking-wide hover:bg-accent transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed">
                      Begin analysis <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {intakeStep < 3 && (
                <button onClick={() => setStage("subsector")} className="mt-6 text-sm text-slate hover:text-ink transition-colors block">← Change subsector</button>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ANALYSIS */}
      {stage === "analysis" && selectedQ && (
        <main className="pt-36 pb-0 min-h-screen flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.map((m, i) => {
                const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                if (m.role === "user") {
                  return (
                    <div key={i} className="animate-fade-in pl-12">
                      <div className="bg-mist/60 border border-mist px-5 py-4">
                        <p className="text-xs font-mono text-slate mb-2 uppercase tracking-wide">You</p>
                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                }
                const { clean, chart } = extractChart(m.content);
                return (
                  <div key={i} className="animate-fade-in">
                    <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                    <div className="prose-analysis text-sm text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdown(clean) }} />
                    {chart && <ChartBlock spec={chart} />}

                    {/* Inline options (Q2 multiple choice) — only on last assistant message while awaiting response */}
                    {isLastAssistant && inlineOptions.length > 0 && !streaming && (
                      <div className="mt-5 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {inlineOptions.map(opt => (
                            <button key={opt} onClick={() => setSelectedOption(prev => prev === opt ? "" : opt)}
                              className={`px-4 py-2 text-xs border transition-all ${selectedOption === opt ? "border-accent bg-accent/10 text-accent" : "border-mist text-slate hover:border-accent hover:text-accent"}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={optionFreeText}
                          onChange={e => setOptionFreeText(e.target.value)}
                          placeholder="Add more detail (optional)…"
                          rows={2}
                          className="w-full border border-mist bg-white/60 px-3 py-2 text-xs text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors resize-none"
                        />
                        <div className="flex gap-3">
                          <button
                            disabled={!selectedOption || streaming}
                            onClick={() => {
                              const msg = optionFreeText.trim()
                                ? `${selectedOption}. ${optionFreeText.trim()}`
                                : selectedOption;
                              const newMessages = [...messages, { role: "user" as const, content: msg }];
                              setMessages(newMessages);
                              setInlineOptions([]);
                              setSelectedOption("");
                              setOptionFreeText("");
                              streamResponse(newMessages);
                            }}
                            className="flex-1 bg-ink text-paper text-xs py-2.5 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            Continue with Scaler analysis <ArrowRight size={13} />
                          </button>
                          <button onClick={() => { setSummaryOpen(true); setSummaryStatus("idle"); }}
                            className="border border-mist text-slate text-xs px-4 py-2.5 hover:border-ink hover:text-ink transition-all flex items-center gap-2">
                            <FileText size={13} /> Get summary
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Summary + continue buttons on chart responses (no inline options) */}
                    {isLastAssistant && chart && inlineOptions.length === 0 && !streaming && !analysisComplete && (
                      <div className="mt-4 flex gap-3">
                        <button onClick={() => {
                          const msg = "Please continue with the full analysis.";
                          const newMessages = [...messages, { role: "user" as const, content: msg }];
                          setMessages(newMessages);
                          streamResponse(newMessages);
                        }}
                          className="flex-1 bg-ink text-paper text-xs py-2.5 hover:bg-accent transition-colors flex items-center justify-center gap-2">
                          Continue with Scaler analysis <ArrowRight size={13} />
                        </button>
                        <button onClick={() => { setSummaryOpen(true); setSummaryStatus("idle"); }}
                          className="border border-mist text-slate text-xs px-4 py-2.5 hover:border-ink hover:text-ink transition-all flex items-center gap-2">
                          <FileText size={13} /> Get summary
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {streaming && streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                  <div className="prose-analysis text-sm text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdown(hideChartBlock(streamedText)) }} />
                  <span className="inline-block w-2 h-4 bg-accent animate-cursor ml-0.5 -mb-0.5" />
                </div>
              )}

              {streaming && !streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}

              {analysisComplete && !streaming && !hasContinued && (
                <div className="animate-fade-in border border-accent/30 bg-accent/5 p-6 space-y-5">
                  <div>
                    <p className="text-sm font-medium text-ink mb-1">High-level analysis complete</p>
                    <p className="text-xs text-slate leading-relaxed">You can receive your documents now, continue the analysis to go deeper, or return home.</p>
                  </div>

                  {/* Document delivery */}
                  <div className="border border-mist bg-white/60 p-4">
                    <p className="text-xs font-medium text-ink mb-3">Receive your documents</p>
                    {emailStatus === "sent" ? (
                      <p className="text-xs text-accent font-medium">✓ Sent to {userEmail} — check your inbox.</p>
                    ) : (
                      <>
                        <div className="flex gap-2 mb-3">
                          {(["both", "report", "model"] as const).map(c => (
                            <button key={c} onClick={() => setSendChoice(c)}
                              className={`flex-1 py-1.5 text-xs border transition-all ${sendChoice === c ? "border-accent bg-accent/10 text-accent" : "border-mist text-slate hover:border-slate"}`}>
                              {c === "both" ? "Both" : c === "report" ? "Word report" : "Excel model"}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="you@yourcompany.com" className="flex-1 border border-mist bg-white px-3 py-2 text-ink placeholder-slate/50 focus:outline-none focus:border-accent text-xs" />
                          <button onClick={sendByEmail} disabled={!userEmail.trim() || !sendChoice || sendChoice === "none" || emailStatus === "sending"}
                            className="inline-flex items-center gap-1.5 bg-accent text-paper px-4 py-2 text-xs hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                            <Send size={11} />{emailStatus === "sending" ? "Sending…" : "Send"}
                          </button>
                        </div>
                        {emailStatus === "error" && <p className="text-xs text-red-500 mt-2">Something went wrong. Please try again.</p>}
                      </>
                    )}
                  </div>

                  {/* Continue or return home */}
                  <div className="flex gap-3">
                    <button onClick={() => setHasContinued(true)}
                      className="flex-1 border border-ink text-ink text-xs py-2.5 hover:bg-ink hover:text-paper transition-all">
                      Continue analysis
                    </button>
                    <button onClick={reset}
                      className="flex-1 border border-mist text-slate text-xs py-2.5 hover:border-ink hover:text-ink transition-all">
                      Return home
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar — shown during analysis and after user continues */}
          {(!analysisComplete || hasContinued) && (
            <div className="border-t border-mist bg-paper/95 backdrop-blur-sm px-6 py-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-3 items-end">
                  <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Go deeper on any aspect of the analysis…" rows={2} disabled={streaming} className="flex-1 border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none disabled:opacity-50" />
                  <button onClick={sendMessage} disabled={!userInput.trim() || streaming} className="bg-ink text-paper px-5 py-3 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                    <ArrowRight size={16} />
                  </button>
                </div>
                <p className="text-xs text-slate/60 mt-2">Press Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          )}

          {/* Floating action button — appears after user continues */}
          {hasContinued && (
            <div className="fixed bottom-24 right-6 z-50">
              {floatingOpen ? (
                <div className="bg-paper border border-mist shadow-lg p-4 w-72 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-ink">Receive your documents</p>
                    <button onClick={() => { setFloatingOpen(false); setFloatingStatus("idle"); }} className="text-slate hover:text-ink">
                      <X size={14} />
                    </button>
                  </div>
                  {floatingStatus === "sent" ? (
                    <p className="text-xs text-accent font-medium">✓ Sent — check your inbox.</p>
                  ) : (
                    <>
                      <input type="email" value={floatingEmail} onChange={(e) => setFloatingEmail(e.target.value)} placeholder="you@yourcompany.com" className="w-full border border-mist px-3 py-2 text-xs text-ink placeholder-slate/50 focus:outline-none focus:border-accent mb-2" />
                      <div className="space-y-1.5">
                        {([["both", "Word report + Excel model"], ["report", "Word report only"], ["model", "Excel model only"]] as const).map(([choice, label]) => (
                          <button key={choice} onClick={() => sendFromFloating(choice)} disabled={!floatingEmail.trim() || floatingStatus === "sending"}
                            className="w-full text-left text-xs border border-mist px-3 py-2 hover:border-accent hover:text-accent transition-all disabled:opacity-40 flex items-center gap-2">
                            {choice === "report" ? <FileText size={11} /> : choice === "model" ? <Table size={11} /> : <Send size={11} />}
                            {floatingStatus === "sending" ? "Sending…" : label}
                          </button>
                        ))}
                      </div>
                      {floatingStatus === "error" && <p className="text-xs text-red-500 mt-2">Something went wrong.</p>}
                    </>
                  )}
                  <button onClick={reset} className="w-full mt-3 pt-3 border-t border-mist text-xs text-slate hover:text-ink transition-colors text-left">
                    ← Return home
                  </button>
                </div>
              ) : (
                <button onClick={() => setFloatingOpen(true)}
                  className="bg-ink text-paper text-xs px-4 py-2.5 shadow-lg hover:bg-accent transition-colors flex items-center gap-2">
                  <FileText size={13} /> Documents <ChevronDown size={12} />
                </button>
              )}
            </div>
          )}
        {/* Summary modal */}
        {summaryOpen && (
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center px-6">
            <div className="bg-paper border border-mist p-6 w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-ink">Get Word doc summary</p>
                <button onClick={() => setSummaryOpen(false)} className="text-slate hover:text-ink"><X size={16} /></button>
              </div>
              <p className="text-xs text-slate mb-4 leading-relaxed">We will send a Word doc summary of the analysis so far to your inbox.</p>
              {summaryStatus === "sent" ? (
                <p className="text-xs text-accent font-medium">✓ Sent — check your inbox.</p>
              ) : (
                <>
                  <input
                    type="email"
                    value={summaryEmail}
                    onChange={e => setSummaryEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && summaryEmail.trim()) sendSummary(); }}
                    placeholder="you@yourcompany.com"
                    className="w-full border border-mist px-3 py-2.5 text-sm text-ink placeholder-slate/50 focus:outline-none focus:border-accent mb-3"
                  />
                  <button onClick={sendSummary} disabled={!summaryEmail.trim() || summaryStatus === "sending"}
                    className="w-full bg-accent text-paper text-xs py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                    <Send size={12} />{summaryStatus === "sending" ? "Sending…" : "Send to my inbox"}
                  </button>
                  {summaryStatus === "error" && <p className="text-xs text-red-500 mt-2">Something went wrong. Please try again.</p>}
                </>
              )}
            </div>
          </div>
        )}
        </main>
      )}
    </div>
  );
}
