import * as XLSX from "xlsx";

export interface AnalysisData {
  question: string;
  businessName: string;
  context: string;
  findings: string;
  timestamp: string;
}

// ── Style helpers ──────────────────────────────────────────────────────────

const COLORS = {
  navyDark:  "1F3864",
  navyMid:   "2E75B6",
  inputBg:   "EBF3FB",
  inputText: "0000FF",
  calcBg:    "F2F2F2",
  totalBg:   "D6E4F0",
  white:     "FFFFFF",
  grey:      "7F7F7F",
  black:     "000000",
  green:     "375623",
  red:       "C00000",
  altRow:    "F7FBFF",
};

const FONT = "Arial";

function s(font: object, fill?: object, border?: object, alignment?: object) {
  const style: Record<string, unknown> = { font: { sz: 10, name: FONT, ...font } };
  if (fill) style.fill = { patternType: "solid", ...fill };
  if (border) style.border = border;
  if (alignment) style.alignment = alignment;
  return style;
}

const STYLES = {
  title:    s({ bold: true, sz: 14, color: { rgb: COLORS.navyDark } }),
  subtitle: s({ sz: 10, italic: true, color: { rgb: COLORS.grey } }),
  header:   s({ bold: true, color: { rgb: COLORS.white } }, { fgColor: { rgb: COLORS.navyDark } }),
  section:  s({ bold: true, color: { rgb: COLORS.white } }, { fgColor: { rgb: COLORS.navyMid } }),
  input:    s({ color: { rgb: COLORS.inputText } }, { fgColor: { rgb: COLORS.inputBg } }, {
    top: { style: "thin", color: { rgb: COLORS.inputBg } },
    bottom: { style: "thin", color: { rgb: COLORS.navyMid } },
    left: { style: "thin", color: { rgb: COLORS.inputBg } },
    right: { style: "thin", color: { rgb: COLORS.inputBg } },
  }),
  calc:     s({ color: { rgb: COLORS.black } }, { fgColor: { rgb: COLORS.calcBg } }, {
    top: { style: "thin", color: { rgb: COLORS.white } },
    bottom: { style: "thin", color: { rgb: COLORS.white } },
    left: { style: "thin", color: { rgb: COLORS.white } },
    right: { style: "thin", color: { rgb: COLORS.white } },
  }),
  total:    s({ bold: true, color: { rgb: COLORS.black } }, { fgColor: { rgb: COLORS.totalBg } }, {
    top: { style: "medium", color: { rgb: COLORS.navyMid } },
    bottom: { style: "medium", color: { rgb: COLORS.navyMid } },
  }),
  note:     s({ sz: 9, italic: true, color: { rgb: COLORS.grey } }),
  label:    s({}),
  altRow:   s({}, { fgColor: { rgb: COLORS.altRow } }),
  yes:      s({ bold: true, color: { rgb: COLORS.white } }, { fgColor: { rgb: COLORS.green } }, undefined, { horizontal: "center" }),
  no:       s({ bold: true, color: { rgb: COLORS.white } }, { fgColor: { rgb: COLORS.red } }, undefined, { horizontal: "center" }),
};

// ── Worksheet helpers ──────────────────────────────────────────────────────

function addSheet(wb: XLSX.WorkBook, name: string, rows: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
  return ws;
}

function sc(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) ws[ref] = { v: "", t: "s" };
  ws[ref].s = style;
}

function sr(ws: XLSX.WorkSheet, r: number, c1: number, c2: number, style: object) {
  for (let c = c1; c <= c2; c++) sc(ws, r, c, style);
}

function col(w: number): XLSX.ColInfo { return { wch: w }; }

// ── INPUTS SHEET ──────────────────────────────────────────────────────────
// All assumptions live here. Other sheets reference these cells.
// Convention: Input values are in column B. Labels in column A.

