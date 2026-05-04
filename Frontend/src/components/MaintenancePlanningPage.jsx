import React, { useEffect, useMemo, useState } from "react";

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: new Date(2026, index, 1).toLocaleDateString("fr-FR", {
    month: "long"
  })
}));

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimePart(value) {
  if (!value) return "09:00";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "09:00";
  return date.toTimeString().slice(0, 5);
}

function getMaintenanceState(intervention) {
  if (intervention.status === "PRET") return "ready";
  return "missing";
}

function getMaintenanceStateLabel(state) {
  if (state === "ready") return "Pret";
  return "A planifier";
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function UncheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function isContractMaintenance(intervention) {
  return Boolean(intervention.maintenance_plan_id || intervention.maintenance_kit_label);
}

export default function MaintenancePlanningPage({ apiUrl }) {
  const [interventions, setInterventions] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadData = async () => {
    setError("");

    try {
      const [interventionsRes, techniciansRes] = await Promise.all([
        fetch(`${apiUrl}/interventions`),
        fetch(`${apiUrl}/technicians`)
      ]);
      const [interventionsData, techniciansData] = await Promise.all([
        interventionsRes.json(),
        techniciansRes.json()
      ]);

      if (!interventionsRes.ok) {
        throw new Error(interventionsData.error || "Impossible de charger les maintenances.");
      }

      if (!techniciansRes.ok) {
        throw new Error(techniciansData.error || "Impossible de charger les techniciens.");
      }

      setInterventions(
        (Array.isArray(interventionsData) ? interventionsData : []).filter(isContractMaintenance)
      );
      setTechnicians(Array.isArray(techniciansData) ? techniciansData : []);
    } catch (err) {
      setError(err.message || "Impossible de charger les maintenances.");
    }
  };

  useEffect(() => {
    loadData();
  }, [apiUrl]);

  const visibleInterventions = useMemo(
    () =>
      interventions.filter((intervention) => {
        const date = new Date(intervention.scheduled_at);
        return Number.isNaN(date.getTime()) || date.getFullYear() === year;
      }),
    [interventions, year]
  );

  const orderedMonths = useMemo(() => {
    const now = new Date();
    const firstMonth = year === now.getFullYear() ? now.getMonth() : 0;
    return Array.from({ length: 12 }, (_, index) => MONTHS[(firstMonth + index) % 12]);
  }, [year]);

  const monthGroups = useMemo(() => {
    const groups = MONTHS.map((month) => ({
      ...month,
      interventions: []
    }));
    const unscheduled = [];

    for (const intervention of visibleInterventions) {
      const date = new Date(intervention.scheduled_at);
      if (Number.isNaN(date.getTime())) {
        unscheduled.push(intervention);
        continue;
      }
      groups[date.getMonth()].interventions.push(intervention);
    }

    for (const group of groups) {
      group.interventions.sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
    }

    return { groups, unscheduled };
  }, [visibleInterventions]);

  const summary = useMemo(() => {
    const counts = { ready: 0, missing: 0 };
    visibleInterventions.forEach((intervention) => {
      counts[getMaintenanceState(intervention)] += 1;
    });
    return counts;
  }, [visibleInterventions]);

  const updateIntervention = async (intervention, updates) => {
    const next = { ...intervention, ...updates };
    const dateValue = toDateInput(next.scheduled_at);
    const timeValue = toTimePart(intervention.scheduled_at);
    const scheduledAt = dateValue ? `${dateValue} ${timeValue}:00` : null;

    setSavingId(intervention.id);
    setError("");
    setInfo("");

    try {
      const res = await fetch(`${apiUrl}/interventions/${intervention.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: next.client_id,
          technician_id: next.technician_id || null,
          status: next.status || "A FAIRE",
          priority: next.priority || "Normale",
          description: next.description || "",
          scheduled_at: scheduledAt,
          duration_minutes: next.duration_minutes || 1440
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Impossible de modifier la maintenance.");
      }

      setInterventions((items) =>
        items.map((item) =>
          item.id === intervention.id
            ? {
                ...item,
                ...updates,
                scheduled_at: scheduledAt
              }
            : item
        )
      );
      setInfo("Maintenance mise a jour.");
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch (err) {
      setError(err.message || "Impossible de modifier la maintenance.");
    } finally {
      setSavingId(null);
    }
  };

  const renderMaintenanceCard = (intervention) => {
    const state = getMaintenanceState(intervention);
    const dateValue = toDateInput(intervention.scheduled_at);
    const isReady = state === "ready";

    return (
      <article
        key={intervention.id}
        className={`maintenance-month-card maintenance-month-card--${state}`}
      >
        <div className="maintenance-month-card-head">
          <div>
            <strong>{intervention.client_name || "Client"}</strong>
            <span>{intervention.maintenance_kit_label || intervention.description}</span>
          </div>
          <button
            className={`icon-btn maintenance-ready-check ${
              isReady ? "maintenance-ready-check--active" : ""
            }`}
            type="button"
            onClick={() =>
              updateIntervention(intervention, { status: isReady ? "A FAIRE" : "PRET" })
            }
            disabled={savingId === intervention.id}
            title={isReady ? "Repasser a planifier" : "Marquer comme pret"}
            aria-label={
              isReady
                ? "Repasser la maintenance a planifier"
                : "Marquer la maintenance comme prete"
            }
          >
            {isReady ? <UncheckIcon /> : <CheckIcon />}
          </button>
        </div>

        {intervention.description && (
          <p className="maintenance-month-description">{intervention.description}</p>
        )}

        <div className="maintenance-quick-fields">
          <label>
            Date
            <input
              type="date"
              value={dateValue}
              required
              onChange={(event) => {
                if (!event.target.value) return;
                updateIntervention(intervention, {
                  scheduled_at: `${event.target.value}T${toTimePart(intervention.scheduled_at)}:00`
                });
              }}
              disabled={savingId === intervention.id}
            />
          </label>

          <label>
            Technicien
            <select
              value={intervention.technician_id || ""}
              onChange={(event) =>
                updateIntervention(intervention, {
                  technician_id: event.target.value ? Number(event.target.value) : null,
                  technician_name:
                    technicians.find((tech) => String(tech.id) === event.target.value)?.name ||
                    null
                })
              }
              disabled={savingId === intervention.id}
            >
              <option value="">A choisir</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>
    );
  };

  return (
    <main className="page page--wide maintenance-planning-page">
      <div className="page-header">
        <div>
          <h2>Maintenance a prevoir</h2>
          <p className="muted-small">
            Maintenances generees automatiquement par les contrats.
          </p>
        </div>

        <div className="maintenance-year-nav">
          <button className="btn small ghost" type="button" onClick={() => setYear((y) => y - 1)}>
            {"<"}
          </button>
          <strong>{year}</strong>
          <button className="btn small ghost" type="button" onClick={() => setYear((y) => y + 1)}>
            {">"}
          </button>
        </div>
      </div>

      {error && <p className="login-error">{error}</p>}
      {info && <p className="ok-message">{info}</p>}

      <div className="maintenance-summary-row">
        <span className="maintenance-summary maintenance-summary--ready">
          <strong>{summary.ready}</strong>
          pret
        </span>
        <span className="maintenance-summary maintenance-summary--missing">
          <strong>{summary.missing}</strong>
          a planifier
        </span>
      </div>

      {monthGroups.unscheduled.length > 0 && (
        <section className="maintenance-month maintenance-month--unscheduled">
          <div className="maintenance-month-title">
            <h3>A planifier</h3>
            <span>{monthGroups.unscheduled.length}</span>
          </div>
          <div className="maintenance-month-list">
            {monthGroups.unscheduled.map(renderMaintenanceCard)}
          </div>
        </section>
      )}

      <div className="maintenance-month-grid">
        {orderedMonths.map((orderedMonth) => {
          const month = monthGroups.groups[orderedMonth.index];
          return (
          <section className="maintenance-month" key={month.index}>
            <div className="maintenance-month-title">
              <h3>{month.label}</h3>
              <span>{month.interventions.length}</span>
            </div>

            <div className="maintenance-month-list">
              {month.interventions.map(renderMaintenanceCard)}
              {!month.interventions.length && (
                <div className="maintenance-month-empty">Aucune maintenance</div>
              )}
            </div>
          </section>
          );
        })}
      </div>
    </main>
  );
}
