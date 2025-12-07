import React from "react";

// Retourne les 7 jours de la semaine du lundi → dimanche (sans UTC)
function getWeekDays(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const base = new Date(y, m-1, d);

  const jsDay = base.getDay(); // 0 = dimanche
  const diff = jsDay === 0 ? -6 : 1 - jsDay; // trouver lundi

  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d2 = new Date(monday);
    d2.setDate(monday.getDate() + i);
    days.push(d2);
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
  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  // Création des créneaux
  const slots = {};

  interventions.forEach((inter) => {
    if (!inter.scheduled_at) return;

    // 1️⃣ Split la date brute (PAS de new Date() direct !)
    const [dayPart, timePart] = inter.scheduled_at.split("T");
    const [year, month, day] = dayPart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    // 2️⃣ Construire date locale (sans UTC)
    const d = new Date(year, month - 1, day, hour, minute);

    // 3️⃣ Déduire jour + heure (sans transformation)
    const dayStr = dayPart;
    const hourStr = hour.toString().padStart(2, "0");

    if (!slots[dayStr]) slots[dayStr] = {};
    if (!slots[dayStr][hourStr]) slots[dayStr][hourStr] = [];

    slots[dayStr][hourStr].push(inter);
  });

  // Déplacement intervention
  const handleDrop = (e, dayStr, hour) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const newDateTime = `${dayStr}T${hour}:00`;
    onMove(id, newDateTime);
  };

  return (
    <div className="week-container">

      {/* HEADER */}
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

      {/* GRID */}
      <div className="week-grid">

        {/* Colonne heures */}
        <div className="week-times">
          {hours.map((h) => (
            <div key={h} className="week-time">{h}:00</div>
          ))}
        </div>

        {/* 7 colonnes */}
        <div className="week-days">
          {days.map((d, indexDay) => {
            const dayStr = d.toLocaleDateString("fr-CA"); // YYYY-MM-DD exact

            return (
              <div key={indexDay} className="week-day-col">

                {hours.map((h) => (
                  <div
                    key={h}
                    className="week-slot"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, dayStr, h)}
                  >
                    {/* Interventions */}
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
                          (inter.id === selectedId ? "week-event-active " : "")
                        }
                        style={{
                          background: getTechColor(inter.technician_id)
                        }}
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