function buildInputs(wb: XLSX.WorkBook, biz: string) {
  // Row indices (0-based) — these are the SOURCE OF TRUTH for all cross-sheet refs
  // B2  = Current Clients
  // B3  = New Clients / Year (Base)
  // B4  = Churn / Year
  // B5  = Average ACV ($)
  // B6  = NRR (decimal, e.g. 1.15)
  // B7  = Implementation Fee ($)
  // B8  = Recurring Gross Margin (decimal)
  // B9  = Implementation Gross Margin (decimal)
  // B10 = Engineering & Product OpEx (annual $)
  // B11 = Implementation & CS OpEx (annual $)
  // B12 = Sales & Marketing OpEx (annual $)
  // B13 = G&A OpEx (annual $)
  // B14 = Cash on Hand ($)
  // B15 = S&M Spend for CAC (annual $)
  // B16 = Avg Client Lifetime (years)
  // B17 = Year 1 New Clients
  // B18 = Year 2 New Clients
  // B19 = Year 3 New Clients
  // B20 = Year 1 OpEx (annual)
  // B21 = Year 2 OpEx (annual)
  // B22 = Year 3 OpEx (annual)

  const rows: unknown[][] = [
    ["INPUTS — All assumptions enter here", "", ""],
    [`${biz}`, "", ""],
    ["", "", ""],
    ["SECTION", "ASSUMPTION", "YOUR VALUE", "NOTES"],
    ["", "", "", ""],
    ["CLIENT METRICS", "Current Live Clients", "", "How many clients are live today"],
    ["", "New Clients / Year (Base Case)", "", "Realistic new logos per year"],
    ["", "Churned Clients / Year", "", "Expected annual client losses"],
    ["", "", "", ""],
    ["PRICING", "Average ACV ($)", "", "Annual contract value per client"],
    ["", "NRR % (as decimal)", "", "e.g. 115% NRR = enter 1.15"],
    ["", "Implementation Fee per Client ($)", "", "One-time fee charged on new clients"],
    ["", "", "", ""],
    ["MARGINS", "Recurring Gross Margin (as decimal)", "", "e.g. 78% = enter 0.78"],
    ["", "Implementation Gross Margin (as decimal)", "", "e.g. 40% = enter 0.40"],
    ["", "", "", ""],
    ["OPERATING COSTS (CURRENT YEAR — ANNUAL $)", "", "", ""],
    ["", "Engineering & Product", "", "Total annual cost"],
    ["", "Implementation & Client Success", "", ""],
    ["", "Sales & Marketing", "", ""],
    ["", "G&A", "", ""],
    ["", "", "", ""],
    ["OPERATING COSTS (YEAR 1 PROJECTION — ANNUAL $)", "", "", ""],
    ["", "Year 1 Total OpEx", "", "Can match current or project growth"],
    ["", "Year 2 Total OpEx", "", ""],
    ["", "Year 3 Total OpEx", "", ""],
    ["", "", "", ""],
    ["GROWTH PROJECTIONS (NEW CLIENTS PER YEAR)", "", "", ""],
    ["", "Year 1 New Clients", "", ""],
    ["", "Year 2 New Clients", "", ""],
    ["", "Year 3 New Clients", "", ""],
    ["", "", "", ""],
    ["CASH & UNIT ECONOMICS", "Cash on Hand ($)", "", "Current bank balance"],
    ["", "S&M Spend for CAC Calc (annual $)", "", "Total sales & marketing budget"],
    ["", "Average Client Lifetime (years)", "", "e.g. if 20% annual churn = 5 years"],
    ["", "", "", ""],
    ["LEGEND", "", "", ""],
    ["Blue cells", "= Enter your values here", "", ""],
    ["Grey cells", "= Calculated automatically", "", ""],
    ["Green cells", "= Cross-sheet references (do not edit)", "", ""],
  ];

  const ws = addSheet(wb, "0. Inputs", rows);
  ws["!cols"] = [col(38), col(42), col(18), col(42)];

  // Title
  sc(ws, 0, 0, STYLES.title);
  sc(ws, 1, 0, STYLES.subtitle);

  // Header row
  sr(ws, 3, 0, 3, STYLES.header);

  // Section headers
  const sectionRows = [5, 9, 13, 16, 22, 27, 32, 36];
  sectionRows.forEach(r => sc(ws, r, 0, STYLES.section));

  // Input cells — column C (index 2), these are the actual value cells
  const inputRows = [5,6,7,9,10,11,13,14,17,18,19,20,23,24,25,28,29,30,32,33,34];
  inputRows.forEach(r => sc(ws, r, 2, STYLES.input));

  // Notes column
  for (let r = 5; r <= 34; r++) sc(ws, r, 3, STYLES.note);

  // Legend rows
  sr(ws, 36, 0, 3, STYLES.section);
  sc(ws, 37, 0, STYLES.input);
  sc(ws, 38, 0, STYLES.calc);
  sc(ws, 39, 0, s({ color: { rgb: "006400" } }, { fgColor: { rgb: "E2EFDA" } }));

  return ws;
}

