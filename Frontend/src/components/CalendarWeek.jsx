import React from "react";

function getWeekDays(dateStr) {
  const base = new Date(dateStr);
  const jsDay = base.getDay();
  const monday = new Date(base);
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
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
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

  const slots = {};

  interventions.forEach((inter) => {
  // sécuriser la date
  if (!inter.scheduled_at) return;

  // scheduled_at = "2025-12-07T10:00:00.000Z" OU "2025-12-07 10:00:00"
  let [dayPart, timePart] = inter.scheduled_at.split(" ");

  // Si le backend renvoie au format ISO (avec "T")
  if (!timePart) {
    const isoParts = inter.scheduled_at.split("T");
    dayPart = isoParts[0];
    timePart = isoParts[1];
  }

  if (!dayPart || !timePart) return;

  const hourStr = timePart.substring(0, 2);

  if (!slots[dayPart]) slots[dayPart] = {};
  if (!slots[dayPart][hourStr]) slots[dayPart][hourStr] = [];

  slots[dayPart][hourStr].push(inter);
});


  const handleDrop = (e, dayStr, hour) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const newDateTime = `${dayStr}T${hour}:00`;
    onMove(id, newDateTime);
  };

  return (
    <div className="week-container">

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

      <div className="week-grid">
        <div className="week-times">
          {hours.map((h) => (
            <div key={h} className="week-time">
              {h}:00
            </div>
          ))}
        </div>

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

                    {slots[dayStr]?.[h]?.map((inter) => (
                      <div
                        key={inter.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", inter.id)
                        }
                        onClick={() => onSelect(inter.id)}
                        className={
                          "week-event" +
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
