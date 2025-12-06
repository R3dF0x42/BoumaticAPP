import React from "react";

// Retourne les 7 jours de la semaine du lundi → dimanche
function getWeekDays(dateStr) {
  const base = new Date(dateStr);
  const jsDay = base.getDay(); // 0 = dimanche... 1 = lundi...

  // Trouver le lundi de la semaine
  const monday = new Date(base);
  const diff = jsDay === 0 ? -6 : 1 - jsDay; // dimanche → -6, mardi → -1, etc.
  monday.setDate(base.getDate() + diff);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  return days;
}

export default function CalendarWeek({
  date,
  interventions,
  selectedId,
  onSelect,
  onMove,
  getTechColor
}) {
  const days = getWeekDays(date);

  // 24h format
  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  // Regrouper les interventions
  const slots = {};
  interventions.forEach((inter) => {
    const d = new Date(inter.scheduled_at);
    const dayStr = d.toISOString().split("T")[0];
    const hourStr = d.getHours().toString().padStart(2, "0");

    if (!slots[dayStr]) slots[dayStr] = {};
    if (!slots[dayStr][hourStr]) slots[dayStr][hourStr] = [];
    slots[dayStr][hourStr].push(inter);
  });

  const handleDrop = (e, dayStr, hour) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");

    if (!id) return;

    const newDateTime = `${dayStr}T${hour}:00`;

    onMove(id, newDateTime);
  };

  return (
    <div className="week-container">

      {/* HEADER (jours) */}
      <div className="week-header">
        <div className="week-header-time">Heure</div>
        {days.map((d, i) => (
          <div key={i} className="week-header-day">
            {d.toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "2-digit",
            })}
          </div>
        ))}
      </div>

      {/* GRID (24h x 7 jours) */}
      <div className="week-grid">

        {/* Colonne heures */}
        <div className="week-times">
          {hours.map((h) => (
            <div key={h} className="week-time">
              {h}:00
            </div>
          ))}
        </div>

        {/* 7 colonnes de jours */}
        <div className="week-days">
          {days.map((d, i) => {
            const dayStr = d.toISOString().split("T")[0];

            return (
              <div key={i} className="week-day-col">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="week-slot"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, dayStr, h)}
                  >
                    {/* Afficher les interventions */}
                    {slots[dayStr]?.[h]?.map((inter) => (
                      <div
                        key={inter.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", inter.id)
                        }
                        onClick={() => onSelect(inter.id)}
                        className={
                          "week-event " +
                          (inter.priority === "Urgente"
                            ? "week-event-urgent"
                            : "week-event-normal") +
                          (inter.id === selectedId ? " week-event-active" : "")
                        }
                        style={{ background: getTechColor(inter.technician_id) }}
                      >
                        <strong>{inter.client_name}</strong>

                        <div className="week-small">
                          {inter.description}
                        </div>

                        <div className="week-small" style={{ opacity: 0.7 }}>
                          {inter.technician_name}
                        </div>

                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
