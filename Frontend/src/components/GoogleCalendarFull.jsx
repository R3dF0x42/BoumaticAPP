import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

const API = "https://boumaticapp-production.up.railway.app/api/google-calendar";

export default function GoogleCalendarFull({ onSelectEvent }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(data => {
        // Transformer les événements Google → FullCalendar
        const formatted = data.map(ev => ({
          id: ev.id,
          title: ev.summary || "Sans titre",
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          backgroundColor: "#1d6fff",
          borderColor: "#1d6fff"
        }));
        setEvents(formatted);
      });
  }, []);

  return (
    <div className="page" style={{ padding: "10px" }}>
      <h2>📅 Planning Google Agenda PRO</h2>

      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        allDaySlot={false}
        slotDuration="01:00:00"
        nowIndicator={true}
        events={events}
        height="85vh"
        locale="fr"
        firstDay={1}
        eventClick={(info) => {
          onSelectEvent && onSelectEvent(info.event);
        }}
      />
    </div>
  );
}