// Input cell references (column C = index 2, so Excel column C)
// Row numbers in Excel are 1-based, so row index 5 = Excel row 6
const I = {
  currentClients:      "'0. Inputs'!C6",
  newClientsBase:      "'0. Inputs'!C7",
  churnBase:           "'0. Inputs'!C8",
  acv:                 "'0. Inputs'!C10",
  nrr:                 "'0. Inputs'!C11",
  implFee:             "'0. Inputs'!C12",
  recurringGM:         "'0. Inputs'!C14",
  implGM:              "'0. Inputs'!C15",
  engOpex:             "'0. Inputs'!C18",
  implOpex:            "'0. Inputs'!C19",
  smOpex:              "'0. Inputs'!C20",
  gaOpex:              "'0. Inputs'!C21",
  y1Opex:              "'0. Inputs'!C24",
  y2Opex:              "'0. Inputs'!C25",
  y3Opex:              "'0. Inputs'!C26",
  y1NewClients:        "'0. Inputs'!C29",
  y2NewClients:        "'0. Inputs'!C30",
  y3NewClients:        "'0. Inputs'!C31",
  cash:                "'0. Inputs'!C33",
  smForCac:            "'0. Inputs'!C34",
  clientLifetime:      "'0. Inputs'!C35",
};

// ── P&L SHEET ──────────────────────────────────────────────────────────────

