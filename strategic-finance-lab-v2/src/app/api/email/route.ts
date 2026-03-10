import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateDocx } from "@/lib/docx-generator";
import { generateExcel } from "@/lib/excel";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "advisor@yourdomain.com";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userEmail, businessName, question, context, findings, timestamp } = data;

    if (!userEmail) {
      return NextResponse.json({ error: "Email address required" }, { status: 400 });
    }

    const analysisData = { question, businessName, context, findings, timestamp, userEmail };

    const [docxBuffer, xlsxBuffer] = await Promise.all([
      generateDocx(analysisData),
      Promise.resolve(generateExcel(analysisData)),
    ]);

    const safeBusinessName = (businessName || "analysis").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const docxFilename = `scaling-analysis-${safeBusinessName}.docx`;
    const xlsxFilename = `financial-model-${safeBusinessName}.xlsx`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `Your Scaling Analysis — ${businessName || "Fintech Business"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: #1F3864; padding: 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Scaler</h1>
          </div>
          <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5;">
            <p style="font-size: 16px; color: #1F3864; font-weight: bold; margin-top: 0;">Your analysis is attached.</p>
            <p style="font-size: 14px; line-height: 1.6; color: #404040;">This email contains two files:</p>
            <ul style="font-size: 14px; line-height: 1.8; color: #404040;">
              <li><strong>${docxFilename}</strong> — Your full scaling analysis as a Word document</li>
              <li><strong>${xlsxFilename}</strong> — A financial model to populate with your numbers</li>
            </ul>
            <p style="font-size: 14px; line-height: 1.6; color: #404040;">
              <strong>Question analysed:</strong><br/><em>${question}</em>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
            <p style="font-size: 12px; color: #7F7F7F; margin: 0;">
              Confidential — prepared for ${businessName || "your business"} only.
            </p>
          </div>
        </div>
      `,
      attachments: [
        { filename: docxFilename, content: docxBuffer.toString("base64") },
        { filename: xlsxFilename, content: xlsxBuffer.toString("base64") },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
