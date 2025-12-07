import React, { useState, useEffect } from "react";

const API_URL = "https://boumaticapp-production.up.railway.app/api";

export default function NewIntervention({ onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [techs, setTechs] = useState([]);
  const [form, setForm] = useState({
    client_id: "",
    technician_id: "",
    scheduled_at: "",
    priority: "Normale",
    status: "À FAIRE",
    description: ""
  });

  useEffect(() => {
    fetch(API + "/clients").then(r => r.json()).then(setClients);
    fetch(API + "/technicians").then(r => r.json()).then(setTechs);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(API + "/interventions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      scheduled_at: form.scheduled_at.replace("T", " ")
    });

    if (res.ok) {
      onCreated();
      onClose();
    }
  };

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <div className="modal">
      <div className="modal-box">
        <h2>Nouvelle intervention</h2>

        <form onSubmit={submit}>

          <label>Client</label>
          <select value={form.client_id} onChange={(e) => setValue("client_id", e.target.value)} required>
            <option value="">Sélectionner</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label>Technicien</label>
          <select value={form.technician_id} onChange={(e) => setValue("technician_id", e.target.value)} required>
            <option value="">Sélectionner</option>
            {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <label>Date & Heure</label>
          <input type="datetime-local" value={form.scheduled_at}
                 onChange={(e) => setValue("scheduled_at", e.target.value)} required />

          <label>Priorité</label>
          <select value={form.priority} onChange={(e) => setValue("priority", e.target.value)}>
            <option>Normale</option>
            <option>Urgente</option>
          </select>

          <label>Statut</label>
          <select value={form.status} onChange={(e) => setValue("status", e.target.value)}>
            <option>À FAIRE</option>
            <option>EN COURS</option>
            <option>TERMINÉE</option>
          </select>

          <label>Description</label>
          <textarea value={form.description}
                    onChange={(e) => setValue("description", e.target.value)}
                    placeholder="Maintenance, panne, action à effectuer..."
                    required />

          <button className="btn new-intervention" type="submit">Créer</button>
        </form>

        <button className="btn small" onClick={onClose} style={{ marginTop: 10 }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
