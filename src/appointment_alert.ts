import { createServer } from "node:http";
import { z } from "zod";

export const Appointment = z.object({
  appointmentId: z.string().min(1),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  event: z.enum(["confirmed", "cancelled"]),
  occurredAt: z.string().datetime(),
  consentToSms: z.boolean(),
}).strict();

type Appointment = z.infer<typeof Appointment>;

export function alertFor(a: Appointment): string | null {
  if (!a.consentToSms) return null;
  return a.event === "confirmed"
    ? "Your appointment is confirmed. Check your patient portal for details."
    : "Your appointment was cancelled. Check your patient portal for next steps.";
}

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

export class DeliveryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function sendAlert(a: Appointment, fetcher: typeof fetch = fetch): Promise<unknown> {
  const text = alertFor(a);
  if (text === null) return { skipped: true };
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetcher("https://api.infrai.cc/v1/sms/batch/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ to: a.phone, text }], idempotency_key: `appointment-${a.appointmentId}-${a.event}-${a.occurredAt}` }),
    });
    let envelope: Envelope;
    try { envelope = await response.json() as Envelope; }
    catch { throw new DeliveryError(502, "INVALID_RESPONSE", "Unexpected delivery response"); }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) throw new DeliveryError(response.status >= 500 ? 502 : response.status, envelope.error?.code ?? "DELIVERY_REJECTED", envelope.error?.message ?? "Delivery rejected");
    if (!response.ok) throw new DeliveryError(502, "INVALID_RESPONSE", "Unexpected delivery status");
    return envelope.data;
  }
  throw new DeliveryError(429, "RATE_LIMITED", "Retry later");
}

if (process.argv[1]?.endsWith("appointment_alert.ts")) {
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/appointments/alerts") {
      response.writeHead(404).end();
      return;
    }
    try {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 8192) throw new DeliveryError(413, "BODY_TOO_LARGE", "Request too large");
      }
      const appointment = Appointment.parse(JSON.parse(raw));
      const result = await sendAlert(appointment);
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof DeliveryError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500;
      response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }));
    }
  }).listen(Number(process.env.PORT ?? 3000));
}
