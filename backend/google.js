import { google } from "googleapis";

const GOOGLE_TIME_ZONE = "Europe/Paris";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  return new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/calendar"]
  );
}

function parseLocalDateTimeParts(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hour: value.getHours(),
      minute: value.getMinutes(),
      second: value.getSeconds()
    };
  }

  const match = String(value)
    .replace(" ", "T")
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatLocalDateTime(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(
    parts.minute
  )}:${pad(parts.second)}`;
}

function addMinutesLocal(value, minutes) {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return null;

  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute + minutes,
    parts.second
  );

  return formatLocalDateTime({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds()
  });
}

export async function createGoogleEvent(intervention) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const duration = intervention.duration_minutes || 60;
  const start = formatLocalDateTime(parseLocalDateTimeParts(intervention.scheduled_at));
  const end = addMinutesLocal(intervention.scheduled_at, duration);


  const event = {
    summary: `Intervention - ${intervention.client_name || "Client"}`,
    description: intervention.description || "",
    start: { dateTime: start, timeZone: GOOGLE_TIME_ZONE },
    end: { dateTime: end, timeZone: GOOGLE_TIME_ZONE }
  };

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    resource: event
  });

  return res.data.id; // google_event_id
}

export async function updateGoogleEvent(googleEventId, newDateTime, durationMinutes = 60) {
  if (!googleEventId) return;

  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const start = formatLocalDateTime(parseLocalDateTimeParts(newDateTime));
  const end = addMinutesLocal(newDateTime, durationMinutes);


  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    eventId: googleEventId,
    requestBody: {
      start: { dateTime: start, timeZone: GOOGLE_TIME_ZONE },
      end: { dateTime: end, timeZone: GOOGLE_TIME_ZONE }
    }
  });
}

export async function deleteGoogleEvent(googleEventId) {
  if (!googleEventId) return;

  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    eventId: googleEventId
  });
}
