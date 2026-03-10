import * as XLSX from "xlsx";

export interface AnalysisData {
  question: string;
  businessName: string;
  context: string;
  findings: string;
  timestamp: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSheet(wb: XLSX.WorkBook, name: string, rows: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
  return ws;
}

function col(width: number): XLSX.ColInfo {
  return { wch: width };
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateExcel(data: AnalysisData): Buffer {
  const wb = XLSX.utils.book_new();
  const biz = data.businessName || "Business";

  buildSummarySheet(wb, data, biz);
  buildProfitabilityModel(wb, biz);
  buildRunwayModel(wb, biz);
  buildUnitEconomics(wb, biz);
  buildScenarios(wb, biz);
  buildAnalysisTranscript(wb, data);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ── Sheet 1: Executive Summary ─────────────────────────────────────────────

function buildSummarySheet(wb: XLSX.WorkBook, data: AnalysisData, biz: string) {
  const rows: unknown[][] = [
    ["STRATEGIC FINANCE LAB", "", "", "", ""],
    ["Executive Summary", "", "", "", ""],
    ["", "", "", "", ""],
    ["Business", biz, "", "", ""],
    ["Strategic Question", data.question, "", "", ""],
    ["Analysis Date", data.timestamp, "", "", ""],
    ["", "", "", "", ""],
    ["HOW TO USE THIS MODEL", "", "", "", ""],
    ["", "", "", "", ""],
    ["Tab", "Purpose", "Action Required", "", ""],
    ["1. Summary", "This page — overview and navigation", "Review", "", ""],
    ["2. P&L Model", "3-year profit & loss with breakeven analysis", "Enter your numbers in blue cells", "", ""],
    ["3. Runway", "Cash runway under different burn scenarios", "Enter current cash and monthly burn", "", ""],
    ["4. Unit Economics", "LTV, CAC, payback period and NRR", "Enter cohort data", "", ""],
    ["5. Scenarios", "Base / upside / downside comparison", "Adjust growth assumptions", "", ""],
    ["6. Analysis", "Full transcript of the advisor session", "Reference only", "", ""],
    ["", "", "", "", ""],
    ["KEY ASSUMPTIONS TO FILL IN", "", "", "", ""],
    ["", "", "", "", ""],
    ["Assumption", "Your Value", "Notes", "", ""],
    ["Current ARR ($)", "", "Enter current annual recurring revenue"],
    ["Monthly Burn ($)", "", "Total monthly operating expenses"],
    ["Cash on Hand ($)", "", "Current cash balance"],
    ["New Clients / Year (Base)", "", "Realistic new client additions"],
    ["Average Contract Value ($)", "", "Average annual contract value"],
    ["Gross Margin % (Recurring)", "", "SaaS-only gross margin"],
    ["Gross Margin % (Blended)", "", "Including implementation services"],
    ["Implementation Fee ($)", "", "Average one-time implementation fee"],
    ["NRR %", "", "Net revenue retention across all clients"],
    ["Months to Breakeven (Target)", "", "Your internal target"],
  ];

  const ws = makeSheet(wb, "1. Summary", rows);
  ws["!cols"] = [col(28), col(45), col(40), col(15), col(15)];
}

// ── Sheet 2: P&L Model ─────────────────────────────────────────────────────

function buildProfitabilityModel(wb: XLSX.WorkBook, biz: string) {
  const rows: unknown[][] = [
    [`${biz} — Profit & Loss Model`, "", "", "", "", ""],
    ["All figures in USD. Blue cells = inputs. Black cells = calculated.", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["ASSUMPTIONS", "Current", "Year 1", "Year 2", "Year 3", "Notes"],
    ["Existing Clients (start of year)", "", "", "", "", "Enter current live clients"],
    ["New Clients Added", "", "", "", "", "Realistic new wins"],
    ["Churned Clients", "", "", "", "", "Expected churn"],
    ["Total Clients (end of year)", '=B5+B6-B7', '=C5+C6-C7', '=D5+D6-D7', '=E5+E6-E7', "Formula"],
    ["Average ACV ($)", "", "", "", "", "Per client per year"],
    ["NRR % (expansion on existing base)", "", "", "", "", "e.g. 115% = 1.15"],
    ["Implementation Fee per New Client ($)", "", "", "", "", "One-time"],
    ["", "", "", "", "", ""],
    ["REVENUE", "Current", "Year 1", "Year 2", "Year 3", ""],
    ["Recurring Revenue ($)", '=B8*B9', '=C8*C9', '=D8*D9', '=E8*E9', "Clients × ACV"],
    ["Expansion Revenue ($)", '=B14*(B10-1)', '=C14*(C10-1)', '=D14*(D10-1)', '=E14*(E10-1)', "NRR uplift"],
    ["Implementation Revenue ($)", '=B6*B11', '=C6*C11', '=D6*D11', '=E6*E11', "New clients × impl. fee"],
    ["TOTAL REVENUE ($)", '=SUM(B14:B16)', '=SUM(C14:C16)', '=SUM(D14:D16)', '=SUM(E14:E16)', ""],
    ["", "", "", "", "", ""],
    ["GROSS PROFIT", "Current", "Year 1", "Year 2", "Year 3", ""],
    ["Recurring Gross Margin %", "", "", "", "", "e.g. 0.78"],
    ["Implementation Gross Margin %", "", "", "", "", "e.g. 0.40"],
    ["Recurring Gross Profit ($)", '=B14*B20', '=C14*C20', '=D14*D20', '=E14*E20', ""],
    ["Expansion Gross Profit ($)", '=B15*B20', '=C15*C20', '=D15*D20', '=E15*E20', ""],
    ["Implementation Gross Profit ($)", '=B16*B21', '=C16*C21', '=D16*D21', '=E16*E21', ""],
    ["TOTAL GROSS PROFIT ($)", '=SUM(B22:B24)', '=SUM(C22:C24)', '=SUM(D22:D24)', '=SUM(E22:E24)', ""],
    ["Blended Gross Margin %", '=IF(B17=0,0,B25/B17)', '=IF(C17=0,0,C25/C17)', '=IF(D17=0,0,D25/D17)', '=IF(E17=0,0,E25/E17)', ""],
    ["", "", "", "", "", ""],
    ["OPERATING COSTS", "Current", "Year 1", "Year 2", "Year 3", ""],
    ["Engineering & Product ($)", "", "", "", "", "Annual total"],
    ["Implementation & CS ($)", "", "", "", "", "Annual total"],
    ["Sales & Marketing ($)", "", "", "", "", "Annual total"],
    ["G&A ($)", "", "", "", "", "Annual total"],
    ["TOTAL OPEX ($)", '=SUM(B28:B31)', '=SUM(C28:C31)', '=SUM(D28:D31)', '=SUM(E28:E31)', ""],
    ["", "", "", "", "", ""],
    ["PROFITABILITY", "Current", "Year 1", "Year 2", "Year 3", ""],
    ["EBITDA ($)", '=B25-B32', '=C25-C32', '=D25-D32', '=E25-E32', "Gross Profit minus OpEx"],
    ["EBITDA Margin %", '=IF(B17=0,0,B35/B17)', '=IF(C17=0,0,C35/C17)', '=IF(D17=0,0,D35/D17)', '=IF(E17=0,0,E35/E17)', ""],
    ["Monthly Burn / (Surplus) ($)", '=IF(B35<0,-B35/12,0)', '=IF(C35<0,-C35/12,0)', '=IF(D35<0,-D35/12,0)', '=IF(E35<0,-E35/12,0)', ""],
    ["Profitable?", '=IF(B35>0,"YES","NO")', '=IF(C35>0,"YES","NO")', '=IF(D35>0,"YES","NO")', '=IF(E35>0,"YES","NO")', ""],
    ["", "", "", "", "", ""],
    ["BREAKEVEN ANALYSIS", "", "", "", "", ""],
    ["Clients needed to break even", '=IF(B20=0,"Enter margins",CEILING((B32-(B6*B16*B21))/(B9*B20),1))', "", "", "", "Approx. at current ACV & margins"],
    ["Months to breakeven (at current growth)", '=IF(B6=0,"Enter new clients",ROUND((B40-B8)/B6*12,0))', "", "", "", "Based on new clients/year"],
  ];

  const ws = makeSheet(wb, "2. P&L Model", rows);
  ws["!cols"] = [col(35), col(16), col(16), col(16), col(16), col(38)];
}

// ── Sheet 3: Runway Model ──────────────────────────────────────────────────

function buildRunwayModel(wb: XLSX.WorkBook, biz: string) {
  const rows: unknown[][] = [
    [`${biz} — Cash Runway Model`, "", "", "", ""],
    ["Enter your figures in the blue input cells below.", "", "", "", ""],
    ["", "", "", "", ""],
    ["INPUTS", "", "", "", ""],
    ["Cash on Hand ($)", "", "", "", "Current bank balance"],
    ["Monthly Revenue ($)", "", "", "", "Current MRR"],
    ["Monthly Operating Costs ($)", "", "", "", "Total monthly burn"],
    ["Monthly Net Burn ($)", '=IF(B6>=B7,0,B7-B6)', "", "", "Zero if revenue covers costs"],
    ["", "", "", "", ""],
    ["RUNWAY SCENARIOS", "Months of Runway", "Run-out Date", "", "Notes"],
    ["Current burn (no change)", '=IF(B8=0,"Profitable",ROUND(B5/B8,0))', '=IF(B8=0,"N/A",TEXT(TODAY()+B11*30,"MMM YYYY"))', "", ""],
    ["Cut burn by 10%", '=IF(B8*0.9=0,"Profitable",ROUND(B5/(B8*0.9),0))', '=IF(B8=0,"N/A",TEXT(TODAY()+B12*30,"MMM YYYY"))', "", "e.g. pause discretionary spend"],
    ["Cut burn by 20%", '=IF(B8*0.8=0,"Profitable",ROUND(B5/(B8*0.8),0))', '=IF(B8=0,"N/A",TEXT(TODAY()+B13*30,"MMM YYYY"))', "", "e.g. restructure team"],
    ["Add 1 new client/quarter", '=IF(B8=0,"Profitable",ROUND(B5/(B8-(B6/3)),0))', '=IF((B8-(B6/3))<=0,"Profitable",TEXT(TODAY()+B14*30,"MMM YYYY"))', "", "Revenue acceleration"],
    ["Add 2 new clients/quarter", '=IF(B8=0,"Profitable",ROUND(B5/(B8-(B6/1.5)),0))', '=IF((B8-(B6/1.5))<=0,"Profitable",TEXT(TODAY()+B15*30,"MMM YYYY"))', "", "Upside scenario"],
    ["", "", "", "", ""],
    ["MONTHLY CASH BURN WATERFALL", "", "", "", ""],
    ["Month", "Opening Cash", "Revenue", "Costs", "Closing Cash"],
    ["1", '=B5', '=B6', '=B7', '=B18-B20+B19'],
    ["2", '=E18', '=B6', '=B7', '=B19-B21+C19'],
    ["3", '=E19', '=B6', '=B7', '=B20-B22+D19'],
    ["4", '=E20', '=B6', '=B7', '=B21-B23+E19'],
    ["5", '=E21', '=B6', '=B7', '=E22-B7+B6'],
    ["6", '=E22', '=B6', '=B7', '=E23-B7+B6'],
    ["7", '=E23', '=B6', '=B7', '=E24-B7+B6'],
    ["8", '=E24', '=B6', '=B7', '=E25-B7+B6'],
    ["9", '=E25', '=B6', '=B7', '=E26-B7+B6'],
    ["10", '=E26', '=B6', '=B7', '=E27-B7+B6'],
    ["11", '=E27', '=B6', '=B7', '=E28-B7+B6'],
    ["12", '=E28', '=B6', '=B7', '=E29-B7+B6'],
    ["13", '=E29', '=B6', '=B7', '=E30-B7+B6'],
    ["14", '=E30', '=B6', '=B7', '=E31-B7+B6'],
    ["15", '=E31', '=B6', '=B7', '=E32-B7+B6'],
    ["16", '=E32', '=B6', '=B7', '=E33-B7+B6'],
    ["17", '=E33', '=B6', '=B7', '=E34-B7+B6'],
    ["18", '=E34', '=B6', '=B7', '=E35-B7+B6'],
  ];

  const ws = makeSheet(wb, "3. Runway", rows);
  ws["!cols"] = [col(35), col(18), col(18), col(18), col(18)];
}

// ── Sheet 4: Unit Economics ────────────────────────────────────────────────

function buildUnitEconomics(wb: XLSX.WorkBook, biz: string) {
  const rows: unknown[][] = [
    [`${biz} — Unit Economics`, "", "", ""],
    ["", "", "", ""],
    ["CAC & PAYBACK", "Value", "Formula", "Notes"],
    ["Sales & Marketing Spend (annual $)", "", "", "Total S&M budget"],
    ["New Clients Acquired (annual)", "", "", "New logos only"],
    ["CAC ($)", '=IF(B5=0,"Enter clients",B4/B5)', "S&M ÷ New Clients", "Cost to acquire one client"],
    ["Average ACV ($)", "", "", "Annual contract value"],
    ["Gross Margin % (Recurring)", "", "", "e.g. 0.78"],
    ["Annual Gross Profit per Client ($)", '=B7*B8', "ACV × GM%", ""],
    ["CAC Payback Period (months)", '=IF(B9=0,"Enter margin",ROUND(B6/(B9/12),1))', "CAC ÷ Monthly GP", "Months to recover CAC"],
    ["", "", "", ""],
    ["LTV ANALYSIS", "Value", "Formula", "Notes"],
    ["Average Client Lifetime (years)", "", "", "1 ÷ churn rate, e.g. 5"],
    ["Annual Gross Profit per Client ($)", '=B9', "From above", ""],
    ["LTV ($)", '=B13*B14', "Lifetime × Annual GP", "Lifetime value"],
    ["LTV : CAC Ratio", '=IF(B6=0,"Enter CAC",ROUND(B15/B6,1))', "LTV ÷ CAC", "Target: >3x"],
    ["LTV:CAC Assessment", '=IF(B6=0,"Enter data",IF(B16>=5,"Excellent (5x+)",IF(B16>=3,"Healthy (3-5x)",IF(B16>=1,"Marginal (1-3x)","Destructive (<1x"))))', "", ""],
    ["", "", "", ""],
    ["RETENTION & EXPANSION", "Value", "Formula", "Notes"],
    ["Clients at Start of Period", "", "", ""],
    ["Clients at End of Period", "", "", ""],
    ["Churned Clients", "", "", ""],
    ["Logo Retention Rate %", '=IF(B20=0,"Enter clients",(B21-B6)/B20)', "Excl. new adds", ""],
    ["ARR at Start ($)", "", "", ""],
    ["ARR at End ($)", "", "", ""],
    ["Net Revenue Retention %", '=IF(B24=0,"Enter ARR",B25/B24)', "End ARR ÷ Start ARR", "Target: >100%"],
    ["NRR Assessment", '=IF(B24=0,"Enter data",IF(B26>=1.2,"Strong expansion (120%+)",IF(B26>=1,"Healthy retention (100-120%)",IF(B26>=0.85,"Moderate churn (85-100%)","High churn (<85%)"))))', "", ""],
    ["", "", "", ""],
    ["COHORT SUMMARY", "Cohort 1", "Cohort 2", "Cohort 3"],
    ["Cohort Start Date", "", "", ""],
    ["Clients in Cohort", "", "", ""],
    ["ARR at Start ($)", "", "", ""],
    ["ARR at Month 12 ($)", "", "", ""],
    ["ARR at Month 24 ($)", "", "", ""],
    ["12-Month Retention %", '=IF(B31=0,"-",B32/B31)', '=IF(C31=0,"-",C32/C31)', '=IF(D31=0,"-",D32/D31)'],
    ["24-Month Retention %", '=IF(B31=0,"-",B33/B31)', '=IF(C31=0,"-",C33/C31)', '=IF(D31=0,"-",D33/D31)'],
  ];

  const ws = makeSheet(wb, "4. Unit Economics", rows);
  ws["!cols"] = [col(35), col(18), col(22), col(35)];
}

// ── Sheet 5: Scenarios ─────────────────────────────────────────────────────

function buildScenarios(wb: XLSX.WorkBook, biz: string) {
  const rows: unknown[][] = [
    [`${biz} — Scenario Analysis`, "", "", "", ""],
    ["Adjust the assumptions below to compare Base, Upside, and Downside outcomes.", "", "", "", ""],
    ["", "", "", "", ""],
    ["ASSUMPTIONS", "Base Case", "Upside", "Downside", "Notes"],
    ["New Clients / Year", "", "", "", "Realistic / optimistic / conservative"],
    ["Average ACV ($)", "", "", "", ""],
    ["Blended Gross Margin %", "", "", "", ""],
    ["Monthly OpEx ($)", "", "", "", "Total operating costs"],
    ["NRR %", "", "", "", ""],
    ["Implementation Fee ($)", "", "", "", ""],
    ["", "", "", "", ""],
    ["YEAR 1 OUTPUTS", "Base Case", "Upside", "Downside", ""],
    ["Total Revenue ($)", '=B5*B6+(B5*B10)', '=C5*C6+(C5*C10)', '=D5*D6+(D5*D10)', "Simplified: clients × ACV + impl."],
    ["Gross Profit ($)", '=B13*B7', '=C13*C7', '=D13*D7', ""],
    ["Annual OpEx ($)", '=B8*12', '=C8*12', '=D8*12', ""],
    ["EBITDA ($)", '=B14-B15', '=C14-C15', '=D14-D15', ""],
    ["EBITDA Margin %", '=IF(B13=0,0,B16/B13)', '=IF(C13=0,0,C16/C13)', '=IF(D13=0,0,D16/D13)', ""],
    ["Profitable?", '=IF(B16>0,"YES ✓","NO ✗")', '=IF(C16>0,"YES ✓","NO ✗")', '=IF(D16>0,"YES ✓","NO ✗")', ""],
    ["", "", "", "", ""],
    ["YEAR 2 OUTPUTS", "Base Case", "Upside", "Downside", ""],
    ["Cumulative Clients", '=B5*2', '=C5*2', '=D5*2', "Simplified: 2 years of adds"],
    ["Total Revenue ($)", '=B21*B6*B9', '=C21*C6*C9', '=D21*D6*D9', "With NRR expansion"],
    ["Gross Profit ($)", '=B22*B7', '=C22*C7', '=D22*D7', ""],
    ["Annual OpEx ($)", '=B8*12', '=C8*12', '=D8*12', "Assumes flat costs"],
    ["EBITDA ($)", '=B23-B24', '=C23-C24', '=D23-D24', ""],
    ["Profitable?", '=IF(B25>0,"YES ✓","NO ✗")', '=IF(C25>0,"YES ✓","NO ✗")', '=IF(D25>0,"YES ✓","NO ✗")', ""],
    ["", "", "", "", ""],
    ["KEY QUESTION: Which scenario reaches profitability, and when?", "", "", "", ""],
    ["Base case breakeven (months)", '=IF(OR(B8=0,B6=0),"Enter inputs",ROUND(B8*12/(B6*B7),0))', "", "", "Rough estimate"],
    ["Upside breakeven (months)", '=IF(OR(C8=0,C6=0),"Enter inputs",ROUND(C8*12/(C6*C7),0))', "", "", ""],
    ["Downside breakeven (months)", '=IF(OR(D8=0,D6=0),"Enter inputs",ROUND(D8*12/(D6*D7),0))', "", "", ""],
  ];

  const ws = makeSheet(wb, "5. Scenarios", rows);
  ws["!cols"] = [col(38), col(16), col(16), col(16), col(35)];
}

// ── Sheet 6: Analysis Transcript ───────────────────────────────────────────

function buildAnalysisTranscript(wb: XLSX.WorkBook, data: AnalysisData) {
  const lines = data.findings
    .split("\n")
    .map((l) => [l.trim()]);

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

  const ws = makeSheet(wb, "6. Analysis", rows);
  ws["!cols"] = [col(120)];
}
