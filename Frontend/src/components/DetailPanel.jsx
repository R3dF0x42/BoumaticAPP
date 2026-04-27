import React, { useEffect, useState } from "react";
import { getApiOrigin } from "../config/api.js";
import MapAppChooserModal from "./MapAppChooserModal.jsx";
import { buildMapAppLinks, isMobileDevice } from "../utils/maps.js";

export default function DetailPanel({
  apiUrl,
  data,
  onAddNote,
  onUploadPhoto,
  onDeletePhoto,
  onUpdateIntervention,
  updatingStatus
}) {
  const [note, setNote] = useState("");
  const [mapChooser, setMapChooser] = useState(null);
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    client_id: "",
    technician_id: "",
    scheduled_at: "",
    duration_minutes: 60,
    status: "A FAIRE",
    priority: "Normale",
    description: ""
  });
  const apiOrigin = (apiUrl || getApiOrigin()).replace(/\/api$/, "");

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/clients`)
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]));
    fetch(`${apiUrl}/technicians`)
      .then((r) => r.json())
      .then((data) => setTechnicians(Array.isArray(data) ? data : []))
      .catch(() => setTechnicians([]));
  }, [apiUrl]);

  useEffect(() => {
    const intervention = data?.intervention;
    if (!intervention) return;
    setEditForm({
      client_id: intervention.client_id || "",
      technician_id: intervention.technician_id || "",
      scheduled_at: intervention.scheduled_at?.slice(0, 16) || "",
      duration_minutes: intervention.duration_minutes || 60,
      status: intervention.status || "A FAIRE",
      priority: intervention.priority || "Normale",
      description: intervention.description || ""
    });
  }, [data?.intervention]);

  if (!data) {
    return (
      <aside className="detail-panel">
        <p className="muted">Sélectionne une intervention…</p>
      </aside>
    );
  }

  const { intervention, notes, photos } = data;
  const mapLinks = buildMapAppLinks({
    lat: intervention.gps_lat ?? null,
    lng: intervention.gps_lng ?? null,
    address: intervention.address || ""
  });

  const openGps = () => {
    if (!mapLinks) return;

    if (isMobileDevice()) {
      setMapChooser({
        title: intervention.client_name || "",
        links: mapLinks
      });
      return;
    }

    window.open(mapLinks.google, "_blank", "noopener,noreferrer");
  };

  const handleSubmitNote = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(note);
    setNote("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onUploadPhoto(file);
    e.target.value = "";
  };

  const setEditValue = (field, value) => {
    setEditForm((form) => ({ ...form, [field]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    await onUpdateIntervention?.({
      client_id: Number(editForm.client_id),
      technician_id: editForm.technician_id ? Number(editForm.technician_id) : null,
      scheduled_at: editForm.scheduled_at.replace("T", " ") + ":00",
      duration_minutes: Number(editForm.duration_minutes) || 60,
      status: editForm.status,
      priority: editForm.priority,
      description: editForm.description
    });
    setIsEditing(false);
  };

  return (
    <>
    <aside className="detail-panel">
      <div className="detail-header">
        <h3>{intervention.client_name}</h3>
        <p className="muted">
          {intervention.address}
          <br />
          {intervention.robot_model}
        </p>
        <button className="btn gps" onClick={openGps} disabled={!mapLinks}>
          OUVRIR GPS
        </button>
      </div>

      <div className="detail-section">
        <h4>Intervention</h4>
        {isEditing ? (
          <form className="intervention-edit-form" onSubmit={handleSaveEdit}>
            <label>Client</label>
            <select
              value={editForm.client_id}
              onChange={(e) => setEditValue("client_id", e.target.value)}
              required
            >
              <option value="">Selectionner</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <label>Technicien</label>
            <select
              value={editForm.technician_id}
              onChange={(e) => setEditValue("technician_id", e.target.value)}
            >
              <option value="">Non assigne</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>

            <label>Date et heure</label>
            <input
              type="datetime-local"
              value={editForm.scheduled_at}
              onChange={(e) => setEditValue("scheduled_at", e.target.value)}
              required
            />

            <label>Duree de l'intervention (minutes)</label>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              inputMode="numeric"
              value={editForm.duration_minutes}
              onChange={(e) => setEditValue("duration_minutes", Number(e.target.value))}
              required
            />

            <label>Statut</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditValue("status", e.target.value)}
            >
              <option>A FAIRE</option>
              <option>EN COURS</option>
              <option>TERMINE</option>
            </select>

            <label>Priorite</label>
            <select
              value={editForm.priority}
              onChange={(e) => setEditValue("priority", e.target.value)}
            >
              <option>Normale</option>
              <option>Urgente</option>
            </select>

            <label>Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditValue("description", e.target.value)}
              required
            />

            <div className="intervention-edit-actions">
              <button className="btn small" type="submit" disabled={updatingStatus}>
                {updatingStatus ? "Sauvegarde..." : "Sauvegarder"}
              </button>
              <button
                className="btn small ghost"
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={updatingStatus}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="muted-small">
              {new Date(intervention.scheduled_at).toLocaleString("fr-FR")}
              {intervention.duration_minutes
                ? ` - ${intervention.duration_minutes} min`
                : ""}
            </p>
            <p>{intervention.description}</p>
            <div className="badge-row">
              <span className="badge badge-status">{intervention.status}</span>
              <span className="badge badge-priority">{intervention.priority}</span>
            </div>
            <div className="intervention-edit-actions">
              <button
                className="btn small ghost"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Modifier intervention
              </button>
              {intervention.status !== "TERMINE" && onUpdateIntervention && (
                <button
                  className="btn small"
                  type="button"
                  onClick={() => onUpdateIntervention({ status: "TERMINE" })}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Mise a jour..." : "Marquer comme termine"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="detail-section">
        <h4>Notes internes</h4>
        <form onSubmit={handleSubmitNote} className="note-form">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ajouter une note…"
          />
          <button className="btn small" type="submit">
            Enregistrer
          </button>
        </form>
        <ul className="notes-list">
          {notes.map((n) => (
            <li key={n.id}>
              <div className="note-meta">
                <span className="muted-small">{n.author || "Tech"}</span>
                <span className="muted-small">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              <div>{n.content}</div>
            </li>
          ))}
          {!notes.length && (
            <li className="muted-small">Aucune note pour l’instant</li>
          )}
        </ul>
      </div>

      <div className="detail-section">
        <h4>Photos</h4>
        <label className="btn small">
          + Ajouter une photo
          <input
            type="file"
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="photo-item">
              <img
                src={`${apiOrigin}/uploads/${p.filename}`}
                alt="intervention"
              />
              <button
                className="photo-delete-btn"
                type="button"
                onClick={() => onDeletePhoto?.(p.id)}
              >
                Supprimer
              </button>
            </div>
          ))}
          {!photos.length && (
            <p className="muted-small">Aucune photo pour l’instant</p>
          )}
        </div>
      </div>
    </aside>
    <MapAppChooserModal
      open={Boolean(mapChooser)}
      title={mapChooser?.title}
      links={mapChooser?.links}
      onClose={() => setMapChooser(null)}
    />
    </>
  );
}
