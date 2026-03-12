"use client";

import { useState, useRef, useEffect } from "react";
import { QUESTIONS } from "@/lib/prompt";
import { ArrowRight, RotateCcw, Send, FileText, X } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ── TYPES ──────────────────────────────────────────────────────────────────
type Stage = "landing" | "subsector" | "intake" | "diagnostic" | "deepdive" | "complete";
type EmailStatus = "idle" | "sending" | "sent" | "error";
type DomainState = "inactive" | "touched" | "active";
type ScenarioKey = "base" | "upside" | "downside";
type IntakeStep = 0 | 1 | 2 | 3;
type DiagnosticPhase = "q1" | "q2" | "q3" | "complete";

interface Message { role: "user" | "assistant"; content: string; }

interface Domain {
  id: number; label: string; short: string; question: string; description: string;
}

interface ChartDataPoint { [key: string]: string | number; }
interface ChartScenario { data: ChartDataPoint[]; summary?: string; }
interface ChartSpec {
  type: "line" | "bar"; title: string; subtitle?: string;
  xKey: string; yKey: string; yLabel?: string;
  scenarios: { base: ChartScenario; upside: ChartScenario; downside: ChartScenario; };
}

// ── STATIC DATA ────────────────────────────────────────────────────────────
const DOMAINS: Domain[] = [
  { id: 1, label: "Growth Quality", short: "Growth Quality", question: "Is growth real, structural and repeatable — or are we riding a wave?", description: "Examines whether growth is driven by structural demand, improving cohort economics, and repeatable acquisition — or by temporary tailwinds." },
  { id: 2, label: "Scaling Behaviour", short: "Scaling Behaviour", question: "How does this business behave at two or three times its current scale?", description: "Examines how margins, complexity, and cost structure respond as revenue compounds — and where leverage and friction emerge." },
  { id: 3, label: "Profitability Path", short: "Profitability Path", question: "What does the path to profitability actually look like?", description: "Maps the specific conditions and thresholds that determine when and whether profitability is achievable." },
  { id: 4, label: "Capital Efficiency", short: "Capital Efficiency", question: "Is capital being deployed against the right constraints?", description: "Evaluates whether investment is sequenced correctly against the actual binding constraints of the business." },
  { id: 5, label: "Structural Dependencies", short: "Dependencies", question: "What partnerships or concentrations could bind or break this business at scale?", description: "Identifies key dependencies — banking partners, technology providers, regulatory relationships, customer concentration." },
];

const SUBSECTORS = [
  { id: "processor", label: "Payments Processor", desc: "Card acquiring, switching, gateway" },
  { id: "fx", label: "FX / Cross-border", desc: "FX forwards, remittance, international payments" },
  { id: "merchant", label: "Merchant Platform", desc: "POS, SME payments, merchant acquiring" },
  { id: "infrastructure", label: "Core Banking / Infrastructure", desc: "Banking-as-a-service platform, core systems" },
  { id: "baas", label: "BaaS / Embedded Finance", desc: "Embedded payments, lending, or banking products" },
  { id: "issuing", label: "Card Issuing", desc: "Prepaid, credit or debit card programmes" },
  { id: "openbanking", label: "Open Banking / A2A", desc: "Account-to-account payments, VRP, data services" },
];

const Q1_OPTIONS: Record<string, string[]> = {
  processor: ["Card acquiring for merchants", "Payment switching / routing", "Gateway services only", "Full-stack acquiring + gateway", "White-label processing for other issuers"],
  fx: ["FX forwards / hedging for corporates", "Remittance / consumer cross-border", "B2B international payments platform", "Treasury infrastructure / FX-as-a-service", "Multi-currency accounts + FX execution"],
  merchant: ["POS hardware + payments for SMEs", "Online checkout / e-commerce payments", "Marketplace payments infrastructure", "Vertical SaaS with embedded payments", "Multi-channel merchant acquiring"],
  infrastructure: ["Core banking platform (SaaS)", "Banking infrastructure / BaaS platform", "Payments infrastructure for fintechs", "Ledger / money movement infrastructure", "Compliance and regulatory infrastructure"],
  baas: ["Embedded banking for non-financial brands", "Lending-as-a-service", "Card issuing for fintechs", "Savings / deposits infrastructure", "Full-stack BaaS (accounts + cards + payments)"],
  issuing: ["Prepaid programme management", "Credit card issuing", "Corporate / expense card programme", "Virtual card infrastructure", "Debit card programme for fintechs"],
  openbanking: ["Payment initiation (PIS)", "Account information services (AIS)", "Variable recurring payments (VRP)", "Open banking data platform", "Account-to-account checkout product"],
};

const ARR_BANDS = ["Pre-revenue", "Under £500k ARR", "£500k – £2m ARR", "£2m – £5m ARR", "£5m – £20m ARR", "£20m+ ARR"];