function buildPnL(wb: XLSX.WorkBook, biz: string) {
  const N = I; // shorthand

  const rows: unknown[][] = [
    [`${biz} — Profit & Loss Model`, "", "", "", "", ""],
    ["All inputs are on the '0. Inputs' sheet. This sheet is fully calculated.", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "Current", "Year 1", "Year 2", "Year 3", "Notes"],
    ["", "", "", "", "", ""],
    ["CLIENTS", "", "", "", "", ""],
    ["Existing Clients (start of year)",
      `=${N.currentClients}`,
      `=B7+B8-B9`,
      `=C7+C8-C9`,
      `=D7+D8-D9`,
      "Carries forward each year"],
    ["New Clients Added",
      `=${N.newClientsBase}`,
      `=${N.y1NewClients}`,
      `=${N.y2NewClients}`,
      `=${N.y3NewClients}`,
      "From Inputs sheet"],
    ["Churned Clients",
      `=${N.churnBase}`,
      `=${N.churnBase}`,
      `=${N.churnBase}`,
      `=${N.churnBase}`,
      "From Inputs sheet"],
    ["Total Clients (end of year)", "=B7+B8-B9", "=C7+C8-C9", "=D7+D8-D9", "=E7+E8-E9", "Calculated"],
    ["", "", "", "", "", ""],
    ["REVENUE", "", "", "", "", ""],
    ["Recurring Revenue ($)",
      `=B10*${N.acv}`,
      `=C10*${N.acv}`,
      `=D10*${N.acv}`,
      `=E10*${N.acv}`,
      "Total Clients × ACV"],
    ["Expansion Revenue ($)",
      `=B13*(${N.nrr}-1)`,
      `=C13*(${N.nrr}-1)`,
      `=D13*(${N.nrr}-1)`,
      `=E13*(${N.nrr}-1)`,
      "NRR uplift on recurring base"],
    ["Implementation Revenue ($)",
      `=B8*${N.implFee}`,
      `=C8*${N.implFee}`,
      `=D8*${N.implFee}`,
      `=E8*${N.implFee}`,
      "New clients × impl. fee"],
    ["TOTAL REVENUE ($)", "=SUM(B13:B15)", "=SUM(C13:C15)", "=SUM(D13:D15)", "=SUM(E13:E15)", ""],
    ["", "", "", "", "", ""],
    ["GROSS PROFIT", "", "", "", "", ""],
    ["Recurring Gross Profit ($)",
      `=B13*${N.recurringGM}`,
      `=C13*${N.recurringGM}`,
      `=D13*${N.recurringGM}`,
      `=E13*${N.recurringGM}`, ""],
    ["Expansion Gross Profit ($)",
      `=B14*${N.recurringGM}`,
      `=C14*${N.recurringGM}`,
      `=D14*${N.recurringGM}`,
      `=E14*${N.recurringGM}`, ""],
    ["Implementation Gross Profit ($)",
      `=B15*${N.implGM}`,
      `=C15*${N.implGM}`,
      `=D15*${N.implGM}`,
      `=E15*${N.implGM}`, ""],
    ["TOTAL GROSS PROFIT ($)", "=SUM(B18:B20)", "=SUM(C18:C20)", "=SUM(D18:D20)", "=SUM(E18:E20)", ""],
    ["Blended Gross Margin %", "=IF(B16=0,0,B21/B16)", "=IF(C16=0,0,C21/C16)", "=IF(D16=0,0,D21/D16)", "=IF(E16=0,0,E21/E16)", ""],
    ["", "", "", "", "", ""],
    ["OPERATING COSTS", "", "", "", "", ""],
    ["Engineering & Product ($)", `=${N.engOpex}`, `=${N.engOpex}`, `=${N.engOpex}`, `=${N.engOpex}`, "From Inputs"],
    ["Implementation & CS ($)", `=${N.implOpex}`, `=${N.implOpex}`, `=${N.implOpex}`, `=${N.implOpex}`, ""],
    ["Sales & Marketing ($)", `=${N.smOpex}`, `=${N.smOpex}`, `=${N.smOpex}`, `=${N.smOpex}`, ""],
    ["G&A ($)", `=${N.gaOpex}`, `=${N.gaOpex}`, `=${N.gaOpex}`, `=${N.gaOpex}`, ""],
    ["TOTAL OPEX ($)",
      "=SUM(B25:B28)",
      `=${N.y1Opex}`,
      `=${N.y2Opex}`,
      `=${N.y3Opex}`,
      "Year projections from Inputs"],
    ["", "", "", "", "", ""],
    ["PROFITABILITY", "", "", "", "", ""],
    ["EBITDA ($)", "=B21-B29", "=C21-C29", "=D21-D29", "=E21-E29", "Gross Profit minus OpEx"],
    ["EBITDA Margin %", "=IF(B16=0,0,B32/B16)", "=IF(C16=0,0,C32/C16)", "=IF(D16=0,0,D32/D16)", "=IF(E16=0,0,E32/E16)", ""],
    ["Monthly Burn / (Surplus) ($)", "=IF(B32<0,-B32/12,0)", "=IF(C32<0,-C32/12,0)", "=IF(D32<0,-D32/12,0)", "=IF(E32<0,-E32/12,0)", "0 when profitable"],
    ['Profitable?', '=IF(B32>0,"YES","NO")', '=IF(C32>0,"YES","NO")', '=IF(D32>0,"YES","NO")', '=IF(E32>0,"YES","NO")', ""],
    ["", "", "", "", "", ""],
    ["BREAKEVEN ANALYSIS", "", "", "", "", ""],
    ["Clients needed to break even",
      `=IF(${N.recurringGM}=0,"Enter margins on Inputs",CEILING(B29/(${N.acv}*${N.recurringGM}),1))`,
      "", "", "",
      "Approx. based on recurring revenue only"],
    ["Clients above / (below) breakeven", "=B10-B37", "=C10-C37", "=D10-D37", "=E10-E37", "Positive = above breakeven"],
    ["Months to reach breakeven clients",
      `=IF(${N.newClientsBase}=0,"Enter new clients on Inputs",IF(B38>=0,"Already there",ROUND((-B38/${N.newClientsBase})*12,0)))`,
      "", "", "",
      "Based on current growth rate"],
  ];

  const ws = addSheet(wb, "1. P&L Model", rows);
  ws["!cols"] = [col(32), col(16), col(16), col(16), col(16), col(38)];

  sc(ws, 0, 0, STYLES.title);
  sc(ws, 1, 0, STYLES.subtitle);

  // Section headers
  [5, 11, 17, 23, 30, 36].forEach(r => sr(ws, r, 0, 5, STYLES.section));

  // Column header row
  sr(ws, 3, 0, 5, STYLES.header);

  // All calc cells (cols B-E)
  for (let r = 6; r <= 39; r++) {
    for (let c = 1; c <= 4; c++) sc(ws, r, c, STYLES.calc);
  }

  // Total rows
  [15, 21, 29, 32].forEach(r => sr(ws, r, 0, 5, STYLES.total));

  // Notes
  for (let r = 6; r <= 39; r++) sc(ws, r, 5, STYLES.note);

  return ws;
}

// ── RUNWAY SHEET ───────────────────────────────────────────────────────────

