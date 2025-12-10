import { google } from "googleapis";

export function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  return new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/calendar"]
  );
}

export async function listEvents() {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    maxResults: 2500,
    singleEvents: true,
    orderBy: "startTime"
  });

  return res.data.items;
}

export async function addEvent(event) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  return await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    resource: event
  });
}
