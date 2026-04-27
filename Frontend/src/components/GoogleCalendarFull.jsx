import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import { API_URL } from "../config/api.js";

const API = API_URL;

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

function formatDateKey(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString(
    "fr-CA"
  );
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekDays(date) {
  const { start } = getWeekRange(date);
  const first = new Date(`${start}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

function formatEventTime(date) {
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function GoogleCalendarFull({
  onSelectEvent,
  onInterventionsLoaded
}) {
  const [events, setEvents] = useState([]);
  const [currentStart, setCurrentStart] = useState(null);
  const [mobileFilter, setMobileFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // ---- charge la semaine ----
  const loadWeek = useCallback((dateObj) => {
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
              client_id: inter.client_id,
              technician_name: inter.technician_name,
              description: inter.description,
              status: inter.status,
              priority: inter.priority,
              technician_id: inter.technician_id,
              duration_minutes: inter.duration_minutes,
              maintenance_kit_label: inter.maintenance_kit_label
            }
          };
        });

        setEvents(formatted);
        onInterventionsLoaded && onInterventionsLoaded(data);
      })
      .catch((err) => console.error("Erreur chargement interventions :", err));
  }, [onInterventionsLoaded]);

  // ---- refresh du calendrier externe (nouvelle intervention) ----
  useEffect(() => {
    const handler = () => {
      loadWeek(currentStart || selectedDate);
    };

    window.addEventListener("refreshCalendar", handler);
    return () => window.removeEventListener("refreshCalendar", handler);
  }, [currentStart, loadWeek, selectedDate]);

  // ---- mode mobile ----
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) loadWeek(selectedDate);
  }, [isMobile, loadWeek, selectedDate]);

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "timeGridWeek,timeGridDay,dayGridMonth"
    }),
    [isMobile]
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const selectedDateKey = formatDateKey(selectedDate);
  const selectedDayEvents = useMemo(
    () =>
      events
        .filter((event) => formatDateKey(event.start) === selectedDateKey)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, selectedDateKey]
  );
  const visibleDayEvents = useMemo(() => {
    if (mobileFilter === "all") return selectedDayEvents;
    return selectedDayEvents.filter((event) => {
      const status = String(event.extendedProps.status || "").toLowerCase();
      const priority = String(event.extendedProps.priority || "").toLowerCase();
      if (mobileFilter === "urgent") return priority.includes("urgent");
      if (mobileFilter === "done") return status.includes("termine");
      if (mobileFilter === "open") return !status.includes("termine");
      return true;
    });
  }, [mobileFilter, selectedDayEvents]);

  const openCount = selectedDayEvents.filter(
    (event) => !String(event.extendedProps.status || "").toLowerCase().includes("termine")
  ).length;
  const urgentCount = selectedDayEvents.filter((event) =>
    String(event.extendedProps.priority || "").toLowerCase().includes("urgent")
  ).length;

  const selectedDateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const weekLabel = `${weekDays[0].toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short"
  })} - ${weekDays[6].toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short"
  })}`;

  if (isMobile) {
    return (
      <div className="page calendar-shell calendar-shell--mobile mobile-agenda-shell">
        <div className="mobile-agenda-header">
          <div>
            <p className="muted-small">Planning interventions</p>
            <h2>{selectedDateLabel}</h2>
          </div>
          <span className="mobile-agenda-count">
            {selectedDayEvents.length}
          </span>
        </div>

        <div className="mobile-agenda-summary">
          <span>
            <strong>{openCount}</strong>
            a faire
          </span>
          <span>
            <strong>{urgentCount}</strong>
            urgent
          </span>
          <span>
            <strong>{selectedDayEvents.length}</strong>
            total
          </span>
        </div>

        <div className="mobile-agenda-nav">
          <button
            type="button"
            className="mobile-agenda-nav-btn"
            onClick={() => setSelectedDate((date) => addDays(date, -7))}
            aria-label="Semaine precedente"
          >
            {"<"}
          </button>
          <button
            type="button"
            className="mobile-agenda-today"
            onClick={() => setSelectedDate(new Date())}
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            className="mobile-agenda-nav-btn"
            onClick={() => setSelectedDate((date) => addDays(date, 7))}
            aria-label="Semaine suivante"
          >
            {">"}
          </button>
        </div>

        <p className="mobile-agenda-week">{weekLabel}</p>

        <div className="mobile-day-strip" aria-label="Jours de la semaine">
          {weekDays.map((day) => {
            const dayKey = formatDateKey(day);
            const count = events.filter((event) => formatDateKey(event.start) === dayKey).length;
            return (
              <button
                key={dayKey}
                type="button"
                className={`mobile-day-pill ${
                  dayKey === selectedDateKey ? "mobile-day-pill--active" : ""
                }`}
                onClick={() => setSelectedDate(day)}
              >
                <span>
                  {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                </span>
                <strong>{day.getDate()}</strong>
                {count > 0 && <em>{count}</em>}
              </button>
            );
          })}
        </div>

        <div className="mobile-agenda-filters" aria-label="Filtres planning">
          {[
            ["all", "Tout"],
            ["open", "A faire"],
            ["urgent", "Urgent"],
            ["done", "Termine"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={mobileFilter === value ? "mobile-filter--active" : ""}
              onClick={() => setMobileFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mobile-agenda-list">
          {visibleDayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              className="mobile-agenda-card"
              onClick={() => onSelectEvent && onSelectEvent(event)}
              style={{ "--event-color": event.backgroundColor }}
            >
              <span className="mobile-agenda-time">
                {formatEventTime(event.start)}
              </span>
              <span className="mobile-agenda-body">
                <strong>{event.title}</strong>
                <span>
                  {event.extendedProps.technician_name || "Technicien non assigne"}
                </span>
                {event.extendedProps.description && (
                  <small>{event.extendedProps.description}</small>
                )}
                {event.extendedProps.maintenance_kit_label && (
                  <em className="mobile-agenda-kit">
                    {event.extendedProps.maintenance_kit_label}
                  </em>
                )}
              </span>
              <span className="mobile-agenda-status">
                {event.extendedProps.status || "A FAIRE"} · {event.extendedProps.priority || "Normale"}
              </span>
            </button>
          ))}

          {!visibleDayEvents.length && (
            <div className="mobile-agenda-empty">
              <strong>Aucune intervention</strong>
              <span>Change de jour, retire le filtre ou ajoute une intervention.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page calendar-shell">
      <div className="page-header">
        <div>
          <h2>Planning interventions</h2>
          <p className="muted-small">Synchro Google Calendar</p>
        </div>
      </div>

      <div className="calendar-zoom-wrapper">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          allDaySlot={false}
          slotDuration="00:30:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          nowIndicator
          events={events}
          firstDay={1}
          locale="fr"
          height="85vh"
          contentHeight="100%"
          handleWindowResize={false}
          dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          eventContent={(info) => (
            <div className="fc-event-inner-custom">
              <strong>
                {info.timeText} {info.event.title}
              </strong>
              {info.event.extendedProps.maintenance_kit_label && (
                <span className="fc-maintenance-tag">
                  {info.event.extendedProps.maintenance_kit_label}
                </span>
              )}
            </div>
          )}
          headerToolbar={headerToolbar}
          stickyHeaderDates
          dayMaxEventRows={4}
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
                  client_id: info.event.extendedProps.client_id,
                  technician_id: info.event.extendedProps.technician_id || null,
                  description: info.event.extendedProps.description || "",
                  scheduled_at: iso,
                  duration_minutes: info.event.extendedProps.duration_minutes || 60
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
