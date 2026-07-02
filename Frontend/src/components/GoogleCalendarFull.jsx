import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import OnCallTechnicianControl from "./OnCallTechnicianControl.jsx";
import { API_URL } from "../config/api.js";
import { formatMaintenanceKitLabel } from "../utils/maintenance.js";

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

const CALENDAR_PLUGINS = [timeGridPlugin, dayGridPlugin, interactionPlugin];

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

function formatTimeKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultDateForCalendarView(dateInfo) {
  const rangeStart = dateInfo?.view?.currentStart || dateInfo?.start;
  const rangeEnd = dateInfo?.view?.currentEnd || dateInfo?.end;
  const today = startOfDay(new Date());

  if (rangeStart && rangeEnd) {
    const start = startOfDay(new Date(rangeStart));
    const end = startOfDay(new Date(rangeEnd));
    if (today >= start && today < end) return today;
  }

  return rangeStart ? new Date(rangeStart) : new Date();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function eventOverlapsDay(event, date) {
  const eventStart = event.start;
  const eventEnd = event.end || event.start;
  return eventStart <= endOfDay(date) && eventEnd >= startOfDay(date);
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

function formatLocalDateTimeForApi(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function parseApiResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

function formatMobileEventTime(event, selectedDate) {
  const eventEnd = event.end || event.start;
  const startsBeforeDay = event.start < startOfDay(selectedDate);
  const endsAfterDay = eventEnd > endOfDay(selectedDate);

  if (startsBeforeDay && endsAfterDay) return "Toute la journee";
  if (startsBeforeDay) return `Jusqu'a ${formatEventTime(eventEnd)}`;
  if (endsAfterDay) return `Depuis ${formatEventTime(event.start)}`;
  return formatEventTime(event.start);
}

function buildViewerQuery(user) {
  if (!user) return "";
  const params = new URLSearchParams();

  if (user.role === "admin") {
    params.set("viewer_role", "admin");
  } else if (user.id) {
    params.set("viewer_technician_id", String(user.id));
  }

  const query = params.toString();
  return query ? `&${query}` : "";
}

function buildViewerOnlyQuery(user) {
  const query = buildViewerQuery(user);
  return query ? `?${query.slice(1)}` : "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isDoneStatus(status) {
  return normalizeText(status).includes("termine");
}

function isUrgentPriority(priority) {
  return normalizeText(priority).includes("urgent");
}

function isDueByToday(intervention) {
  if (!intervention?.scheduled_at) return false;

  const scheduledAt = new Date(intervention.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  return scheduledAt <= endOfDay(new Date());
}

function isContractMaintenance(intervention) {
  return Boolean(intervention?.maintenance_plan_id || intervention?.maintenance_kit_label);
}

function isPlannedMaintenance(intervention) {
  const status = normalizeText(intervention?.status);
  return (
    isContractMaintenance(intervention) &&
    Boolean(intervention?.scheduled_at) &&
    status !== "a faire" &&
    !isDoneStatus(status)
  );
}

export default function GoogleCalendarFull({
  onSelectEvent,
  onInterventionsLoaded,
  onActiveDateChange,
  loggedUser
}) {
  const [events, setEvents] = useState([]);
  const [summaryInterventions, setSummaryInterventions] = useState([]);
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

    fetch(`${API}/interventions?start=${start} 00:00:00&end=${end} 23:59:59${buildViewerQuery(loggedUser)}`)
      .then((r) => parseApiResponse(r, "Impossible de charger les interventions."))
      .then((data) => {
        const visibleInterventions = (Array.isArray(data) ? data : []).filter((inter) => {
          const isContractMaintenance = Boolean(
            inter.maintenance_plan_id || inter.maintenance_kit_label
          );
          return (
            !isContractMaintenance ||
            inter.status === "PRET" ||
            inter.status === "TERMINE"
          );
        });

        const formatted = visibleInterventions.map((inter) => {
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
              technician_names: inter.technician_names,
              description: inter.description,
              status: inter.status,
              priority: inter.priority,
              technician_id: inter.technician_id,
              technician_ids: inter.technician_ids,
              duration_minutes: inter.duration_minutes,
              maintenance_type: inter.maintenance_type,
              maintenance_kit_label: formatMaintenanceKitLabel(inter)
            }
          };
        });

        setEvents(formatted);
        onInterventionsLoaded && onInterventionsLoaded(visibleInterventions);
      })
      .catch((err) => console.error("Erreur chargement interventions :", err));
  }, [loggedUser, onInterventionsLoaded]);

  const loadSummaryInterventions = useCallback(() => {
    fetch(`${API}/interventions${buildViewerOnlyQuery(loggedUser)}`)
      .then((r) => parseApiResponse(r, "Impossible de charger les compteurs."))
      .then((data) => {
        setSummaryInterventions(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Erreur chargement compteurs :", err));
  }, [loggedUser]);

  // ---- refresh du calendrier externe (nouvelle intervention) ----
  useEffect(() => {
    const handler = () => {
      loadWeek(currentStart || selectedDate);
      if (isMobile) loadSummaryInterventions();
    };

    window.addEventListener("refreshCalendar", handler);
    return () => window.removeEventListener("refreshCalendar", handler);
  }, [currentStart, isMobile, loadSummaryInterventions, loadWeek, selectedDate]);

  // ---- mode mobile ----
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    const timer = window.setTimeout(() => loadWeek(selectedDate), 0);
    return () => window.clearTimeout(timer);
  }, [isMobile, loadWeek, selectedDate]);

  useEffect(() => {
    if (!isMobile) return;
    onActiveDateChange && onActiveDateChange(formatDateKey(selectedDate));
  }, [isMobile, onActiveDateChange, selectedDate]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const timer = window.setTimeout(() => loadSummaryInterventions(), 0);
    return () => window.clearTimeout(timer);
  }, [isMobile, loadSummaryInterventions]);

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "timeGridWeek,timeGridDay,dayGridMonth"
    }),
    []
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const selectedWeekStart = useMemo(() => getWeekRange(selectedDate).start, [selectedDate]);
  const calendarWeekStart = useMemo(
    () => getWeekRange(currentStart || selectedDate).start,
    [currentStart, selectedDate]
  );
  const selectedDateKey = formatDateKey(selectedDate);
  const eventCountsByDay = useMemo(() => {
    const counts = new Map();
    for (const event of events) {
      for (const day of weekDays) {
        if (!eventOverlapsDay(event, day)) continue;
        const dayKey = formatDateKey(day);
        counts.set(dayKey, (counts.get(dayKey) || 0) + 1);
      }
    }
    return counts;
  }, [events, weekDays]);
  const selectedDayEvents = useMemo(
    () =>
      events
        .filter((event) => eventOverlapsDay(event, selectedDate))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, selectedDate]
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

  const globalSummary = useMemo(() => {
    let openCount = 0;
    let urgentCount = 0;
    let maintenanceCount = 0;

    for (const intervention of summaryInterventions) {
      const isOpenDue = !isDoneStatus(intervention.status) && isDueByToday(intervention);
      if (isOpenDue) openCount += 1;
      if (isOpenDue && isUrgentPriority(intervention.priority)) {
        urgentCount += 1;
      }
      if (isPlannedMaintenance(intervention)) maintenanceCount += 1;
    }

    return { openCount, urgentCount, maintenanceCount };
  }, [summaryInterventions]);

  const selectedDateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const selectedMonthLabel = selectedDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric"
  });

  const weekLabel = `${weekDays[0].toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  })} - ${weekDays[6].toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  })}`;

  if (isMobile) {
    return (
      <div className="page calendar-shell calendar-shell--mobile mobile-agenda-shell">
        <div className="mobile-agenda-header">
          <div className="mobile-agenda-title">
            <p className="muted-small">{selectedDateLabel}</p>
            <h2>{selectedMonthLabel}</h2>
          </div>
          <div className="mobile-agenda-header-actions">
            <OnCallTechnicianControl
              apiUrl={API}
              loggedUser={loggedUser}
              weekStart={selectedWeekStart}
              className="mobile-agenda-on-call"
              label="Astreinte"
            />
          </div>
        </div>

        <div className="mobile-agenda-summary">
          <span>
            <strong>{globalSummary.openCount}</strong>
            a faire
          </span>
          <span>
            <strong>{globalSummary.urgentCount}</strong>
            urgent
          </span>
          <span>
            <strong>{globalSummary.maintenanceCount}</strong>
            maintenance
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
            const count = eventCountsByDay.get(dayKey) || 0;
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
                {formatMobileEventTime(event, selectedDate)}
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
        <div className="planning-header-actions">
          <OnCallTechnicianControl
            apiUrl={API}
            loggedUser={loggedUser}
            weekStart={calendarWeekStart}
            label="Astreinte semaine"
          />
        </div>
      </div>

      <div className="calendar-zoom-wrapper">
        <FullCalendar
          plugins={CALENDAR_PLUGINS}
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
              <span className="fc-technician-name">
                {info.event.extendedProps.technician_name || "Technicien non assigne"}
              </span>
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
            if (!isMobile) {
              onActiveDateChange &&
                onActiveDateChange(formatDateKey(getDefaultDateForCalendarView(arg)));
            }
            loadWeek(arg.start);
          }}
          dateClick={(info) => {
            const date = formatDateKey(info.date);
            const time = info.allDay ? null : formatTimeKey(info.date);
            onActiveDateChange && onActiveDateChange(date);
            window.dispatchEvent(
              new CustomEvent("openNewIntervention", {
                detail: { date, time }
              })
            );
          }}
          eventClick={(info) => {
            onSelectEvent && onSelectEvent(info.event);
          }}
          eventResize={async (info) => {
            const durationMinutes = Math.max(
              15,
              Math.round(
                ((info.event.end || info.event.start).getTime() - info.event.start.getTime()) /
                  60000
              )
            );

            try {
              const res = await fetch(`${API}/interventions/${info.event.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  client_id: info.event.extendedProps.client_id,
                  technician_id: info.event.extendedProps.technician_id,
                  technician_ids: info.event.extendedProps.technician_ids,
                  status: info.event.extendedProps.status,
                  priority: info.event.extendedProps.priority,
                  description: info.event.extendedProps.description,
                  scheduled_at: formatLocalDateTimeForApi(info.event.start),
                  duration_minutes: durationMinutes
                })
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data.error || "Impossible de modifier l'intervention.");
              }
              window.dispatchEvent(new Event("refreshCalendar"));
            } catch (e) {
              console.error("Erreur resize event :", e);
              info.revert();
            }
          }}
          eventDrop={async (info) => {
            const iso = formatLocalDateTimeForApi(info.event.start);

            try {
              const res = await fetch(`${API}/interventions/${info.event.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: info.event.extendedProps.status || "A FAIRE",
                  priority: info.event.extendedProps.priority || "Normale",
                  client_id: info.event.extendedProps.client_id,
                  technician_id: info.event.extendedProps.technician_id || null,
                  technician_ids:
                    info.event.extendedProps.technician_ids ||
                    (info.event.extendedProps.technician_id
                      ? [info.event.extendedProps.technician_id]
                      : []),
                  description: info.event.extendedProps.description || "",
                  scheduled_at: iso,
                  duration_minutes: info.event.extendedProps.duration_minutes || 60
                })
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data.error || "Impossible de modifier l'intervention.");
              }
              window.dispatchEvent(new Event("refreshCalendar"));
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
