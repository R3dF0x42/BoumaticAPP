import React, { useEffect, useMemo, useState } from "react";
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
  "#ffb800"
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
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).toLocaleDateString(
      "fr-CA"
    );

  return { start: fmt(monday), end: fmt(sunday) };
}

export default function GoogleCalendarFull({
  onSelectEvent,
  onInterventionsLoaded
}) {
  const [events, setEvents] = useState([]);
  const [currentStart, setCurrentStart] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  });
  const [zoom, setZoom] = useState(() => (typeof window !== "undefined" && window.innerWidth <= 768 ? 0.9 : 1));

  // ---- charge la semaine ----
  const loadWeek = (dateObj) => {
    if (!dateObj) return;

    setCurrentStart(dateObj);

    const { start, end } = getWeekRange(dateObj);

    fetch(`${API}/interventions?start=${start} 00:00:00&end=${end} 23:59:59`)
      .then((r) => r.json())
      .then((data) => {
        const formatted = data.map((inter) => {
          const start = new Date(inter.scheduled_at);
          const duration = inter.duration_minutes || 60; // 60 minutes par defaut
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
      .catch((err) => console.error("Erreur chargement interventions :", err));
  };

  // ---- refresh du calendrier externe (nouvelle intervention) ----
  useEffect(() => {
    const handler = () => {
      if (currentStart) loadWeek(currentStart);
    };

    window.addEventListener("refreshCalendar", handler);
    return () => window.removeEventListener("refreshCalendar", handler);
  }, [currentStart]);

  // ---- mode mobile ----
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "timeGridWeek,timeGridDay,dayGridMonth"
    }),
    [isMobile]
  );

  const calendarKey = isMobile ? "calendar-mobile" : "calendar-desktop";
  const calendarHeight = isMobile ? "100vh" : "85vh";

  return (
    <div className={`page calendar-shell ${isMobile ? "calendar-shell--mobile" : ""}`}>
      <div className="page-header">
        <h2>Planning interventions</h2>
        <p className="muted-small">Synchro Google Calendar</p>
        <div className="calendar-zoom">
          <button
            type="button"
            className="btn small ghost"
            onClick={() => setZoom((z) => Math.max(0.7, parseFloat((z - 0.05).toFixed(2))))}
          >
            -
          </button>
          <span className="calendar-zoom-value">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn small"
            onClick={() => setZoom((z) => Math.min(1.15, parseFloat((z + 0.05).toFixed(2))))}
          >
            +
          </button>
        </div>
      </div>

      <div
        className="calendar-zoom-wrapper"
        style={{
          transform: isMobile ? undefined : `scale(${zoom})`,
          transformOrigin: "top left",
          width: isMobile ? "100%" : `${100 / zoom}%`,
          height: isMobile ? "100%" : "100%",
          maxHeight: isMobile ? "100%" : "100%"
        }}
      >
        <FullCalendar
          key={calendarKey}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          allDaySlot={false}
          slotDuration={isMobile ? "01:00:00" : "00:30:00"}
          slotMinTime={isMobile ? "06:00:00" : "00:00:00"}
          slotMaxTime={isMobile ? "20:00:00" : "24:00:00"}
          nowIndicator
          events={events}
          firstDay={1}
          locale="fr"
          height={calendarHeight}
          contentHeight={isMobile ? "auto" : "100%"}
          handleWindowResize={false}
          dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          headerToolbar={headerToolbar}
          stickyHeaderDates
          dayMaxEventRows={isMobile ? 3 : 4}
          expandRows
          editable
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
                  status: "A FAIRE",
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
    </div>
  );
}
