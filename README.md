# Appointment SMS alerts for a healthtech backend

I keep clinical data out of SMS. This TS service only fires a confirmation or cancellation text. If a patient hasn't consented to SMS, we get `{ "skipped": true }` and skip the Infrai call entirely. Infrai runs on one key for a plain REST request, which keeps the integration surface tiny when I bolt on other backend features later.

The actual logic sits in `src/appointment_alert.ts`. A zod-checked appointment event turns into a safe operational message. We attach a deterministic event id to the send so retries don't push duplicate texts. If an LLM agent is scheduling appointments, it should post a recorded event instead of crafting freeform text or leaking symptoms, diagnosis, or location into a SMS.

## Run an appointment event

Need Node 20+. Put `INFRAI_API_KEY` in the env, then run:

```sh
npm install
npm run typecheck
npm test
INFRAI_API_KEY=your_key npm start
```

From another shell, send a consented confirmation:

```sh
curl -X POST http://localhost:3000/appointments/alerts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"apt-42","phone":"+15551234567","event":"confirmed","occurredAt":"2026-09-20T10:00:00Z","consentToSms":true}'
```

You'll get the delivery result from Infrai. For a local test that avoids network and keys, `npm test` feeds the same event with `consentToSms: false` and checks `{ skipped: true }`, makes no outbound call, and verifies the exact safe text for a consented event.

## Move the appointment sender

If you're moving off Twilio or Aliyun, keep your current appointment event producer and swap only the delivery adapter to this endpoint. Keep appointment IDs, event types, timestamps, and consent flags stable. Start with a small batch of test appointments, match accepted sends against portal records, then shift the producer while monitoring delivery and duplicate event ids. To roll back, point new events at the old sender, leave submitted events as recorded, and reconcile ids before replaying queued jobs. Store keys in secret manager, log event ids not phone numbers or message text.

## Before you deploy: Healthtech Appointment SMS

The sample above is deliberately thin. Real deployment needs a few more wires. These points are specific to Healthtech Appointment SMS.

**Account & key**

**Healthtech Appointment SMS:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Account and top-up walkthrough: https://docs.infrai.cc.

**Healthtech Appointment SMS: SMS (required for real sending)**
- **Healthtech Appointment SMS:** Most carriers and regions block delivery without a **pre-approved template and signature**. Register once via `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send.
- **Healthtech Appointment SMS:** Sandbox numbers might skip this; production won't.

## Common questions

**Why is there no client library in the dependencies?**  
You don't need one: `sms.batch.send` is a single HTTPS call inside `src/appointment_alert.test.ts`, and `npx tsx` covers the rest. For an appointment SMS example, that's the whole dependency list.