import React from "react";

export default function CalendarPanel({
  date,
  interventions,
  selectedId,
  onSelect,
  onMove
}) {
  const slots = {};
  interventions.forEach((i) => {
    const hour = new Date(i.scheduled_at)
      .toLocaleTimeString("fr-FR", { hour: "2-digit" })
      .padStart(2, "0");
    if (!slots[hour]) slots[hour] = [];
    slots[hour].push(i);
  });

  const hours = Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, "0"));

  const handleDrop = (e, hour) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) onMove(id, `${hour}:00`);
  };

  return (
    <main className="calendar-panel">
      <div className="calendar-header">
        <div>
          <h2>Planning d&apos;intervention</h2>
          <p className="muted">
            {new Date(date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric"
            })}
          </p>
        </div>
        <div className="view-switch">Jour</div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-times">
          {hours.map((h) => (
            <div key={h} className="calendar-time">
              {h}:00
            </div>
          ))}
        </div>
        <div className="calendar-events">
          {hours.map((h) => (
            <div
              key={h}
              className="calendar-slot"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, h)}
            >
              {slots[h]?.map((i) => (
                <div
                  key={i.id}
                  className={
                    "calendar-event " +
                    (i.priority &&
                    i.priority.toLowerCase().startsWith("urgent")
                      ? "calendar-event--orange"
                      : "calendar-event--blue") +
                    (i.id === selectedId ? " calendar-event--active" : "")
                  }
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", i.id.toString())
                  }
                  onClick={() => onSelect(i.id)}
                >
                  <strong>{i.client_name}</strong>
                  <div className="muted-small">
                    {new Date(i.scheduled_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                    {" - "}
                    {i.description}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
