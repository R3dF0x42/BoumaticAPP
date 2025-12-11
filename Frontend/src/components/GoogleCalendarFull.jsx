import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

const API = "https://boumaticapp-production.up.railway.app/api";

const TECH_COLORS = [
  "#1d6fff",  // bleu
  "#f38b1a",  // orange
  "#b14ff2",  // violet
  "#22c55e",  // vert
  "#e11d48",  // rose
  "#38bdf8",  // cyan
  "#ffb800",  // jaune
];

function getTechColor(techId) {
  if (!techId) return "#1d6fff";
  return TECH_COLORS[techId % TECH_COLORS.length];
}

// calcule la période semaine visible
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

  return {
    start: fmt(monday),
    end: fmt(sunday),
  };
}

export default function GoogleCalendarFull({ onSelectEvent, onInterventionsLoaded }) {
  const [events, setEvents] = useState([]);

  const loadWeek = (startStr) => {
    const { start, end } = getWeekRange(startStr);

    fetch(`${API}/interventions?start=${start} 00:00:00&end=${end} 23:59:59`)
      .then(r => r.json())
      .then(data => {
        const formatted = data.map(inter => ({
          id: inter.id,
          title: inter.client_name || "Intervention",
          start: inter.scheduled_at,
          end: inter.scheduled_at, // on peut améliorer en ajoutant une heure
          backgroundColor: getTechColor(inter.technician_id),
          borderColor: getTechColor(inter.technician_id),
          extendedProps: {
            technician_name: inter.technician_name,
            description: inter.description,
            technician_id: inter.technician_id
          }
        }));
        setEvents(formatted);
        onInterventionsLoaded && onInterventionsLoaded(data);
      })
      .catch(err => console.error("Erreur chargement interventions :", err));
  };

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
        height="85vh"
        locale="fr"
        firstDay={1}
        editable={true}
        eventClick={(info) => {
          onSelectEvent && onSelectEvent(info.event);
        }}
        datesSet={(arg) => {
          loadWeek(arg.start);
        }}
        eventDrop={async (info) => {
          const newDate = info.event.start;
          const iso = newDate.toISOString().slice(0, 19).replace("T", " ");

          try {
            await fetch(`${API}/interventions/${info.event.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "À FAIRE",        // ou garder ancien statut côté app
                priority: "Normale",      // idem
                description: info.event.extendedProps.description || "",
                scheduled_at: iso
              })
            });
          } catch (e) {
            console.error("Erreur maj intervention drag & drop:", e);
            info.revert();
          }
        }}
      />
    </div>
  );
}
