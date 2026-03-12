import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateDocx } from "@/lib/docx-generator";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "Scaler <info@scalepointpartners.com>";
const REPLY_TO = "martin@scalepointpartners.com";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userEmail, businessName, question, context, findings, timestamp } = data;

    if (!userEmail) {
      return NextResponse.json({ error: "Email address required" }, { status: 400 });
    }

    const analysisData = { question, businessName, context, findings, timestamp, userEmail };
    const docxBuffer = await generateDocx(analysisData);

    const safeBusinessName = (businessName || "analysis").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const docxFilename = `scaler-diagnostic-${safeBusinessName}.docx`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      replyTo: REPLY_TO,
      subject: `Your Scaler diagnostic — ${businessName || "Payments & Fintech"}`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 580px; margin: 0 auto; color: #222747; background: #ffffff; padding: 40px 32px;">

          <p style="font-family: Arial, sans-serif; font-size: 11px; color: #8B93B8; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 28px 0;">Scaler · Scalepoint Partners</p>

          <h1 style="font-size: 26px; font-weight: 600; color: #222747; margin: 0 0 8px 0; line-height: 1.2;">Your diagnostic is attached.</h1>
          <p style="font-size: 15px; color: #5C6387; margin: 0 0 32px 0;">${businessName || "Payments & Fintech"}</p>

          <hr style="border: none; border-top: 1px solid #E8E8E8; margin: 0 0 28px 0;" />

          <p style="font-size: 14px; line-height: 1.7; color: #404040; margin: 0 0 16px 0;">
            The attached Word document contains your full Scaler diagnostic — five domain verdicts with analysis, the single most important structural question for your business, and a deep dive on the domain you explored.
          </p>

          <p style="font-size: 14px; line-height: 1.7; color: #404040; margin: 0 0 32px 0;">
            If any of this raised questions worth working through in more depth, reply to this email or reach out directly. I am happy to have a conversation — no charge, no pitch.
          </p>

          <hr style="border: none; border-top: 1px solid #E8E8E8; margin: 0 0 24px 0;" />

          <p style="font-size: 14px; color: #222747; margin: 0 0 4px 0;"><strong>Martin Koderisch</strong></p>
          <p style="font-size: 13px; color: #8B93B8; margin: 0 0 8px 0;">Founder, Scalepoint Partners</p>
          <p style="font-size: 13px; color: #404040; margin: 0 0 4px 0;">martin@scalepointpartners.com</p>
          <p style="font-size: 13px; color: #404040; margin: 0;">scalepointpartners.com</p>

        </div>
      `,
      attachments: [
        { filename: docxFilename, content: docxBuffer.toString("base64") },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
