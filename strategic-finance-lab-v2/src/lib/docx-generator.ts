import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, LevelFormat, HeadingLevel
} from "docx";

export interface AnalysisData {
  question: string;
  businessName: string;
  context: string;
  findings: string;
  timestamp: string;
  userEmail?: string;
}

function parseFindings(findings: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];
  const parts = findings.split(/\*\*([^*]+)\*\*/);
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({
      heading: parts[i].trim(),
      content: parts[i + 1]?.trim() || "",
    });
  }
  // If no bold headings found, treat as single block
  if (sections.length === 0) {
    sections.push({ heading: "Analysis", content: findings.trim() });
  }
  return sections;
}

export async function generateDocx(data: AnalysisData): Promise<Buffer> {
  const sections = parseFindings(data.findings);

  const children: Paragraph[] = [
    // Header
    new Paragraph({
      children: [new TextRun({ text: "Payments & Fintech Scaling Advisor", bold: true, size: 36, color: "1F3864", font: "Arial" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.businessName, bold: true, size: 26, color: "2E75B6", font: "Arial" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.question, size: 20, italics: true, color: "595959", font: "Arial" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.timestamp, size: 18, color: "7F7F7F", font: "Arial" })],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } },
    }),

    // Context section
    new Paragraph({
      children: [new TextRun({ text: "BUSINESS CONTEXT", bold: true, size: 22, color: "1F3864", font: "Arial" })],
      spacing: { before: 200, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "BDD7EE", space: 1 } },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.context, size: 20, color: "404040", font: "Arial" })],
      spacing: { after: 320 },
    }),
  ];

  // Analysis sections
  sections.forEach((section) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: 22, color: "1F3864", font: "Arial" })],
        spacing: { before: 320, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "BDD7EE", space: 1 } },
      })
    );

    const lines = section.content.split("\n").filter((l) => l.trim());
    lines.forEach((line) => {
      const isNumbered = /^\d+\./.test(line.trim());
      const isBullet = /^[-•]/.test(line.trim());
      const isSubheading = /^\*[^*]+\*$/.test(line.trim()) || line.trim().startsWith("*") && line.trim().endsWith("*");
      
      const clean = line
        .replace(/^\d+\.\s*/, "")
        .replace(/^[-•]\s*/, "")
        .replace(/^\*([^*]+)\*$/, "$1")
        .trim();

      if (!clean) return;

      if (isSubheading) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: clean, bold: true, size: 20, color: "2E75B6", font: "Arial" })],
            spacing: { before: 200, after: 80 },
          })
        );
      } else if (isNumbered || isBullet) {
        children.push(
          new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: clean, size: 20, color: "404040", font: "Arial" })],
            spacing: { after: 80 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: clean, size: 20, color: "404040", font: "Arial" })],
            spacing: { after: 120 },
          })
        );
      }
    });
  });

  // Footer
  children.push(
    new Paragraph({
      children: [],
      spacing: { before: 480 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Payments & Fintech Scaling Advisor  |  Confidential  |  ", size: 16, color: "7F7F7F", font: "Arial", italics: true }),
        new TextRun({ text: data.timestamp, size: 16, color: "7F7F7F", font: "Arial", italics: true }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
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
