import * as XLSX from "xlsx";

export interface AnalysisData {
  question: string;
  businessName: string;
  context: string;
  findings: string;
  timestamp: string;
}

export function generateExcel(data: AnalysisData): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Summary sheet ──────────────────────────────────────────
  const summaryRows = [
    ["Strategic Finance Lab", "", ""],
    ["", "", ""],
    ["Business", data.businessName],
    ["Question", data.question],
    ["Date", data.timestamp],
    ["", "", ""],
    ["Context Provided", "", ""],
    [data.context, "", ""],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 60 }, { wch: 20 }];
  summarySheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // ── Analysis findings sheet ────────────────────────────────
  const findingLines = data.findings
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const findingRows: string[][] = [
    ["Analysis Output"],
    [""],
    ...findingLines.map((l) => [l]),
  ];

  const findingsSheet = XLSX.utils.aoa_to_sheet(findingRows);
  findingsSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, findingsSheet, "Analysis");

  // ── Working model sheet (blank template) ───────────────────
  const modelHeaders = [
    "Metric",
    "Current",
    "Year 1",
    "Year 2",
    "Year 3",
    "Notes",
  ];
  const modelRows = [
    modelHeaders,
    ["Revenue", "", "", "", "", "Fill in from analysis"],
    ["Gross Margin %", "", "", "", "", ""],
    ["Gross Profit", "", "", "", "", ""],
    ["Operating Costs", "", "", "", "", ""],
    ["EBITDA", "", "", "", "", ""],
    ["Headcount", "", "", "", "", ""],
    ["Revenue per Head", "", "", "", "", ""],
    ["CAC", "", "", "", "", ""],
    ["LTV", "", "", "", "", ""],
    ["LTV:CAC", "", "", "", "", ""],
    ["Net Revenue Retention", "", "", "", "", ""],
    ["Cash Runway (months)", "", "", "", "", ""],
  ];

  const modelSheet = XLSX.utils.aoa_to_sheet(modelRows);
  modelSheet["!cols"] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, modelSheet, "Working Model");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf;
}
