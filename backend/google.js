import { google } from "googleapis";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  return new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/calendar"]
  );
}

export async function createGoogleEvent(intervention) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(intervention.scheduled_at);
  const duration = intervention.duration_minutes || 60;
  const end = new Date(start.getTime() + duration * 60000);


  const event = {
    summary: `Intervention - ${intervention.client_name || "Client"}`,
    description: intervention.description || "",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() }
  };

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    resource: event
  });

  return res.data.id; // google_event_id
}

export async function updateGoogleEvent(googleEventId, newDateTime) {
  if (!googleEventId) return;

  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(newDateTime);
  const duration = intervention.duration_minutes || 60;
  const end = new Date(start.getTime() + duration * 60000);


  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    eventId: googleEventId,
    requestBody: {
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() }
    }
  });
}
