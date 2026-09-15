import React, { useEffect, useState } from "react";
import { apiFetch as fetch, API_URL } from "../config/api.js";

export default function GoogleCalendar() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/google-calendar`)
      .then(res => res.json())
      .then(setEvents)
      .catch(err => console.error("Google Calendar error :", err));
  }, []);

  return (
    <div className="page">
      <h2>📅 Planning Google Agenda</h2>

      {!events.length && <p>Chargement des événements...</p>}

      <ul>
        {events.map((ev, i) => (
          <li key={i} className="card" style={{ marginBottom: "10px" }}>
            <strong>{ev.summary || "Sans titre"}</strong>
            <br />
            📆 {ev.start?.date || ev.start?.dateTime}
            <br />
            ⏳ {ev.end?.date || ev.end?.dateTime}
            <br />
            📍 {ev.location || "Aucun lieu"}
          </li>
        ))}
      </ul>
    </div>
  );
}
