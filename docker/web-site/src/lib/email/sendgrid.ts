import sgMail from "@sendgrid/mail";

const required = ["SENDGRID_API_KEY","SENDGRID_FROM_EMAIL","SENDGRID_FROM_NAME"] as const;

for (const k of required) {
  if (!process.env[k]) {
    // Intentionally throw at boot if missing (server-only)
    throw new Error(`Missing required env: ${k}`);
  }
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

type BaseOptions = {
  to: string | string[];
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  tags?: string[]; // SendGrid categories
  tracking?: boolean;
};

export async function sendPlainTextEmail(opts: BaseOptions & { subject: string; text: string }) {
  const tracking = opts.tracking ?? (process.env.SENDGRID_TRACKING_ENABLE === "true");
  const msg = {
    to: opts.to,
    from: {
      email: opts.fromEmail ?? process.env.SENDGRID_FROM_EMAIL!,
      name:  opts.fromName  ?? process.env.SENDGRID_FROM_NAME!,
    },
    replyTo: opts.replyTo ?? process.env.SENDGRID_REPLY_TO ?? undefined,
    subject: opts.subject,
    text: opts.text,
    mailSettings: {
      clickTracking: { enable: tracking, enableText: tracking },
      openTracking: { enable: tracking },
    },
    categories: opts.tags ?? [],
  };

  const [res] = await sgMail.send(msg as any);
  return { statusCode: res.statusCode };
}

export async function sendTemplateEmail(opts: BaseOptions & { templateId: string; dynamicData: Record<string, any> }) {
  const tracking = opts.tracking ?? (process.env.SENDGRID_TRACKING_ENABLE === "true");
  const msg = {
    to: opts.to,
    from: {
      email: opts.fromEmail ?? process.env.SENDGRID_FROM_EMAIL!,
      name:  opts.fromName  ?? process.env.SENDGRID_FROM_NAME!,
    },
    replyTo: opts.replyTo ?? process.env.SENDGRID_REPLY_TO ?? undefined,
    templateId: opts.templateId,
    dynamicTemplateData: opts.dynamicData,
    mailSettings: {
      clickTracking: { enable: tracking, enableText: tracking },
      openTracking: { enable: tracking },
    },
    categories: opts.tags ?? [],
  };

  const [res] = await sgMail.send(msg as any);
  return { statusCode: res.statusCode };
}