function buildRunway(wb: XLSX.WorkBook, biz: string) {
  const N = I;

  const rows: unknown[][] = [
    [`${biz} — Cash Runway Model`, "", "", "", ""],
    ["All inputs are on the '0. Inputs' sheet.", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "Value", "Formula", "", "Notes"],
    ["Cash on Hand ($)", `=${N.cash}`, "", "", "From Inputs"],
    ["Monthly Revenue ($)", `=${N.currentClients}*${N.acv}/12`, "", "", "Current clients × ACV ÷ 12"],
    ["Monthly OpEx ($)", `=(${N.engOpex}+${N.implOpex}+${N.smOpex}+${N.gaOpex})/12`, "", "", "Total annual OpEx ÷ 12"],
    ["Monthly Net Burn ($)", "=IF(B6>=B7,0,B7-B6)", "", "", "Zero if revenue covers costs"],
    ["", "", "", "", ""],
    ["RUNWAY SCENARIOS", "Months", "Run-out Date", "", "Notes"],
    ["Current burn — no change", '=IF(B8=0,"Profitable",ROUND(B5/B8,0))', '=IF(B8=0,"N/A",TEXT(TODAY()+B11*30,"MMM YYYY"))', "", "Baseline"],
    ["Cut burn by $17k/month (discretionary)", '=IF((B8-17000)<=0,"Profitable",ROUND(B5/(B8-17000),0))', '=IF((B8-17000)<=0,"Profitable",TEXT(TODAY()+B12*30,"MMM YYYY"))', "", "Pause retainer + unused tools"],
    ["Cut burn by 10%", '=IF(B8*0.9<=0,"Profitable",ROUND(B5/(B8*0.9),0))', '=IF(B8*0.9<=0,"Profitable",TEXT(TODAY()+B13*30,"MMM YYYY"))', "", "Moderate cost discipline"],
    ["Cut burn by 20%", '=IF(B8*0.8<=0,"Profitable",ROUND(B5/(B8*0.8),0))', '=IF(B8*0.8<=0,"Profitable",TEXT(TODAY()+B14*30,"MMM YYYY"))', "", "Significant restructure"],
    ["Add 1 new client/quarter", '=IF((B8-B6/3)<=0,"Profitable",ROUND(B5/(B8-B6/3),0))', '=IF((B8-B6/3)<=0,"Profitable",TEXT(TODAY()+B15*30,"MMM YYYY"))', "", "Revenue acceleration"],
    ["Add 2 new clients/quarter", '=IF((B8-B6/1.5)<=0,"Profitable",ROUND(B5/(B8-B6/1.5),0))', '=IF((B8-B6/1.5)<=0,"Profitable",TEXT(TODAY()+B16*30,"MMM YYYY"))', "", "Upside scenario"],
    ["", "", "", "", ""],
    ["MONTHLY CASH WATERFALL (18 months)", "", "", "", ""],
    ["Month", "Opening Cash ($)", "Revenue ($)", "Costs ($)", "Closing Cash ($)"],
    ["1",  "=B5",  "=B6", "=B7", "=B20+C20-D20"],
    ["2",  "=E20", "=B6", "=B7", "=B21+C21-D21"],
    ["3",  "=E21", "=B6", "=B7", "=B22+C22-D22"],
    ["4",  "=E22", "=B6", "=B7", "=B23+C23-D23"],
    ["5",  "=E23", "=B6", "=B7", "=B24+C24-D24"],
    ["6",  "=E24", "=B6", "=B7", "=B25+C25-D25"],
    ["7",  "=E25", "=B6", "=B7", "=B26+C26-D26"],
    ["8",  "=E26", "=B6", "=B7", "=B27+C27-D27"],
    ["9",  "=E27", "=B6", "=B7", "=B28+C28-D28"],
    ["10", "=E28", "=B6", "=B7", "=B29+C29-D29"],
    ["11", "=E29", "=B6", "=B7", "=B30+C30-D30"],
    ["12", "=E30", "=B6", "=B7", "=B31+C31-D31"],
    ["13", "=E31", "=B6", "=B7", "=B32+C32-D32"],
    ["14", "=E32", "=B6", "=B7", "=B33+C33-D33"],
    ["15", "=E33", "=B6", "=B7", "=B34+C34-D34"],
    ["16", "=E34", "=B6", "=B7", "=B35+C35-D35"],
    ["17", "=E35", "=B6", "=B7", "=B36+C36-D36"],
    ["18", "=E36", "=B6", "=B7", "=B37+C37-D37"],
  ];

  const ws = addSheet(wb, "2. Runway", rows);
  ws["!cols"] = [col(38), col(18), col(22), col(10), col(18)];

  sc(ws, 0, 0, STYLES.title);
  sc(ws, 1, 0, STYLES.subtitle);
  sr(ws, 3, 0, 4, STYLES.header);
  sr(ws, 9, 0, 4, STYLES.header);
  sr(ws, 18, 0, 4, STYLES.header);
  sr(ws, 19, 0, 4, STYLES.header);

  // Input-sourced cells
  for (let r = 4; r <= 7; r++) sc(ws, r, 1, STYLES.calc);

  // Scenario rows
  for (let r = 10; r <= 15; r++) {
    sr(ws, r, 0, 4, r % 2 === 0 ? STYLES.altRow : STYLES.label);
    sc(ws, r, 1, STYLES.calc);
    sc(ws, r, 2, STYLES.calc);
    sc(ws, r, 4, STYLES.note);
  }

  // Waterfall rows
  for (let r = 20; r <= 37; r++) {
    sr(ws, r, 0, 4, r % 2 === 0 ? STYLES.altRow : STYLES.label);
    for (let c = 1; c <= 4; c++) sc(ws, r, c, STYLES.calc);
  }
}