const CONCERNS: Record<string, string[]> = {
  processor: ["Margin compression at volume", "Scheme fee exposure", "Client concentration", "Fraud and risk cost", "Geographic expansion complexity"],
  fx: ["Corridor profitability", "Hedge cost at scale", "Regulatory capital requirements", "Operational cost per trade", "Spread compression"],
  merchant: ["CAC vs LTV deterioration", "Merchant churn in lower cohorts", "Support cost scaling", "Take rate pressure", "Activation rates"],
  infrastructure: ["Implementation bottleneck", "Bespoke vs productised delivery", "Recurring vs one-time revenue mix", "Engineering split", "Sales cycle length"],
  baas: ["Partner onboarding complexity", "Compliance cost growth", "Balance sheet requirements", "Integration bespoke work", "Partner concentration"],
  issuing: ["Programme economics", "Interchange dependency", "Fraud exposure", "BIN sponsorship risk", "Cardholder acquisition cost"],
  openbanking: ["Monetisation clarity", "API reliability and SLA cost", "Bank partnership dependency", "Regulatory change exposure", "Volume to fee conversion"],
};

const VERDICT_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  "STRUCTURALLY SOUND": { dot: "🟢", text: "text-green-700", bg: "bg-green-50 border-green-200" },
  "UNDER PRESSURE": { dot: "🟡", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  "CRITICAL CONSTRAINT": { dot: "🔴", text: "text-red-700", bg: "bg-red-50 border-red-200" },
  "INSUFFICIENT DATA": { dot: "⚪", text: "text-slate", bg: "bg-card/60 border-mist" },
  "PENDING": { dot: "⚪", text: "text-slate/50", bg: "bg-card/30 border-mist/50" },
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function extractOptions(text: string): string[] {
  const match = text.match(/<options>([\s\S]*?)<\/options>/);
  if (!match) return [];
  return match[1].split("|").map(s => s.trim()).filter(Boolean);
}

function extractDomains(text: string): number[] {
  const match = text.match(/<domains>([\d,\s]+)<\/domains>/);
  if (!match) return [];
  return match[1].split(",").map(s => parseInt(s.trim())).filter(n => n >= 1 && n <= 5);
}

function extractChart(text: string): { clean: string; chart: ChartSpec | null } {
  const match = text.match(/<chart>([\s\S]*?)<\/chart>/);
  let chart: ChartSpec | null = null;
  if (match) { try { chart = JSON.parse(match[1].trim()) as ChartSpec; } catch {} }
  let clean = text
    .replace(/<chart>[\s\S]*?<\/chart>/g, "")
    .replace(/<options>[\s\S]*?<\/options>/g, "")
    .replace(/<domains>[\d,\s]*<\/domains>/g, "")
    .trim();
  return { clean, chart };
}

function hidePartialTags(text: string): string {
  let clean = text
    .replace(/<chart>[\s\S]*?<\/chart>/g, "")
    .replace(/<options>[\s\S]*?<\/options>/g, "")
    .replace(/<domains>[\d,\s]*<\/domains>/g, "");
  ["<chart>", "<options>", "<domains>"].forEach(tag => {
    const idx = clean.indexOf(tag);
    if (idx !== -1) clean = clean.substring(0, idx);
  });
  // Strip sentences handled in UI — don't show in chat bubble
  clean = clean.replace(/I have prepared a Word document[^.]*\./gi, "").trim();
  clean = clean.replace(/I can prepare a full Word document[^.]*\./gi, "").trim();
  clean = clean.replace(/Select a domain below[^.]*\./gi, "").trim();
  clean = clean.replace(/That is the full picture on this domain[^.]*\./gi, "").trim();
  return clean.trim();
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[huli])(.+)$/gm, m => m.startsWith("<") ? m : `<p>${m}</p>`);
}

// ── CHART COMPONENT ────────────────────────────────────────────────────────
const SCENARIO_META = {
  base:      { label: "Base",      desc: "Current trajectory — no major changes to strategy or conditions",         color: "#ECFFE3", active: "bg-ink/10 text-ink border-ink/40",     inactive: "border-mist text-slate hover:border-slate" },
  upside:    { label: "Upside",    desc: "Conditions improve — execution holds and key assumptions prove correct",  color: "#A8F090", active: "bg-green-900/40 text-green-300 border-green-600", inactive: "border-mist text-slate hover:border-green-600" },
  downside:  { label: "Downside",  desc: "Conditions deteriorate — one or more structural risks materialise",      color: "#FF8B8B", active: "bg-red-900/40 text-red-300 border-red-600",   inactive: "border-mist text-slate hover:border-red-600" },
};

