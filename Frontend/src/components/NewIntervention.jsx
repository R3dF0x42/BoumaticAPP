import React, { useState, useEffect } from "react";
import { API_URL } from "../config/api.js";

const API = API_URL;

export default function NewIntervention({ onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [techs, setTechs] = useState([]);
  const [form, setForm] = useState({
    client_id: "",
    technician_id: "",
    scheduled_at: "",
    priority: "Normale",
    status: "A FAIRE",
    description: "",
    duration_minutes: 60
  });

  useEffect(() => {
    fetch(API + "/clients")
      .then((r) => r.json())
      .then(setClients);
    fetch(API + "/technicians")
      .then((r) => r.json())
      .then(setTechs);
  }, []);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const payload = {
      client_id: Number(form.client_id),
      technician_id: Number(form.technician_id),
      scheduled_at: form.scheduled_at.replace("T", " ") + ":00",
      priority: form.priority,
      status: form.status,
      description: form.description,
      duration_minutes: form.duration_minutes || 60
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
    <div className="modal">
      <div className="modal-box">
        <h2>Nouvelle intervention</h2>

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
            required
          >
            <option value="">Selectionner</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label>Date & Heure</label>
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setValue("scheduled_at", e.target.value)}
            required
          />

          <label>Duree (minutes)</label>
          <input
            type="number"
            value={form.duration_minutes}
            onChange={(e) => setValue("duration_minutes", Number(e.target.value))}
            min="15"
            step="15"
            inputMode="numeric"
            required
          />

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