// ── UNIT ECONOMICS SHEET ───────────────────────────────────────────────────

function buildUnitEconomics(wb: XLSX.WorkBook, biz: string) {
  const N = I;

  const rows: unknown[][] = [
    [`${biz} — Unit Economics`, "", "", ""],
    ["All inputs are on the '0. Inputs' sheet.", "", "", ""],
    ["", "", "", ""],
    ["CAC & PAYBACK", "Value", "How it's calculated", "Benchmark"],
    ["Sales & Marketing Spend (annual $)", `=${N.smForCac}`, "From Inputs", ""],
    ["New Clients Acquired", `=${N.newClientsBase}`, "From Inputs", ""],
    ["CAC ($)", `=IF(${N.newClientsBase}=0,"Enter on Inputs",${N.smForCac}/${N.newClientsBase})`, "S&M ÷ New Clients", "Varies by segment"],
    ["Average ACV ($)", `=${N.acv}`, "From Inputs", ""],
    ["Recurring Gross Margin %", `=${N.recurringGM}`, "From Inputs", ""],
    ["Annual Gross Profit per Client ($)", `=${N.acv}*${N.recurringGM}`, "ACV × GM%", ""],
    ["CAC Payback Period (months)", `=IF(${N.newClientsBase}=0,"Enter on Inputs",ROUND(B7/(B10/12),1))`, "CAC ÷ Monthly GP", "Target: <18 months"],
    ["", "", "", ""],
    ["LTV ANALYSIS", "Value", "How it's calculated", "Benchmark"],
    ["Average Client Lifetime (years)", `=${N.clientLifetime}`, "From Inputs", ""],
    ["Annual Gross Profit per Client ($)", "=B10", "From above", ""],
    ["LTV ($)", "=B14*B15", "Lifetime × Annual GP", ""],
    ["LTV : CAC", `=IF(B7=0,"Enter on Inputs",ROUND(B16/B7,1))`, "LTV ÷ CAC", "Target: >3x"],
    ['LTV:CAC Health', `=IF(B7=0,"Enter data",IF(B17>=5,"Excellent — 5x+",IF(B17>=3,"Healthy — 3 to 5x",IF(B17>=1,"Marginal — 1 to 3x","Destructive — below 1x"))))`, "", ""],
    ["", "", "", ""],
    ["RETENTION", "Value", "How it's calculated", "Benchmark"],
    ["ARR at Start of Period ($)", "", "Enter manually", ""],
    ["ARR at End of Period ($)", "", "Enter manually", ""],
    ["Net Revenue Retention %", "=IF(B21=0,\"Enter ARR\",B22/B21)", "End ARR ÷ Start ARR", "Target: >100%"],
    ['NRR Health', '=IF(B21=0,"Enter data",IF(B23>=1.2,"Strong expansion (120%+)",IF(B23>=1,"Healthy (100-120%)",IF(B23>=0.85,"Moderate churn (85-100%)","High churn — review urgently"))))', "", ""],
    ["", "", "", ""],
    ["COHORT TABLE", "Cohort 1", "Cohort 2", "Cohort 3"],
    ["Start Date", "", "", ""],
    ["Clients", "", "", ""],
    ["ARR at Start ($)", "", "", ""],
    ["ARR at Month 12 ($)", "", "", ""],
    ["ARR at Month 24 ($)", "", "", ""],
    ["12-Month Retention", '=IF(B28=0,"-",B29/B28)', '=IF(C28=0,"-",C29/C28)', '=IF(D28=0,"-",D29/D28)'],
    ["24-Month Retention", '=IF(B28=0,"-",B30/B28)', '=IF(C28=0,"-",C30/C28)', '=IF(D28=0,"-",D30/D28)'],
  ];

  const ws = addSheet(wb, "3. Unit Economics", rows);
  ws["!cols"] = [col(35), col(18), col(28), col(28)];

  sc(ws, 0, 0, STYLES.title);
  sc(ws, 1, 0, STYLES.subtitle);
  [3, 12, 19, 25].forEach(r => sr(ws, r, 0, 3, STYLES.header));

  const calcRows = [6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 22, 23, 31, 32];
  calcRows.forEach(r => sc(ws, r, 1, STYLES.calc));

  const inputFromSheet = [4, 5, 13];
  inputFromSheet.forEach(r => sc(ws, r, 1, STYLES.calc));

  const manualInput = [20, 21, 26, 27, 28, 29, 30];
  manualInput.forEach(r => {
    sc(ws, r, 1, STYLES.input);
    if (r >= 26) { sc(ws, r, 2, STYLES.input); sc(ws, r, 3, STYLES.input); }
  });

  for (let r = 4; r <= 32; r++) sc(ws, r, 3, STYLES.note);
}

