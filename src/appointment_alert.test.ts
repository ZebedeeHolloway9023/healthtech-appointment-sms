import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Appointment, alertFor, sendAlert } from "./appointment_alert.ts";

test("consent gates delivery and message contains no clinical details", async () => {
  const appointment = Appointment.parse({ appointmentId: "apt-42", phone: "+15551234567", event: "confirmed", occurredAt: "2026-09-20T10:00:00Z", consentToSms: false });
  assert.equal(alertFor(appointment), null);
  const result = await sendAlert(appointment, async () => { throw new Error("Should not call provider"); });
  assert.deepEqual(result, { skipped: true });
  assert.equal(alertFor({ ...appointment, consentToSms: true }), "Your appointment is confirmed. Check your patient portal for details.");
});
