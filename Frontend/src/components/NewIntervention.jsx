import React, { useState, useEffect } from "react";
import { API_URL } from "../config/api.js";

const API = API_URL;

function getDefaultDateTime() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getDefaultDate() {
  return getDefaultDateTime().slice(0, 10);
}

function getDefaultTime() {
  return getDefaultDateTime().slice(11, 16);
}

const TIME_MODES = {
  full_day: { label: "Journee entiere", start: "07:00", duration: 660 },
  morning: { label: "Matin", start: "07:00", duration: 300 },
  afternoon: { label: "Apres-midi", start: "13:00", duration: 300 },
  multi_day: { label: "Plusieurs jours", start: "07:00", end: "18:00" },
  custom: { label: "Heure precise", start: getDefaultTime(), duration: 60 }
};

function normalizeTechnicianIdList(values) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || "");
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function getTechnicianRows(selectedIds, technicians) {
  const rows = normalizeTechnicianIdList(selectedIds);
  if (rows.length < technicians.length) return [...rows, ""];
  return rows.length ? rows : [""];
}

function getDurationBetweenDates(startDate, startTime, endDate, endTime) {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export default function NewIntervention({ loggedUser, onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [techs, setTechs] = useState([]);
  const canCreatePrivateIntervention = loggedUser?.role === "technician" && loggedUser?.id;
  const defaultTechnicianId = canCreatePrivateIntervention ? String(loggedUser.id) : "";
  const [form, setForm] = useState({
    client_id: "",
    technician_ids: defaultTechnicianId ? [defaultTechnicianId] : [],
    scheduled_date: getDefaultDate(),
    scheduled_end_date: getDefaultDate(),
    time_mode: "morning",
    scheduled_time: "07:00",
    priority: "Normale",
    status: "A FAIRE",
    description: "",
    duration_minutes: 60,
    private_to_me: false
  });

  useEffect(() => {
    fetch(API + "/clients")
      .then((r) => r.json())
      .then(setClients);
    fetch(API + "/technicians")
      .then((r) => r.json())
      .then(setTechs);
  }, []);

  useEffect(() => {
    if (!defaultTechnicianId) return;
    setForm((current) =>
      current.technician_ids?.length
        ? current
        : { ...current, technician_ids: [defaultTechnicianId] }
    );
  }, [defaultTechnicianId]);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const setScheduledDate = (value) => {
    setForm((f) => ({
      ...f,
      scheduled_date: value,
      scheduled_end_date: f.scheduled_end_date < value ? value : f.scheduled_end_date
    }));
  };

  const setTechnicianAt = (index, value) => {
    setForm((current) => {
      const nextIds = normalizeTechnicianIdList(current.technician_ids);
      if (value) {
        nextIds[index] = value;
      } else if (index < nextIds.length) {
        nextIds.splice(index, 1);
      }
      return { ...current, technician_ids: normalizeTechnicianIdList(nextIds) };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const mode = TIME_MODES[form.time_mode] || TIME_MODES.custom;
    const startTime = form.time_mode === "custom" ? form.scheduled_time : mode.start;
    const duration =
      form.time_mode === "multi_day"
        ? getDurationBetweenDates(
            form.scheduled_date,
            mode.start,
            form.scheduled_end_date,
            mode.end
          )
        : form.time_mode === "custom"
          ? form.duration_minutes || 60
          : mode.duration;
    const technicianIds = normalizeTechnicianIdList(form.technician_ids).map(Number);

    if (!duration || duration < 15) {
      alert("La date de fin doit etre apres la date de debut.");
      return;
    }

    const payload = {
      client_id: Number(form.client_id),
      technician_id: technicianIds[0] || null,
      technician_ids: technicianIds,
      scheduled_at: `${form.scheduled_date} ${startTime}:00`,
      priority: form.priority,
      status: form.status,
      description: form.description,
      duration_minutes: duration,
      private_to_technician_id:
        canCreatePrivateIntervention && form.private_to_me ? Number(loggedUser.id) : null
    };

    const res = await fetch(API + "/interventions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      onCreated();
      onClose();
    } else {
      console.error("Erreur API :", await res.text());
      alert("Erreur lors de la creation de l'intervention.");
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-block">
            <h2>Nouvelle intervention</h2>
            <p className="muted-small">
              Planifier une visite en quelques champs.
            </p>
          </div>
          <button
            className="modal-close modal-close--inline"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            X
          </button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <label>Client</label>
          <select
            value={form.client_id}
            onChange={(e) => setValue("client_id", e.target.value)}
            required
          >
            <option value="">Selectionner</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="technician-picker">
            {getTechnicianRows(form.technician_ids, techs).map((selectedId, index) => {
              const selectedIds = normalizeTechnicianIdList(form.technician_ids);
              return (
                <label key={`${index}-${selectedId || "new"}`}>
                  {index === 0
                    ? "Technicien principal"
                    : selectedId
                      ? `Technicien ${index + 1}`
                      : "Ajouter un technicien"}
                  <select
                    value={selectedId}
                    onChange={(e) => setTechnicianAt(index, e.target.value)}
                  >
                    <option value="">Affecter plus tard</option>
                    {techs
                      .filter(
                        (t) =>
                          String(t.id) === selectedId ||
                          !selectedIds.includes(String(t.id))
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
          </div>

          <label>Date</label>
          <input
            type="date"
            value={form.scheduled_date}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
          />

          <label>Creneau</label>
          <div className="time-mode-grid" aria-label="Choix du creneau">
            {Object.entries(TIME_MODES).map(([value, mode]) => (
              <button
                key={value}
                type="button"
                className={form.time_mode === value ? "time-mode--active" : ""}
                onClick={() => setValue("time_mode", value)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {form.time_mode === "multi_day" && (
            <>
              <label>Date de fin</label>
              <input
                type="date"
                min={form.scheduled_date}
                value={form.scheduled_end_date}
                onChange={(e) => setValue("scheduled_end_date", e.target.value)}
                required
              />
              <p className="muted-small">
                L'intervention commence a 07:00 le premier jour et finit a 18:00 le dernier jour.
              </p>
            </>
          )}

          {form.time_mode === "custom" && (
            <>
              <label>Heure souhaitee</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={(e) => setValue("scheduled_time", e.target.value)}
                required
              />

              <label>Duree (minutes)</label>
              <div className="duration-presets" aria-label="Durees rapides">
                {[30, 60, 90, 120].map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    className={form.duration_minutes === duration ? "duration-preset--active" : ""}
                    onClick={() => setValue("duration_minutes", duration)}
                  >
                    {duration} min
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setValue("duration_minutes", Number(e.target.value))}
                min="15"
                step="15"
                inputMode="numeric"
                required
              />
            </>
          )}

          <label>Priorite</label>
          <select
            value={form.priority}
            onChange={(e) => setValue("priority", e.target.value)}
          >
            <option>Normale</option>
            <option>Urgente</option>
          </select>

          <label>Statut</label>
          <select
            value={form.status}
            onChange={(e) => setValue("status", e.target.value)}
          >
            <option>A FAIRE</option>
            <option>EN COURS</option>
            <option>TERMINE</option>
          </select>

          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setValue("description", e.target.value)}
            placeholder="Maintenance, panne, action a effectuer..."
            required
          />

          {canCreatePrivateIntervention && (
            <label className="maintenance-checkbox-row">
              <input
                type="checkbox"
                checked={form.private_to_me}
                onChange={(e) => setValue("private_to_me", e.target.checked)}
              />
              <span>Visible uniquement par moi</span>
            </label>
          )}

          <div className="modal-actions">
            <button className="btn new-intervention" type="submit">
              Creer
            </button>
            <button className="btn small ghost" onClick={onClose} type="button">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
