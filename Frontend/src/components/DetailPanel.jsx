import React, { useState } from "react";

const API_BASE = "http://localhost:4000";

export default function DetailPanel({ data, onAddNote, onUploadPhoto }) {
  const [note, setNote] = useState("");

  if (!data) {
    return (
      <aside className="detail-panel">
        <p className="muted">Sélectionne une intervention…</p>
      </aside>
    );
  }

  const { intervention, notes, photos } = data;

  const openGps = () => {
    if (!intervention.gps_lat || !intervention.gps_lng) return;
    const url = `https://www.google.com/maps?q=${intervention.gps_lat},${intervention.gps_lng}`;
    window.open(url, "_blank");
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

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <h3>{intervention.client_name}</h3>
        <p className="muted">
          {intervention.address}
          <br />
          {intervention.robot_model}
        </p>
        <button className="btn gps" onClick={openGps}>
          OUVRIR GPS
        </button>
      </div>

      <div className="detail-section">
        <h4>Intervention</h4>
        <p className="muted-small">
          {new Date(intervention.scheduled_at).toLocaleString("fr-FR")}
        </p>
        <p>{intervention.description}</p>
        <div className="badge-row">
          <span className="badge badge-status">{intervention.status}</span>
          <span className="badge badge-priority">{intervention.priority}</span>
        </div>
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
                src={`${API_BASE}/uploads/${p.filename}`}
                alt="intervention"
              />
            </div>
          ))}
          {!photos.length && (
            <p className="muted-small">Aucune photo pour l’instant</p>
          )}
        </div>
      </div>
    </aside>
  );
}
