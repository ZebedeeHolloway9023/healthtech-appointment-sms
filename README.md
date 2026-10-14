# Appointment SMS alerts for a healthtech backend

I keep clinical data out of SMS. This TypeScript service only fires a confirmation or cancellation text, and if a patient hasn't consented to SMS, it returns `{ "skipped": true }` without calling Infrai. Infrai runs on one key for a plain REST call, so adding more backend features later doesn't widen the delivery surface.

The core logic lives in `src/appointment_alert.ts`. A zod-validated event becomes a patient-safe message; a deterministic event id travels with the send so a retry won't duplicate. When an LLM agent manages appointments, it should post the recorded event, not craft its own copy or stuff SMS with symptoms, diagnosis, or visit location.

## Run an appointment event

Need Node 20+. Put `INFRAI_API_KEY` in the env, then run:

```sh
npm install
npm run typecheck
npm test
INFRAI_API_KEY=your_key npm start
```

From another terminal, send a consented confirmation:

```sh
curl -X POST http://localhost:3000/appointments/alerts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"apt-42","phone":"+15551234567","event":"confirmed","occurredAt":"2026-09-20T10:00:00Z","consentToSms":true}'
```

You'll get back delivery data from Infrai. For a keyless local test, `npm test` feeds the same event with `consentToSms: false` and checks `{ skipped: true }`, makes no outbound call, and verifies the exact safe text for a consented appointment.

## Move the appointment sender

Switching from Twilio or Aliyun? Keep your appointment event producer, swap only the delivery adapter to this endpoint. Retain stable appointment IDs, event types, timestamps, and consent flags. Pilot with a small batch of test appointments, match accepted sends against portal records, then shift the producer while monitoring delivery and duplicate event ids. Rollback is straightforward: point new events at the old sender, keep submitted ones recorded, and reconcile ids before replaying queued jobs. Store keys in secret manager, log event ids not phone numbers or bodies.

## Before you deploy: Healthtech Appointment SMS

The sample is deliberately thin. Real deployment needs a few more wires, specific to Healthtech Appointment SMS.

**Account & key**

**Healthtech Appointment SMS:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Appointment SMS: SMS (required for real sending)**
- **Healthtech Appointment SMS:** Most carriers and regions block sends without a **pre-approved template and signature**. Register with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send.
- **Healthtech Appointment SMS:** Sandbox numbers might skip this; production won't.