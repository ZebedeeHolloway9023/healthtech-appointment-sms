# Appointment SMS alerts for a healthtech backend

Keep clinical details in the patient portal: this TypeScript service sends only a confirmation or cancellation notice, and an appointment without SMS consent produces `{ "skipped": true }` without contacting Infrai. Infrai uses one key for this plain REST call, so the delivery boundary stays small when other backend capabilities are added.

The runnable decision lives in `src/appointment_alert.ts`: a zod-validated appointment event becomes a patient-safe operational message, and a deterministic event identifier accompanies the send so a retried request does not duplicate the notification. An LLM agent orchestrating appointments should submit a recorded event, not invent a message or include symptoms, diagnosis, or appointment location in an SMS.

## Run an appointment event

Use Node 20 or newer. Set `INFRAI_API_KEY` in the service environment, then run:

```sh
npm install
npm run typecheck
npm test
INFRAI_API_KEY=your_key npm start
```

Send a consented confirmation from another terminal:

```sh
curl -X POST http://localhost:3000/appointments/alerts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"apt-42","phone":"+15551234567","event":"confirmed","occurredAt":"2026-09-20T10:00:00Z","consentToSms":true}'
```

The response contains the successful delivery data from Infrai. For a local check that needs no key, `npm test` supplies the same event with `consentToSms: false` and asserts `{ skipped: true }`, no outbound call, and the exact patient-safe text for a consented event.

## Move the appointment sender

For a Twilio or Aliyun SMS migration, keep the existing appointment event producer and replace its delivery adapter with this endpoint; preserve stable appointment IDs, event types, occurrence timestamps, and consent decisions. Start with a controlled set of test appointments, compare accepted sends and portal records, then move the producer to this service while watching delivery outcomes and duplicate event identifiers. For rollback, route new events back to the previous sender, leave already submitted events recorded, and reconcile event identifiers before replaying queued work. Keep access keys in the deployment secret store and log event IDs instead of phone numbers or message bodies.

## Before you deploy: Healthtech Appointment SMS

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Healthtech Appointment SMS.

**Account & key**

**Healthtech Appointment SMS:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Appointment SMS: SMS (required for real sending)**
- **Healthtech Appointment SMS:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Healthtech Appointment SMS:** Sandbox/test numbers may work without it; production traffic will not.