function ChartBlock({ spec }: { spec: ChartSpec }) {
  const [active, setActive] = useState<ScenarioKey>("base");
  const scenario = spec.scenarios[active];
  const COLORS = { base: "#ECFFE3", upside: "#A8F090", downside: "#FF8B8B" };

  return (
    <div className="my-6 border border-mist bg-card/60">
      {/* Chart header */}
      <div className="px-5 pt-5 pb-3 border-b border-mist/50">
        <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">Scenario model</p>
        <p className="text-sm font-medium text-ink">{spec.title}</p>
        {spec.subtitle && <p className="text-xs text-slate mt-0.5">{spec.subtitle}</p>}
      </div>

      {/* Scenario selector — full width with descriptions */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs text-slate mb-2 leading-relaxed">Select a scenario to see how the economics play out under different conditions:</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["base", "upside", "downside"] as ScenarioKey[]).map(s => {
            const meta = SCENARIO_META[s];
            return (
              <button key={s} onClick={() => setActive(s)}
                className={`text-left px-3 py-2.5 border transition-all ${active === s ? meta.active : meta.inactive}`}>
                <p className="text-xs font-medium mb-0.5">{meta.label}</p>
                <p className="text-xs leading-tight opacity-70">{meta.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pb-2">
        <ResponsiveContainer width="100%" height={220}>
          {spec.type === "line" ? (
            <LineChart data={scenario.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3460" />
              <XAxis dataKey={spec.xKey} tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#aaa" } } : undefined} />
              <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #2E3460", backgroundColor: "#1C2040", color: "#ECFFE3" }} />
              <Line type="monotone" dataKey={spec.yKey} stroke={COLORS[active]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={scenario.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3460" />
              <XAxis dataKey={spec.xKey} tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #2E3460", backgroundColor: "#1C2040", color: "#ECFFE3" }} />
              <Bar dataKey={spec.yKey} fill={COLORS[active]} radius={[2, 2, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Scenario interpretation */}
      {scenario.summary && (
        <div className="px-5 py-4 border-t border-mist/50">
          <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">{SCENARIO_META[active].label} scenario</p>
          <p className="text-sm text-ink leading-relaxed">{scenario.summary}</p>
          <p className="text-xs text-slate mt-2 leading-relaxed">
            {active === "base" && "This is the most likely trajectory based on your current position. The question is whether you can hold these conditions — and where the first pressure point appears."}
            {active === "upside" && "This scenario requires specific things to go right. Use it to identify what you would need to actively make true — not just hope for."}
            {active === "downside" && "This is the scenario to stress-test against. If this materialises, what decisions would you need to have already made to survive it?"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── FRAMEWORK MAP ──────────────────────────────────────────────────────────
function FrameworkMap({ domainStates }: { domainStates: Record<number, DomainState> }) {
  return (
    <div className="border-b border-mist bg-paper/95 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-2">
        <span className="text-xs font-mono text-slate/40 uppercase tracking-widest mr-2 hidden sm:block">Framework</span>
        <div className="flex flex-1 gap-2">
          {DOMAINS.map(d => {
            const state = domainStates[d.id] || "inactive";
            return (
              <div key={d.id} title={d.question}
                className={`flex-1 px-2 py-1.5 text-center transition-all duration-500 border ${state === "active" ? "border-accent bg-accent/10 text-accent" : state === "touched" ? "border-accent/30 bg-accent/5 text-slate" : "border-mist bg-transparent text-slate/30"}`}>
                <div className={`text-xs font-mono leading-tight truncate ${state === "active" ? "font-medium" : ""}`}>{d.short}</div>
                <div className="flex justify-center mt-1 gap-0.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${state === "active" ? "bg-accent" : state === "touched" && i === 0 ? "bg-accent/40" : "bg-mist"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedSubsector, setSelectedSubsector] = useState("");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>(0);
  const [revenueModel, setRevenueModel] = useState("");
  const [q1FreeText, setQ1FreeText] = useState("");
  const [arrBand, setArrBand] = useState("");
  const [biggestConcern, setBiggestConcern] = useState("");
  const [promptText, setPromptText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [diagnosticPhase, setDiagnosticPhase] = useState<DiagnosticPhase>("q1");
  const [inlineOptions, setInlineOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [optionFreeText, setOptionFreeText] = useState("");
  const [domainStates, setDomainStates] = useState<Record<number, DomainState>>({});
  const [selectedDeepDive, setSelectedDeepDive] = useState<Domain | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState("");
  const [summaryStatus, setSummaryStatus] = useState<EmailStatus>("idle");
  const [reportEmail, setReportEmail] = useState("");
  const [reportStatus, setReportStatus] = useState<EmailStatus>("idle");
  const [collectedEmail, setCollectedEmail] = useState("");
  const [pendingDeepDive, setPendingDeepDive] = useState<Domain | null>(null);
  const [deepDiveContext, setDeepDiveContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      const el = messagesEndRef.current;
      const offset = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight * 0.35);
      window.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }
  }, [messages, streamedText]);

  useEffect(() => {
    if (stage === "intake") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [intakeStep, stage]);

  function updateDomains(text: string) {
    const tagged = extractDomains(text);
    if (tagged.length === 0) return;
    setDomainStates(prev => {
      const next = { ...prev };
      tagged.forEach(id => { next[id] = "active"; });
      DOMAINS.forEach(d => { if (!next[d.id]) next[d.id] = "inactive"; });
      return next;
    });
  }

  function reset() {
    setStage("landing");
    setSelectedSubsector("");
    setIntakeStep(0);
    setRevenueModel("");
    setQ1FreeText("");
    setArrBand("");
    setBiggestConcern("");
    setPromptText("");
    setMessages([]);
    setStreaming(false);
    setStreamedText("");
    setDiagnosticPhase("q1");
    setInlineOptions([]);
    setSelectedOption("");
    setOptionFreeText("");
    setDomainStates({});
    setSelectedDeepDive(null);
    setSummaryOpen(false);
    setSummaryEmail("");
    setSummaryStatus("idle");
    setReportEmail("");
    setReportStatus("idle");
    setCollectedEmail("");
  }

  async function streamResponse(msgs: Message[], phase: DiagnosticPhase) {
    setStreaming(true);
    setStreamedText("");
    setInlineOptions([]);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, questionLabel: "Diagnostic", question: "Full five-domain diagnostic" }),
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
      const finalMessages: Message[] = [...msgs, { role: "assistant", content: accumulated }];
      setMessages(finalMessages);
      setStreamedText("");
      updateDomains(accumulated);
      // Only set options if this is a question phase (not the final diagnostic)
      if (phase !== "complete") {
        const opts = extractOptions(accumulated);
        if (opts.length > 0) { setInlineOptions(opts); setSelectedOption(""); setOptionFreeText(""); }
      }
      // Phase advances are driven by submitOption — only mark complete after Q3 response
      if (phase === "complete") {
        setDiagnosticPhase("complete");
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  }

  async function startDiagnostic() {
    const subsectorLabel = SUBSECTORS.find(s => s.id === selectedSubsector)?.label || selectedSubsector;
    const context = [
      `Subsector: ${subsectorLabel}`,
      `Revenue model: ${revenueModel}`,
      `Current scale: ${arrBand}`,
      `Biggest concern: ${biggestConcern}`,
      `In their own words: ${promptText}`,
    ].join("\n");
    const initialMessage = `Business: ${subsectorLabel}\n\n${context}\n\nPlease begin the diagnostic.`;
    const msgs: Message[] = [{ role: "user", content: initialMessage }];
    setMessages(msgs);
    setStage("diagnostic");
    setDiagnosticPhase("q1");
    await streamResponse(msgs, "q1");
  }

  async function submitOption() {
    if (!selectedOption) return;
    const answer = optionFreeText.trim() ? `${selectedOption}. ${optionFreeText.trim()}` : selectedOption;
    const newMsgs: Message[] = [...messages, { role: "user", content: answer }];
    setMessages(newMsgs);
    setInlineOptions([]);
    setSelectedOption("");
    setOptionFreeText("");
    // Advance phase: q1→q2, q2→q3, q3→complete (complete means deliver full diagnostic)
    const phaseMap: Record<DiagnosticPhase, DiagnosticPhase> = { q1: "q2", q2: "q3", q3: "complete", complete: "complete" };
    const nextPhase = phaseMap[diagnosticPhase];
    setDiagnosticPhase(nextPhase);
    await streamResponse(newMsgs, nextPhase);
  }

  async function startDeepDive(domain: Domain, context?: string) {
    setSelectedDeepDive(domain);
    setPendingDeepDive(null);
    setDeepDiveContext("");
    setStage("deepdive");
    const contextLine = context?.trim() ? `\n\nAdditional context from the user: ${context.trim()}` : "";
    const deepDiveMsg = `Please deliver a deep dive analysis on the ${domain.label} domain.${contextLine}`;
    const newMsgs: Message[] = [...messages, { role: "user", content: deepDiveMsg }];
    setMessages(newMsgs);
    await streamResponse(newMsgs, "complete");
  }

  async function collectEmail(email: string) {
    if (!email.trim()) return;
    setCollectedEmail(email);
    try {
      await fetch("/api/collect-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subsector: SUBSECTORS.find(s => s.id === selectedSubsector)?.label || selectedSubsector,
          arrBand,
          biggestConcern,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch { /* silent — don't block UX */ }
  }

  async function sendEmail(email: string, choice: "report", onSuccess: () => void, onError: () => void) {
    collectEmail(email);
    const allText = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    const subsectorLabel = SUBSECTORS.find(s => s.id === selectedSubsector)?.label || "Business";
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          question: "Five-domain structural diagnostic",
          businessName: subsectorLabel,
          context: `${revenueModel} · ${arrBand} · ${biggestConcern}`,
          findings: allText,
          choice,
          timestamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error();
      onSuccess();
    } catch { onError(); }
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  const showHeader = stage !== "landing";
  const showFramework = stage === "diagnostic" || stage === "deepdive";

  return (
    <div className="min-h-screen bg-paper">

      {/* HEADER */}
      {showHeader && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-paper/95 backdrop-blur-sm">
          <div className="border-b border-mist">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <button onClick={reset} className="font-display text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors">Scaler</button>
              <button onClick={reset} className="flex items-center gap-2 text-sm text-slate hover:text-ink transition-colors">
                <RotateCcw size={14} /> Start over
              </button>
            </div>
          </div>
          {showFramework && <FrameworkMap domainStates={domainStates} />}
        </header>
      )}

      {/* ── LANDING ── */}
      {stage === "landing" && (
        <main className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="max-w-2xl mx-auto w-full">
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-6">Pilot — Invitation Only</p>
            </div>
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.2s" }}>
              <h1 className="font-display text-5xl font-medium text-ink mb-6 leading-tight">Scaler</h1>
            </div>
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.3s" }}>
              <p className="text-slate text-lg mb-4 leading-relaxed">A structural diagnostic for payments and fintech businesses at Series A to C.</p>
              <p className="text-slate text-base mb-8 leading-relaxed">Scaler assesses your business across five structural domains and tells you where the real constraints are — not a generic report, a specific verdict on your business.</p>
            </div>

            {/* How it works */}
            <div className="opacity-0 animate-fade-up border border-mist p-6 mb-8" style={{ animationFillMode: "forwards", animationDelay: "0.4s" }}>
              <p className="text-xs font-mono text-accent uppercase tracking-wide mb-4">How it works</p>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { n: "01", t: "Describe your business", d: "Four quick questions about your model, scale and biggest concern." },
                  { n: "02", t: "Scaler asks three questions", d: "Targeted diagnostic questions to establish the full picture." },
                  { n: "03", t: "Receive your diagnostic", d: "A verdict across five structural domains. Word doc summary by email. Option to go deeper on any domain." },
                ].map(s => (
                  <div key={s.n}>
                    <p className="font-mono text-xs text-accent mb-2">{s.n}</p>
                    <p className="text-sm font-medium text-ink mb-1">{s.t}</p>
                    <p className="text-xs text-slate leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Five domains */}
            <div className="opacity-0 animate-fade-up mb-10" style={{ animationFillMode: "forwards", animationDelay: "0.5s" }}>
              <p className="text-xs font-mono text-accent uppercase tracking-widest mb-4">Five domains assessed</p>
              <div className="flex gap-2">
                {DOMAINS.map(d => (
                  <div key={d.id} className="flex-1 border border-slate/40 bg-card px-3 py-3 text-center">
                    <p className="text-xs font-mono text-ink leading-tight">{d.short}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.6s" }}>
              <button onClick={() => setStage("subsector")}
                className="inline-flex items-center gap-3 bg-white text-paper px-8 py-4 text-sm tracking-wide hover:bg-accent hover:text-paper transition-colors duration-300 border border-slate/20">
                Begin diagnostic <ArrowRight size={16} />
              </button>
            </div>

            {/* SP footer */}
            <div className="opacity-0 animate-fade-up mt-16 pt-8 border-t border-mist" style={{ animationFillMode: "forwards", animationDelay: "0.75s" }}>
              <p className="text-xs text-slate mb-1">Built by <a href="https://scalepointpartners.com" target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent transition-colors">Scalepoint Partners</a></p>
              <p className="text-xs text-slate">Strategic finance for payments and fintech — <a href="mailto:martin@scalepointpartners.com" className="text-ink hover:text-accent transition-colors">martin@scalepointpartners.com</a></p>
            </div>
          </div>
        </main>
      )}

      {/* ── SUBSECTOR ── */}
      {stage === "subsector" && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="opacity-0 animate-fade-up mb-8" style={{ animationFillMode: "forwards" }}>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">Step 1 of 5</p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">Which best describes your business?</h2>
              <p className="text-slate text-sm">Select your payments or fintech category.</p>
            </div>
            <div className="space-y-2">
              {SUBSECTORS.map(s => (
                <button key={s.id}
                  onClick={() => { setSelectedSubsector(s.id); setIntakeStep(0); setStage("intake"); }}
                  className="w-full text-left border border-mist bg-paper hover:border-accent hover:bg-card/60 transition-all px-5 py-4 group flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors">{s.label}</p>
                    <p className="text-xs text-slate mt-0.5">{s.desc}</p>
                  </div>
                  <ArrowRight size={15} className="text-mist group-hover:text-accent transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
            <button onClick={() => setStage("landing")} className="mt-8 text-sm text-slate hover:text-ink transition-colors">← Back</button>
          </div>
        </main>
      )}

      {/* ── INTAKE ── */}
      {stage === "intake" && selectedSubsector && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-xl mx-auto">
            {/* Progress bar */}
            <div className="opacity-0 animate-fade-up mb-8" style={{ animationFillMode: "forwards" }}>
              <div className="flex gap-1.5 mb-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`h-0.5 flex-1 transition-all duration-300 ${i <= intakeStep ? "bg-accent" : "bg-mist"}`} />
                ))}
              </div>
              <p className="font-mono text-xs text-slate">Step {intakeStep + 2} of 5</p>
            </div>

            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              <h2 className="font-display text-2xl font-medium text-ink mb-6">
                {intakeStep === 0 && "What best describes how your business generates revenue?"}
                {intakeStep === 1 && "Where are you today?"}
                {intakeStep === 2 && "What is your biggest concern right now?"}
                {intakeStep === 3 && "What has prompted this?"}
              </h2>
            </div>

            <div className="animate-fade-in space-y-3">
              {intakeStep === 0 && (
                <>
                  <div className="space-y-2">
                    {(Q1_OPTIONS[selectedSubsector] || []).map(r => (
                      <button key={r} onClick={() => setRevenueModel(prev => prev === r ? "" : r)}
                        className={`w-full text-left border px-5 py-3.5 text-sm transition-all flex justify-between items-center ${revenueModel === r ? "border-accent bg-accent/10 text-accent" : "border-slate/30 bg-white/8 text-ink hover:border-accent hover:bg-white/15"}`}>
                        {r} {revenueModel === r && <span className="text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                  <textarea value={q1FreeText} onChange={e => setQ1FreeText(e.target.value)}
                    placeholder="Add more detail (optional)…" rows={2}
                    className="w-full border border-slate/30 bg-white px-4 py-2.5 text-sm text-paper placeholder-slate focus:outline-none focus:border-accent resize-none" />
                  <button disabled={!revenueModel}
                    onClick={() => { setIntakeStep(1); }}
                    className="w-full bg-white text-paper text-sm py-3 hover:bg-accent hover:text-paper transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-slate/20">
                    Next <ArrowRight size={14} />
                  </button>
                </>
              )}

              {intakeStep === 1 && (
                <div className="space-y-2">
                  {ARR_BANDS.map(a => (
                    <button key={a} onClick={() => { setArrBand(a); setIntakeStep(2); }}
                      className="w-full text-left border border-mist px-5 py-3.5 text-sm text-ink hover:border-accent hover:text-accent hover:bg-card/60 transition-all flex justify-between items-center">
                      {a} <ArrowRight size={14} className="text-mist" />
                    </button>
                  ))}
                </div>
              )}

              {intakeStep === 2 && (
                <div className="space-y-2">
                  {(CONCERNS[selectedSubsector] || []).map(c => (
                    <button key={c} onClick={() => { setBiggestConcern(c); setIntakeStep(3); }}
                      className="w-full text-left border border-mist px-5 py-3.5 text-sm text-ink hover:border-accent hover:text-accent hover:bg-card/60 transition-all flex justify-between items-center">
                      {c} <ArrowRight size={14} className="text-mist" />
                    </button>
                  ))}
                </div>
              )}

              {intakeStep === 3 && (
                <div className="space-y-4">
                  <div className="text-xs text-slate space-y-1 p-3 bg-card/40 border border-mist">
                    <p><span className="text-ink font-medium">Subsector:</span> {SUBSECTORS.find(s => s.id === selectedSubsector)?.label}</p>
                    <p><span className="text-ink font-medium">Revenue model:</span> {revenueModel}</p>
                    <p><span className="text-ink font-medium">Scale:</span> {arrBand}</p>
                    <p><span className="text-ink font-medium">Biggest concern:</span> {biggestConcern}</p>
                  </div>
                  <textarea value={promptText} onChange={e => setPromptText(e.target.value)}
                    placeholder="Tell us what is happening in the business right now — what has brought you to this diagnostic?"
                    rows={5} className="w-full border border-slate/30 bg-white px-4 py-3 text-sm text-paper placeholder-slate focus:outline-none focus:border-accent resize-none" />
                  <div className="flex items-center justify-between">
                    <button onClick={() => setIntakeStep(2)} className="text-sm text-slate hover:text-ink transition-colors">← Back</button>
                    <button onClick={startDiagnostic} disabled={!promptText.trim()}
                      className="inline-flex items-center gap-3 bg-white text-paper px-8 py-3 text-sm tracking-wide hover:bg-accent hover:text-paper transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate/20">
                      Start diagnostic <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {intakeStep < 3 && (
                <button onClick={() => intakeStep === 0 ? setStage("subsector") : setIntakeStep(prev => (prev - 1) as IntakeStep)}
                  className="text-sm text-slate hover:text-ink transition-colors">← Back</button>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── DIAGNOSTIC + DEEP DIVE ── */}
      {(stage === "diagnostic" || stage === "deepdive") && (
        <main className={`pb-0 min-h-screen flex flex-col ${showFramework ? "pt-36" : "pt-20"}`}>
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-3xl mx-auto space-y-8">

              {messages.map((m, i) => {
                const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                if (m.role === "user") {
                  // Hide the initial structured intake message
                  if (i === 0) return null;
                  return (
                    <div key={i} className="animate-fade-in pl-12">
                      <div className="bg-white/10 border border-slate/30 px-5 py-4">
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
                    <div className="prose-analysis text-sm text-ink leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(clean) }} />
                    {chart && <ChartBlock spec={chart} />}

                    {/* Options — shown on last message while awaiting answer */}
                    {isLastAssistant && inlineOptions.length > 0 && !streaming && diagnosticPhase !== "complete" && messages.filter(m => m.role === "assistant").length < 4 && (
                      <div className="mt-6 space-y-3">
                        <div className="space-y-2">
                          {inlineOptions.map(opt => (
                            <button key={opt} onClick={() => setSelectedOption(prev => prev === opt ? "" : opt)}
                              className={`w-full text-left px-4 py-3 text-sm border transition-all ${selectedOption === opt ? "border-accent bg-accent/10 text-accent" : "border-slate/30 bg-white/8 text-ink hover:border-accent hover:bg-white/15"}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        <textarea value={optionFreeText} onChange={e => setOptionFreeText(e.target.value)}
                          placeholder="Add more detail (optional)…" rows={2}
                          className="w-full border border-slate/30 bg-white px-3 py-2 text-xs text-paper placeholder-slate focus:outline-none focus:border-accent resize-none" />
                        <div className="flex gap-3">
                          <button disabled={!selectedOption || streaming} onClick={submitOption}
                            className="flex-1 bg-card text-ink text-xs py-2.5 hover:bg-accent hover:text-paper transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            Continue <ArrowRight size={13} />
                          </button>
                          <button onClick={() => setSummaryOpen(true)}
                            className="border border-mist text-slate text-xs px-4 py-2.5 hover:border-ink hover:text-ink transition-all flex items-center gap-2">
                            <FileText size={13} /> Get summary
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Deep dive domain selection — shown after diagnostic complete */}
                    {isLastAssistant && (diagnosticPhase === "complete" || messages.filter(m => m.role === "assistant").length >= 4) && stage === "diagnostic" && !streaming && (
                      <div className="mt-8 space-y-4">
                        {pendingDeepDive ? (
                          /* Context input — shown after selecting a domain */
                          <div className="border border-accent/30 bg-card/60 p-5 space-y-4">
                            <div>
                              <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">{pendingDeepDive.label}</p>
                              <p className="text-sm font-medium text-ink">Anything specific you want the deep dive to focus on?</p>
                              <p className="text-xs text-slate mt-1 leading-relaxed">Optional — leave blank to proceed with what Scaler already knows.</p>
                            </div>
                            <textarea
                              value={deepDiveContext}
                              onChange={e => setDeepDiveContext(e.target.value)}
                              placeholder="e.g. We are considering entering Germany next quarter. Our current banking partner has indicated they may not support this..."
                              rows={3}
                              className="w-full border border-slate/30 bg-white px-3 py-2.5 text-sm text-paper placeholder-slate focus:outline-none focus:border-accent resize-none leading-relaxed"
                            />
                            <div className="flex items-center gap-3">
                              <button onClick={() => startDeepDive(pendingDeepDive, deepDiveContext)}
                                className="inline-flex items-center gap-2 bg-white text-paper text-xs px-5 py-2.5 border border-slate/30 hover:bg-accent hover:text-paper transition-colors">
                                Begin deep dive <ArrowRight size={12} />
                              </button>
                              <button onClick={() => setPendingDeepDive(null)} className="text-xs text-slate hover:text-ink transition-colors">← Back</button>
                            </div>
                          </div>
                        ) : (
                          /* Domain selection */
                          <>
                            <div className="border-l-2 border-accent pl-4 py-1">
                              <p className="text-sm text-ink leading-relaxed">The diagnostic is complete. Select a domain to go deeper — Scaler will give you the full structural picture, the conditions that must hold, and a scenario model.</p>
                            </div>
                            <p className="text-xs font-mono text-slate uppercase tracking-wide">Go deeper on a domain</p>
                            <div className="space-y-2">
                              {DOMAINS.map(d => (
                                <button key={d.id} onClick={() => setPendingDeepDive(d)}
                                  className="w-full text-left border border-mist px-5 py-4 hover:border-accent hover:bg-card/60 transition-all group flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-mono text-accent mb-1">{String(d.id).padStart(2, "0")}</p>
                                    <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors">{d.label}</p>
                                    <p className="text-xs text-slate mt-0.5">{d.question}</p>
                                  </div>
                                  <ArrowRight size={15} className="text-mist group-hover:text-accent flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Deep dive complete — send to finish screen */}
                    {isLastAssistant && stage === "deepdive" && !streaming && (
                      <div className="mt-10 pt-8 border-t border-mist">
                        <p className="text-xs text-slate mb-5 leading-relaxed">That is the full structural picture on this domain. Your next steps and report are on the following screen.</p>
                        <button onClick={() => setStage("complete")}
                          className="inline-flex items-center gap-2 bg-white text-paper text-sm px-6 py-3 border border-slate/20 hover:bg-accent hover:text-paper hover:border-accent transition-colors font-medium">
                          See next steps <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming */}
              {streaming && streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                  <div className="prose-analysis text-sm text-ink leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(hidePartialTags(streamedText)) }} />
                  <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
                </div>
              )}
              {streaming && !streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="pb-32" />
            </div>
          </div>
        </main>
      )}

      {/* ── COMPLETION SCREEN ── */}
      {stage === "complete" && (
        <main className="min-h-screen px-6 py-20">
          <div className="max-w-lg mx-auto w-full space-y-10">

            {/* Heading */}
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-4">Scaler · Complete</p>
              <h1 className="font-display text-4xl font-medium text-ink mb-4 leading-tight">The diagnostic is complete.</h1>
              <p className="text-slate text-base leading-relaxed">
                Scaler has mapped the structural picture. The questions it has surfaced are the ones worth sitting with — they tend to be more useful than the answers.
              </p>
            </div>

            {/* Get the report — primary CTA */}
            <div className="opacity-0 animate-fade-up border border-accent/30 bg-accent/5 p-6" style={{ animationFillMode: "forwards", animationDelay: "0.2s" }}>
              <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">Get your report</p>
              <p className="text-sm font-medium text-ink mb-1">Receive the full diagnostic as a Word document</p>
              <p className="text-xs text-slate mb-4 leading-relaxed">Everything Scaler found — the five domain verdicts, the deep dive analysis, and the questions your business cannot yet answer — formatted and ready to share.</p>
              {reportStatus === "sent" ? (
                <p className="text-sm text-accent font-medium">✓ On its way — check your inbox.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && reportEmail.trim()) { setReportStatus("sending"); sendEmail(reportEmail, "report", () => setReportStatus("sent"), () => setReportStatus("error")); }}}
                      placeholder="you@yourcompany.com"
                      className="flex-1 border border-slate/30 bg-white px-3 py-2.5 text-sm text-paper placeholder-slate focus:outline-none focus:border-accent" />
                    <button onClick={() => { setReportStatus("sending"); sendEmail(reportEmail, "report", () => setReportStatus("sent"), () => setReportStatus("error")); }}
                      disabled={!reportEmail.trim() || reportStatus === "sending"}
                      className="inline-flex items-center gap-1.5 bg-accent text-paper px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-40 whitespace-nowrap font-medium">
                      <Send size={13} /> {reportStatus === "sending" ? "Sending…" : "Send to my inbox"}
                    </button>
                  </div>
                  {reportStatus === "error" && <p className="text-xs text-red-400">Something went wrong — try again.</p>}
                </div>
              )}
            </div>

            {/* Discuss */}
            <div className="opacity-0 animate-fade-up border border-mist p-6" style={{ animationFillMode: "forwards", animationDelay: "0.3s" }}>
              <p className="text-xs font-mono text-accent uppercase tracking-wide mb-3">Talk it through</p>
              <p className="text-sm text-ink leading-relaxed mb-4">
                If anything in the diagnostic raised a question you want to think through further, I am happy to do that with you — no charge, no pitch.
              </p>
              <p className="text-sm font-medium text-ink mb-0.5">Martin Koderisch</p>
              <p className="text-xs text-slate mb-3">Founder, Scalepoint Partners</p>
              <div className="space-y-1.5">
                <p className="text-sm text-ink">
                  <a href="mailto:martin@scalepointpartners.com" className="hover:text-accent transition-colors">martin@scalepointpartners.com</a>
                </p>
                <p className="text-sm text-ink">
                  <a href="https://scalepointpartners.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">scalepointpartners.com</a>
                </p>
              </div>
            </div>

            {/* Run again */}
            <div className="opacity-0 animate-fade-up" style={{ animationFillMode: "forwards", animationDelay: "0.4s" }}>
              <button onClick={reset} className="text-xs text-slate hover:text-ink transition-colors">← Run another diagnostic</button>
            </div>

          </div>
        </main>
      )}

      {/* ── SUMMARY MODAL ── */}
      {summaryOpen && (
        <div className="fixed inset-0 bg-paper/80 backdrop-blur-sm z-50 flex items-center justify-center px-6">
          <div className="bg-white p-6 w-full max-w-sm shadow-xl border border-slate/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-paper">Get Word doc summary</p>
              <button onClick={() => { setSummaryOpen(false); setSummaryStatus("idle"); }} className="text-slate hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate mb-4 leading-relaxed">We will send a Word document summary of the diagnostic so far to your inbox.</p>
            {summaryStatus === "sent" ? (
              <p className="text-xs text-accent font-medium">✓ Sent — check your inbox.</p>
            ) : (
              <>
                <input type="email" value={summaryEmail} onChange={e => setSummaryEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && summaryEmail.trim()) { setSummaryStatus("sending"); sendEmail(summaryEmail, "report", () => setSummaryStatus("sent"), () => setSummaryStatus("error")); }}}
                  placeholder="you@yourcompany.com"
                  className="w-full border border-slate/30 bg-white px-3 py-2.5 text-sm text-paper placeholder-slate focus:outline-none focus:border-accent mb-3" />
                <button onClick={() => { setSummaryStatus("sending"); sendEmail(summaryEmail, "report", () => setSummaryStatus("sent"), () => setSummaryStatus("error")); }}
                  disabled={!summaryEmail.trim() || summaryStatus === "sending"}
                  className="w-full bg-accent text-paper text-xs py-2.5 hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 font-medium">
                  <Send size={12} /> {summaryStatus === "sending" ? "Sending…" : "Send to my inbox"}
                </button>
                {summaryStatus === "error" && <p className="text-xs text-red-500 mt-2">Something went wrong.</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
