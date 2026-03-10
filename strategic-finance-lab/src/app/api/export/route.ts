import { NextRequest, NextResponse } from "next/server";
import { generateExcel } from "@/lib/excel";

export async function POST(req: NextRequest) {
  const data = await req.json();

  try {
    const buffer = generateExcel(data);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="strategic-finance-analysis-${Date.now()}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