// ── SCENARIOS SHEET ────────────────────────────────────────────────────────

function buildScenarios(wb: XLSX.WorkBook, biz: string) {
  const N = I;

  const rows: unknown[][] = [
    [`${biz} — Scenario Analysis`, "", "", "", ""],
    ["Base case pulls from Inputs. Upside and Downside can be adjusted below.", "", "", "", ""],
    ["", "", "", "", ""],
    ["ASSUMPTIONS", "Base Case", "Upside", "Downside", "Notes"],
    ["New Clients / Year", `=${N.newClientsBase}`, "", "", "Upside/Downside: enter manually"],
    ["Average ACV ($)", `=${N.acv}`, "", "", ""],
    ["Blended Gross Margin %", `=IF(${N.recurringGM}=0,0,${N.recurringGM}*0.9)`, "", "", "Approx. blended (adjust if needed)"],
    ["Monthly OpEx ($)", `=(${N.engOpex}+${N.implOpex}+${N.smOpex}+${N.gaOpex})/12`, "", "", ""],
    ["NRR %", `=${N.nrr}`, "", "", ""],
    ["Implementation Fee ($)", `=${N.implFee}`, "", "", ""],
    ["", "", "", "", ""],
    ["YEAR 1 OUTPUTS", "Base Case", "Upside", "Downside", ""],
    ["Total Revenue ($)", "=B5*B6+(B5*B10)", "=IF(C5=\"\",\"-\",C5*C6+(C5*C10))", "=IF(D5=\"\",\"-\",D5*D6+(D5*D10))", "Clients × ACV + impl. fees"],
    ["Gross Profit ($)", "=B13*B7", "=IF(C13=\"-\",\"-\",C13*C7)", "=IF(D13=\"-\",\"-\",D13*D7)", ""],
    ["Annual OpEx ($)", "=B8*12", "=IF(C8=\"\",B8*12,C8*12)", "=IF(D8=\"\",B8*12,D8*12)", ""],
    ["EBITDA ($)", "=B14-B15", "=IF(C14=\"-\",\"-\",C14-C15)", "=IF(D14=\"-\",\"-\",D14-D15)", ""],
    ["EBITDA Margin %", "=IF(B13=0,0,B16/B13)", "=IF(OR(C13=\"-\",C13=0),\"-\",C16/C13)", "=IF(OR(D13=\"-\",D13=0),\"-\",D16/D13)", ""],
    ['Profitable Year 1?', '=IF(B16>0,"YES ✓","NO ✗")', '=IF(C16="-","-",IF(C16>0,"YES ✓","NO ✗"))', '=IF(D16="-","-",IF(D16>0,"YES ✓","NO ✗"))', ""],
    ["", "", "", "", ""],
    ["YEAR 2 OUTPUTS", "Base Case", "Upside", "Downside", ""],
    ["Clients (cumulative adds)", "=B5*2", "=IF(C5=\"\",B5*2,C5*2)", "=IF(D5=\"\",B5*2,D5*2)", "2 years of new client adds"],
    ["ARR with NRR ($)", `=B21*${N.acv}*${N.nrr}`, `=IF(C5="","-",C21*C6*C9)`, `=IF(D5="","-",D21*D6*D9)`, "With NRR expansion"],
    ["Gross Profit ($)", "=B22*B7", "=IF(C22=\"-\",\"-\",C22*C7)", "=IF(D22=\"-\",\"-\",D22*D7)", ""],
    ["Annual OpEx ($)", "=B8*12", "=IF(C8=\"\",B8*12,C8*12)", "=IF(D8=\"\",B8*12,D8*12)", "Assumes flat unless changed"],
    ["EBITDA ($)", "=B23-B24", "=IF(C23=\"-\",\"-\",C23-C24)", "=IF(D23=\"-\",\"-\",D23-D24)", ""],
    ['Profitable Year 2?', '=IF(B25>0,"YES ✓","NO ✗")', '=IF(C25="-","-",IF(C25>0,"YES ✓","NO ✗"))', '=IF(D25="-","-",IF(D25>0,"YES ✓","NO ✗"))', ""],
    ["", "", "", "", ""],
    ["BREAKEVEN SUMMARY", "", "", "", ""],
    ["Months to breakeven",
      `=IF(OR(B8=0,B6=0),"Enter inputs",ROUND(B8*12/(B6*B7),0))`,
      `=IF(OR(C5="",C6="",C7=""),"Enter upside inputs",ROUND(C8*12/(C6*C7),0))`,
      `=IF(OR(D5="",D6="",D7=""),"Enter downside inputs",ROUND(D8*12/(D6*D7),0))`,
      "Rough estimate"],
  ];

  const ws = addSheet(wb, "4. Scenarios", rows);
  ws["!cols"] = [col(30), col(16), col(16), col(16), col(38)];

  sc(ws, 0, 0, STYLES.title);
  sc(ws, 1, 0, STYLES.subtitle);
  [3, 11, 19, 27].forEach(r => sr(ws, r, 0, 4, STYLES.header));
  sr(ws, 27, 0, 4, STYLES.section);

  // Base case col (B) = calc from inputs
  for (let r = 4; r <= 26; r++) sc(ws, r, 1, STYLES.calc);

  // Upside / Downside cols (C, D) = manual input
  for (let r = 4; r <= 9; r++) {
    sc(ws, r, 2, STYLES.input);
    sc(ws, r, 3, STYLES.input);
  }

  // Output rows upside/downside = calc
  for (let r = 12; r <= 26; r++) {
    sc(ws, r, 2, STYLES.calc);
    sc(ws, r, 3, STYLES.calc);
  }

  for (let r = 4; r <= 28; r++) sc(ws, r, 4, STYLES.note);
}

