import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

const API = "https://boumaticapp-production.up.railway.app/api";

const TECH_COLORS = [
  "#1d6fff",
  "#f38b1a",
  "#b14ff2",
  "#22c55e",
  "#e11d48",
  "#38bdf8",
  "#ffb800",
];

function getTechColor(techId) {
  if (!techId) return "#1d6fff";
  return TECH_COLORS[techId % TECH_COLORS.length];
}

function getWeekRange(date) {
  const d = new Date(date);
  const js = d.getDay();
  const diff = js === 0 ? -6 : 1 - js;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (x) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate())
      .toLocaleDateString("fr-CA");

  return { start: fmt(monday), end: fmt(sunday) };
}

export default function GoogleCalendarFull({
  onSelectEvent,
  onInterventionsLoaded
}) {
  const [events, setEvents] = useState([]);
  const [currentStart, setCurrentStart] = useState(null);

  // ---- CHARGE LA SEMAINE ----
  const loadWeek = (dateObj) => {
    if (!dateObj) return;

    setCurrentStart(dateObj);

    const { start, end } = getWeekRange(dateObj);

    fetch(`${API}/interventions?start=${start} 00:00:00&end=${end} 23:59:59`)
      .then((r) => r.json())
      .then((data) => {
        const formatted = data.map(inter => {
          const start = new Date(inter.scheduled_at);
          const duration = inter.duration_minutes || 60; // 60 minutes par défaut
          const end = new Date(start.getTime() + duration * 60000);

          return {
            id: inter.id,
            title: inter.client_name || "Intervention",
            start,
            end,
            backgroundColor: getTechColor(inter.technician_id),
            borderColor: getTechColor(inter.technician_id),

            extendedProps: {
              technician_name: inter.technician_name,
              description: inter.description,
              technician_id: inter.technician_id,
              duration_minutes: inter.duration_minutes
            }
          };
        });


        setEvents(formatted);
        onInterventionsLoaded && onInterventionsLoaded(data);
      })
      .catch((err) =>
        console.error("Erreur chargement interventions :", err)
      );
  };

  // ---- REFRESH DU CALENDRIER EXTERNE (nouvelle intervention) ----
  useEffect(() => {
    const handler = () => {
      if (currentStart) loadWeek(currentStart);
    };

    window.addEventListener("refreshCalendar", handler);
    return () => window.removeEventListener("refreshCalendar", handler);
  }, [currentStart]);

  return (
    <div className="page" style={{ padding: "10px" }}>
      <h2>📅 Planning interventions (Google synchro)</h2>

      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        allDaySlot={false}
        slotDuration="01:00:00"
        nowIndicator={true}
        events={events}
        firstDay={1}
        locale="fr"
        height="85vh"
        editable={true}
        
        datesSet={(arg) => {
          if (!arg.start) return;
          loadWeek(arg.start);
        }}

        eventClick={(info) => {
          onSelectEvent && onSelectEvent(info.event);
        }}

        eventDrop={async (info) => {
          const newDate = info.event.start;
          const iso = newDate.toISOString().slice(0, 19).replace("T", " ");

          try {
            await fetch(`${API}/interventions/${info.event.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "À FAIRE",
                priority: "Normale",
                description: info.event.extendedProps.description || "",
                scheduled_at: iso
              })
            });
          } catch (e) {
            console.error("Erreur maj intervention drag & drop :", e);
            info.revert();
          }
        }}
      />
    </div>
  );
}
