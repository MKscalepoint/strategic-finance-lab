"use client";

import { useState, useRef, useEffect } from "react";
import { QUESTIONS } from "@/lib/prompt";
import { ArrowRight, RotateCcw, Send } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

type Stage = "landing" | "select" | "intake" | "analysis";
type EmailStatus = "idle" | "sending" | "sent" | "error";
type DomainState = "inactive" | "touched" | "active";
type ScenarioKey = "base" | "upside" | "downside";

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

const DOMAIN_KEYWORDS: Record<number, string[]> = {
  1: ["growth", "cohort", "churn", "acquisition", "structural", "repeatable", "wave", "retention", "nrr", "arr growth"],
  2: ["scale", "scaling", "margin", "leverage", "operating model", "complexity", "cost structure", "inflection", "fixed cost"],
  3: ["profitability", "breakeven", "contribution margin", "path to profit", "burn", "runway", "ebitda", "unit economics"],
  4: ["capital", "allocation", "invest", "return", "sequencing", "priorit", "deploy", "roi", "payback"],
  5: ["hire", "hiring", "headcount", "team", "people", "talent", "payroll", "ahead of revenue"],
};

function detectDomains(text: string): Record<number, "touched" | "active"> {
  const lower = text.toLowerCase();
  const result: Record<number, "touched" | "active"> = {};
  for (const [id, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matches = keywords.filter(k => lower.includes(k)).length;
    if (matches >= 3) result[Number(id)] = "active";
    else if (matches >= 1) result[Number(id)] = "touched";
  }
  return result;
}

// Extract chart JSON from text
function extractChart(text: string): { clean: string; chart: ChartSpec | null } {
  const match = text.match(/<chart>([\s\S]*?)<\/chart>/);
  if (!match) return { clean: text, chart: null };
  try {
    const chart = JSON.parse(match[1].trim()) as ChartSpec;
    const clean = text.replace(/<chart>[\s\S]*?<\/chart>/, "").trim();
    return { clean, chart };
  } catch {
    return { clean: text.replace(/<chart>[\s\S]*?<\/chart>/, "").trim(), chart: null };
  }
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
    <div className="my-6 border border-mist bg-white/60 p-5">
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
  const [userEmail, setUserEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [domainStates, setDomainStates] = useState<Record<number, DomainState>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  function updateDomains(allAssistantText: string, primaryId: number) {
    const detected = detectDomains(allAssistantText);
    const newStates: Record<number, DomainState> = {};
    DOMAINS.forEach(d => {
      if (d.id === primaryId) newStates[d.id] = "active";
      else if (detected[d.id] === "active") newStates[d.id] = "active";
      else if (detected[d.id] === "touched") newStates[d.id] = "touched";
      else newStates[d.id] = "inactive";
    });
    setDomainStates(newStates);
  }

  async function startAnalysis() {
    if (!selectedQ || !businessContext.trim()) return;
    const initialMessage = `Business: ${businessName || "Not specified"}\n\nContext: ${businessContext}\n\nPlease begin the analysis.`;
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
      const allAssistantText = finalMessages.filter(m => m.role === "assistant").map(m => m.content).join(" ");
      updateDomains(allAssistantText, primaryId ?? selectedQ.id);
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
          timestamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setEmailStatus("sent");
    } catch {
      setEmailStatus("error");
    }
  }

  function reset() {
    setStage("landing");
    setSelectedQ(null);
    setUserEmail("");
    setBusinessName("");
    setBusinessContext("");
    setMessages([]);
    setUserInput("");
    setStreamedText("");
    setAnalysisComplete(false);
    setEmailStatus("idle");
    setDomainStates({});
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
                  onClick={() => { setSelectedQ(d); setStage("intake"); }}
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

      {/* INTAKE */}
      {stage === "intake" && selectedQ && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="opacity-0 animate-fade-up mb-10" style={{ animationFillMode: "forwards" }}>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">Domain selected</p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">Describe your business</h2>
              <p className="text-slate text-base">The more specific you are, the more precise the analysis.</p>
            </div>
            <div className="opacity-0 animate-fade-up mb-8" style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}>
              <div className="border-l-2 border-accent pl-4 py-1">
                <p className="text-xs font-mono text-accent uppercase tracking-wide mb-1">{selectedQ.label}</p>
                <p className="text-sm text-slate italic">{selectedQ.question}</p>
              </div>
            </div>
            <div className="opacity-0 animate-fade-up space-y-6" style={{ animationFillMode: "forwards", animationDelay: "0.15s" }}>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Business name <span className="text-slate font-normal">(optional)</span></label>
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Acme Financial Services" className="w-full border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:border-accent transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Business context <span className="text-slate font-normal">— what do you need us to know?</span></label>
                <p className="text-xs text-slate mb-3 leading-relaxed">Describe what your business does, how it generates revenue, where you are in the growth journey, and what has prompted this question.</p>
                <textarea ref={textareaRef} value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} placeholder="e.g. We are an FX forward brokerage serving UK SMEs..." rows={8} className="w-full border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStage("select")} className="text-sm text-slate hover:text-ink transition-colors">← Change domain</button>
                <button onClick={startAnalysis} disabled={!businessContext.trim()} className="inline-flex items-center gap-3 bg-ink text-paper px-8 py-3 text-sm tracking-wide hover:bg-accent transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed">
                  Begin analysis <ArrowRight size={15} />
                </button>
              </div>
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
                  </div>
                );
              })}

              {streaming && streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">Scaler</p>
                  <div className="prose-analysis text-sm text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdown(extractChart(streamedText).clean) }} />
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

              {analysisComplete && !streaming && (
                <div className="animate-fade-in border border-accent/30 bg-accent/5 p-6">
                  <p className="text-sm font-medium text-ink mb-1">Analysis complete</p>
                  <p className="text-xs text-slate mb-5 leading-relaxed">Enter your email to receive the full Word doc briefing and financial model.</p>
                  {emailStatus === "sent" ? (
                    <div className="flex items-center gap-2 text-sm text-accent font-medium">
                      <span>✓</span><span>Sent to {userEmail} — check your inbox.</span>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-start">
                      <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && userEmail.trim()) sendByEmail(); }} placeholder="you@yourcompany.com" className="flex-1 border border-mist bg-white/80 px-4 py-2.5 text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors text-sm" />
                      <button onClick={sendByEmail} disabled={!userEmail.trim() || emailStatus === "sending"} className="inline-flex items-center gap-2 bg-accent text-paper px-5 py-2.5 text-xs tracking-wide hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                        {emailStatus === "sending" ? <>Sending…</> : <><Send size={12} /> Send to my inbox</>}
                      </button>
                    </div>
                  )}
                  {emailStatus === "error" && <p className="text-xs text-red-500 mt-2">Something went wrong. Please try again.</p>}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-mist bg-paper/95 backdrop-blur-sm px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-end">
                <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Provide data, ask to go deeper, or respond to Scaler's questions…" rows={2} disabled={streaming} className="flex-1 border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none disabled:opacity-50" />
                <button onClick={sendMessage} disabled={!userInput.trim() || streaming} className="bg-ink text-paper px-5 py-3 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="text-xs text-slate/60 mt-2">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