// ── ANALYSIS TRANSCRIPT ────────────────────────────────────────────────────

function buildTranscript(wb: XLSX.WorkBook, data: AnalysisData) {
  const lines = data.findings.split("\n").map(l => [l.trim()]);

  const rows: unknown[][] = [
    ["STRATEGIC FINANCE LAB — ANALYSIS TRANSCRIPT"],
    [""],
    ["Business", data.businessName],
    ["Question", data.question],
    ["Date", data.timestamp],
    [""],
    ["CONTEXT PROVIDED"],
    [data.context],
    [""],
    ["ADVISOR OUTPUT"],
    [""],
    ...lines,
  ];

  const ws = addSheet(wb, "5. Analysis", rows);
  ws["!cols"] = [col(120)];

  sc(ws, 0, 0, STYLES.title);
  sc(ws, 6, 0, STYLES.section);
  sc(ws, 9, 0, STYLES.section);
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────

export function generateExcel(data: AnalysisData): Buffer {
  const wb = XLSX.utils.book_new();
  const biz = data.businessName || "Business";

  buildInputs(wb, biz);
  buildPnL(wb, biz);
  buildRunway(wb, biz);
  buildUnitEconomics(wb, biz);
  buildScenarios(wb, biz);
  buildTranscript(wb, data);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
}
