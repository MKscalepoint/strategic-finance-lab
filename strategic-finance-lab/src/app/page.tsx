"use client";

import { useState, useRef, useEffect } from "react";
import { QUESTIONS } from "@/lib/prompt";
import { ArrowRight, Download, RotateCcw, ChevronRight } from "lucide-react";

type Stage = "landing" | "select" | "intake" | "analysis";

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

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, (m) =>
      m.startsWith("<") ? m : `<p>${m}</p>`
    );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedQ, setSelectedQ] = useState<SelectedQuestion | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  // ── Start analysis ────────────────────────────────────────
  async function startAnalysis() {
    if (!selectedQ || !businessContext.trim()) return;

    const initialMessage = `Business: ${businessName || "Not specified"}

Context: ${businessContext}

Please begin the analysis.`;

    const newMessages: Message[] = [{ role: "user", content: initialMessage }];
    setMessages(newMessages);
    setStage("analysis");
    await streamResponse(newMessages);
  }

  // ── Stream a response ─────────────────────────────────────
  async function streamResponse(msgs: Message[]) {
    if (!selectedQ) return;
    setStreaming(true);
    setStreamedText("");

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          questionLabel: selectedQ.label,
          question: selectedQ.question,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamedText(accumulated);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: accumulated },
      ]);
      setStreamedText("");

      // Check if analysis looks complete
      if (
        accumulated.toLowerCase().includes("recommended actions") ||
        accumulated.toLowerCase().includes("excel model")
      ) {
        setAnalysisComplete(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I encountered an error. Please check your API key configuration and try again.",
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  // ── Send follow-up ────────────────────────────────────────
  async function sendMessage() {
    if (!userInput.trim() || streaming) return;
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userInput.trim() },
    ];
    setMessages(newMessages);
    setUserInput("");
    await streamResponse(newMessages);
  }

  // ── Export Excel ──────────────────────────────────────────
  async function exportExcel() {
    if (!selectedQ) return;

    const allText = messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n\n---\n\n");

    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: selectedQ.question,
        businessName: businessName || "Business",
        context: businessContext,
        findings: allText,
        timestamp: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      }),
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategic-finance-analysis-${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Reset ─────────────────────────────────────────────────
  function reset() {
    setStage("landing");
    setSelectedQ(null);
    setBusinessName("");
    setBusinessContext("");
    setMessages([]);
    setUserInput("");
    setStreamedText("");
    setAnalysisComplete(false);
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-mist bg-paper/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={reset}
            className="font-display text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors"
          >
            Strategic Finance Lab
          </button>
          {stage !== "landing" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm text-slate hover:text-ink transition-colors"
            >
              <RotateCcw size={14} />
              Start over
            </button>
          )}
        </div>
      </header>

      {/* ── LANDING ── */}
      {stage === "landing" && (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}
            >
              <p className="text-slate text-sm tracking-widest uppercase mb-6 font-mono">
                Pilot — Invitation Only
              </p>
            </div>
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards", animationDelay: "0.25s" }}
            >
              <h1 className="font-display text-5xl font-medium leading-tight mb-6 text-ink">
                Strategic
                <br />
                Finance Lab
              </h1>
            </div>
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards", animationDelay: "0.4s" }}
            >
              <p className="text-slate text-lg mb-4 leading-relaxed">
                A guided analytical environment for the structural finance
                questions that shape the trajectory of growth companies.
              </p>
              <p className="text-slate text-base mb-12 leading-relaxed">
                Not a reporting tool. Not a forecast generator. A framework for
                thinking clearly about the economic behaviour of your business.
              </p>
            </div>
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationFillMode: "forwards", animationDelay: "0.55s" }}
            >
              <button
                onClick={() => setStage("select")}
                className="inline-flex items-center gap-3 bg-ink text-paper px-8 py-4 text-sm tracking-wide hover:bg-accent transition-colors duration-300"
              >
                Begin analysis
                <ArrowRight size={16} />
              </button>
            </div>

            <div
              className="opacity-0 animate-fade-up mt-20 border-t border-mist pt-12"
              style={{ animationFillMode: "forwards", animationDelay: "0.7s" }}
            >
              <div className="grid grid-cols-3 gap-8 text-left">
                {[
                  {
                    n: "01",
                    t: "Select a question",
                    d: "Choose the strategic finance question most relevant to your current decision.",
                  },
                  {
                    n: "02",
                    t: "Provide context",
                    d: "Describe your business and the specific decision or concern you are working through.",
                  },
                  {
                    n: "03",
                    t: "Work through the analysis",
                    d: "The advisor guides you step by step, explaining its reasoning throughout.",
                  },
                ].map((s) => (
                  <div key={s.n}>
                    <p className="font-mono text-xs text-accent mb-2">{s.n}</p>
                    <p className="font-display text-sm font-medium text-ink mb-1">
                      {s.t}
                    </p>
                    <p className="text-xs text-slate leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── SELECT QUESTION ── */}
      {stage === "select" && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div
              className="opacity-0 animate-fade-up mb-12"
              style={{ animationFillMode: "forwards" }}
            >
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">
                Step 1 of 2
              </p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">
                Select your question
              </h2>
              <p className="text-slate text-base">
                Each question activates a specific analytical lens. Choose the
                one closest to your current concern.
              </p>
            </div>

            <div className="space-y-3">
              {QUESTIONS.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQ(q);
                    setStage("intake");
                  }}
                  className="opacity-0 animate-fade-up w-full text-left border border-mist bg-paper hover:border-accent hover:bg-white/60 transition-all duration-200 p-6 group"
                  style={{
                    animationFillMode: "forwards",
                    animationDelay: `${0.1 + i * 0.08}s`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-xs text-slate">
                          0{q.id}
                        </span>
                        <span className="text-xs text-accent font-medium tracking-wide uppercase">
                          {q.label}
                        </span>
                      </div>
                      <p className="font-display text-lg font-medium text-ink mb-2 leading-snug">
                        {q.question}
                      </p>
                      <p className="text-sm text-slate leading-relaxed">
                        {q.description}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-mist group-hover:text-accent transition-colors mt-1 flex-shrink-0"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── INTAKE ── */}
      {stage === "intake" && selectedQ && (
        <main className="min-h-screen pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <div
              className="opacity-0 animate-fade-up mb-10"
              style={{ animationFillMode: "forwards" }}
            >
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">
                Step 2 of 2
              </p>
              <h2 className="font-display text-3xl font-medium text-ink mb-3">
                Describe your business
              </h2>
              <div className="border-l-2 border-accent pl-4 py-1">
                <p className="text-sm text-slate italic">{selectedQ.question}</p>
              </div>
            </div>

            <div
              className="opacity-0 animate-fade-up space-y-6"
              style={{
                animationFillMode: "forwards",
                animationDelay: "0.15s",
              }}
            >
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Business name{" "}
                  <span className="text-slate font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Financial Services"
                  className="w-full border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:border-accent transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Business context{" "}
                  <span className="text-slate font-normal">
                    — what do you need us to know?
                  </span>
                </label>
                <p className="text-xs text-slate mb-3 leading-relaxed">
                  Describe what your business does, how it generates revenue,
                  where you are in the growth journey, and what has prompted
                  this question. The more specific you are, the more precise
                  the analysis.
                </p>
                <textarea
                  ref={textareaRef}
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  placeholder="e.g. We are an FX forward brokerage serving UK SMEs with cross-border payment requirements. We have 140 active clients, execute roughly 4 trades per client per month at an average notional of £85k, and earn a realised spread of around 45bps. Revenue is growing at 35% year on year but we have not reached profitability..."
                  rows={8}
                  className="w-full border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStage("select")}
                  className="text-sm text-slate hover:text-ink transition-colors"
                >
                  ← Change question
                </button>
                <button
                  onClick={startAnalysis}
                  disabled={!businessContext.trim()}
                  className="inline-flex items-center gap-3 bg-ink text-paper px-8 py-3 text-sm tracking-wide hover:bg-accent transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Begin analysis
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── ANALYSIS ── */}
      {stage === "analysis" && selectedQ && (
        <main className="pt-20 pb-0 min-h-screen flex flex-col">
          {/* Question banner */}
          <div className="border-b border-mist bg-paper/80 px-6 py-3">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <span className="font-mono text-xs text-accent">
                {selectedQ.label}
              </span>
              <span className="text-slate text-xs">·</span>
              <span className="text-xs text-slate italic">
                {selectedQ.question}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`animate-fade-in ${
                    m.role === "user" ? "pl-12" : ""
                  }`}
                >
                  {m.role === "user" ? (
                    <div className="bg-mist/60 border border-mist px-5 py-4">
                      <p className="text-xs font-mono text-slate mb-2 uppercase tracking-wide">
                        You
                      </p>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">
                        Strategic Finance Advisor
                      </p>
                      <div
                        className="prose-analysis text-sm text-ink"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(m.content),
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming text */}
              {streaming && streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">
                    Strategic Finance Advisor
                  </p>
                  <div
                    className="prose-analysis text-sm text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(streamedText),
                    }}
                  />
                  <span className="inline-block w-2 h-4 bg-accent animate-cursor ml-0.5 -mb-0.5" />
                </div>
              )}

              {/* Thinking indicator */}
              {streaming && !streamedText && (
                <div className="animate-fade-in">
                  <p className="text-xs font-mono text-accent mb-3 uppercase tracking-wide">
                    Strategic Finance Advisor
                  </p>
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-slate animate-pulse"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Excel download prompt */}
              {analysisComplete && !streaming && (
                <div className="animate-fade-in border border-accent/30 bg-accent/5 p-5">
                  <p className="text-sm font-medium text-ink mb-1">
                    Analysis complete
                  </p>
                  <p className="text-xs text-slate mb-4">
                    Download a supporting Excel model with the quantitative
                    representation of this analysis.
                  </p>
                  <button
                    onClick={exportExcel}
                    className="inline-flex items-center gap-2 bg-accent text-paper px-5 py-2.5 text-xs tracking-wide hover:bg-accent-light transition-colors"
                  >
                    <Download size={13} />
                    Download Excel model
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-mist bg-paper/95 backdrop-blur-sm px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-end">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Provide data, ask to go deeper, or respond to the advisor's questions…"
                  rows={2}
                  disabled={streaming}
                  className="flex-1 border border-mist bg-white/60 px-4 py-3 text-ink placeholder-slate/50 focus:outline-none focus:border-accent transition-colors text-sm leading-relaxed resize-none disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!userInput.trim() || streaming}
                  className="bg-ink text-paper px-5 py-3 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="text-xs text-slate/60 mt-2">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
