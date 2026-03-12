import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, LevelFormat, PageBreak,
} from "docx";

export interface AnalysisData {
  question: string;
  businessName: string;
  context: string;
  findings: string;
  timestamp: string;
  userEmail?: string;
}

// ── Clean raw model output before parsing ─────────────────────────────────
function cleanFindings(raw: string): string {
  return raw
    // Remove XML-style tags the model emits
    .replace(/<chart>[\s\S]*?<\/chart>/gi, "")
    .replace(/<options>[\s\S]*?<\/options>/gi, "")
    .replace(/<domains>[\d,\s]*<\/domains>/gi, "")
    // Remove partial/unclosed tags
    .replace(/<chart>[\s\S]*/gi, "")
    .replace(/<options>[\s\S]*/gi, "")
    .replace(/<domains>[\s\S]*/gi, "")
    // Remove the Word doc / email prompt sentences
    .replace(/I have prepared a Word document[^.]*\./gi, "")
    .replace(/I can prepare a full Word document[^.]*\./gi, "")
    .replace(/Enter your email below[^.]*\./gi, "")
    .replace(/choose a domain to explore[^.]*\./gi, "")
    // Remove markdown horizontal rules
    .replace(/^---+$/gm, "")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Parse bold headings into sections ─────────────────────────────────────
function parseSections(text: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  // Split on **HEADING** patterns
  const parts = text.split(/\*\*([^*\n]+)\*\*/);
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({
      heading: parts[i].trim(),
      body: (parts[i + 1] || "").trim(),
    });
  }
  if (sections.length === 0) {
    sections.push({ heading: "Diagnostic", body: text.trim() });
  }
  return sections;
}

// ── Render a body block into Paragraph nodes ──────────────────────────────
function renderBody(body: string): Paragraph[] {
  const paras: Paragraph[] = [];
  const lines = body.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Verdict line: "Verdict: STRUCTURALLY SOUND" etc
    if (/^Verdict:/i.test(line)) {
      const label = line.replace(/^Verdict:\s*/i, "").trim();
      const colour = verdictColour(label);
      paras.push(new Paragraph({
        children: [
          new TextRun({ text: "Verdict: ", size: 20, bold: true, color: "595959", font: "Arial" }),
          new TextRun({ text: label, size: 20, bold: true, color: colour, font: "Arial" }),
        ],
        spacing: { before: 80, after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: colour, space: 4 } },
      }));
      continue;
    }

    // Bullet line
    if (/^[-•]\s/.test(line)) {
      const clean = line.replace(/^[-•]\s+/, "");
      paras.push(new Paragraph({
        children: [new TextRun({ text: clean, size: 20, color: "404040", font: "Arial" })],
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 60 },
      }));
      continue;
    }

    // Sub-heading (ALL CAPS line or wrapped in *)
    if (/^\*[^*]+\*$/.test(line) || (line === line.toUpperCase() && line.length > 4 && /[A-Z]/.test(line))) {
      const clean = line.replace(/^\*([^*]+)\*$/, "$1");
      paras.push(new Paragraph({
        children: [new TextRun({ text: clean, size: 20, bold: true, color: "2E4A7A", font: "Arial" })],
        spacing: { before: 160, after: 80 },
      }));
      continue;
    }

    // Plain paragraph — handle inline **bold**
    const runs = parseInlineBold(line);
    paras.push(new Paragraph({
      children: runs,
      spacing: { after: 100 },
    }));
  }

  return paras;
}

function parseInlineBold(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/\*\*([^*]+)\*\*/);
  parts.forEach((part, i) => {
    if (!part) return;
    runs.push(new TextRun({
      text: part,
      bold: i % 2 === 1,
      size: 20,
      color: i % 2 === 1 ? "222747" : "404040",
      font: "Arial",
    }));
  });
  return runs.length ? runs : [new TextRun({ text: text, size: 20, color: "404040", font: "Arial" })];
}

function verdictColour(label: string): string {
  const u = label.toUpperCase();
  if (u.includes("STRUCTURALLY SOUND")) return "1A7A4A";
  if (u.includes("UNDER PRESSURE")) return "B86A00";
  if (u.includes("CRITICAL CONSTRAINT")) return "B22222";
  return "595959"; // INSUFFICIENT DATA
}

// ── Main export ───────────────────────────────────────────────────────────
export async function generateDocx(data: AnalysisData): Promise<Buffer> {
  const cleaned = cleanFindings(data.findings);
  const sections = parseSections(cleaned);

  const children: Paragraph[] = [];

  // ── Cover / header ────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Scaler", bold: true, size: 52, color: "222747", font: "Georgia" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Structural Diagnostic for Payments & Fintech", size: 24, color: "5C6387", font: "Arial", italics: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.businessName || "Business", bold: true, size: 28, color: "222747", font: "Arial" })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.timestamp, size: 18, color: "8B93B8", font: "Arial" })],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "ECFFE3", space: 1 } },
    }),
  );

  // ── Business context ──────────────────────────────────────────────────
  if (data.context?.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "BUSINESS CONTEXT", bold: true, size: 18, color: "8B93B8", font: "Arial" })],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: data.context, size: 20, color: "404040", font: "Arial" })],
        spacing: { after: 320 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 1 } },
      }),
    );
  }

  // ── Analysis sections ─────────────────────────────────────────────────
  sections.forEach(section => {
    // Skip metadata-only headings
    if (/^(SCALER|options|domains|chart)/i.test(section.heading)) return;

    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: 22, color: "222747", font: "Arial" })],
        spacing: { before: 320, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 },
        },
      }),
      ...renderBody(section.body),
    );
  });

  // ── Contact page ──────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [new TextRun({ text: "Scaler", bold: true, size: 40, color: "222747", font: "Georgia" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Built by Scalepoint Partners", size: 22, color: "5C6387", font: "Arial", italics: true })],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 1 } },
    }),
    new Paragraph({
      children: [new TextRun({ text: "If this diagnostic raised questions worth thinking through further, I would be glad to speak.", size: 22, color: "222747", font: "Arial" })],
      spacing: { before: 200, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Scaler surfaces the structural questions. Sometimes the most useful next step is a focused 30-minute conversation to work through what they mean for your specific situation — the constraints, the sequencing, and the decisions that need to be made.", size: 20, color: "404040", font: "Arial" })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Martin Koderisch", bold: true, size: 24, color: "222747", font: "Arial" })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Founder, Scalepoint Partners", size: 20, color: "5C6387", font: "Arial" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "martin@scalepointpartners.com", size: 20, color: "2E4A7A", font: "Arial" })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "scalepointpartners.com", size: 20, color: "2E4A7A", font: "Arial" })],
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Scalepoint Partners — Strategic finance for payments and fintech", size: 16, color: "AAAAAA", font: "Arial", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: "EEEEEE", space: 1 } },
    }),
  );

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "–",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc) as unknown as Buffer;
}
