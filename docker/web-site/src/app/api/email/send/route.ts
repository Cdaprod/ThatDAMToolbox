import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPlainTextEmail, sendTemplateEmail } from "@/lib/email/sendgrid";

const Schema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).nonempty()]),
  // Either provide templateId+dynamicData OR subject+text
  templateId: z.string().optional(),
  dynamicData: z.record(z.any()).optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = Schema.parse(body);

    if (data.templateId && data.dynamicData) {
      const { statusCode } = await sendTemplateEmail({
        to: data.to,
        templateId: data.templateId,
        dynamicData: data.dynamicData,
        tags: data.tags,
      });
      return NextResponse.json({ ok: true, statusCode });
    }

    if (data.subject && data.text) {
      const { statusCode } = await sendPlainTextEmail({
        to: data.to,
        subject: data.subject,
        text: data.text,
        tags: data.tags,
      });
      return NextResponse.json({ ok: true, statusCode });
    }

    return NextResponse.json(
      { ok: false, error: "Provide either (templateId + dynamicData) or (subject + text)." },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "send failed" }, { status: 500 });
  }
}
