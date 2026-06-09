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
  custom: { label: "Heure precise", start: getDefaultTime(), duration: 60 }
};

export default function NewIntervention({ loggedUser, onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [techs, setTechs] = useState([]);
  const canCreatePrivateIntervention = loggedUser?.role === "technician" && loggedUser?.id;
  const defaultTechnicianId = canCreatePrivateIntervention ? String(loggedUser.id) : "";
  const [form, setForm] = useState({
    client_id: "",
    technician_id: defaultTechnicianId,
    scheduled_date: getDefaultDate(),
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
      current.technician_id ? current : { ...current, technician_id: defaultTechnicianId }
    );
  }, [defaultTechnicianId]);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const mode = TIME_MODES[form.time_mode] || TIME_MODES.custom;
    const startTime = form.time_mode === "custom" ? form.scheduled_time : mode.start;
    const duration = form.time_mode === "custom" ? form.duration_minutes || 60 : mode.duration;

    const payload = {
      client_id: Number(form.client_id),
      technician_id: form.technician_id ? Number(form.technician_id) : null,
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

          <label>Technicien</label>
          <select
            value={form.technician_id}
            onChange={(e) => setValue("technician_id", e.target.value)}
          >
            <option value="">Affecter plus tard</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label>Date</label>
          <input
            type="date"
            value={form.scheduled_date}
            onChange={(e) => setValue("scheduled_date", e.target.value)}
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
