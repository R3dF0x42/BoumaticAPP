import React, { useEffect, useId, useState } from "react";
import { getApiOrigin } from "../config/api.js";
import MapAppChooserModal from "./MapAppChooserModal.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import { buildMapAppLinks, isMobileDevice } from "../utils/maps.js";
import { buildUploadUrl } from "../utils/images.js";
import { formatMaintenanceKitLabel } from "../utils/maintenance.js";

function normalizeTechnicianIdList(values) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || "");
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function getInterventionTechnicianIds(intervention) {
  const ids = normalizeTechnicianIdList(intervention?.technician_ids);
  if (ids.length) return ids;
  return intervention?.technician_id ? [String(intervention.technician_id)] : [];
}

function getTechnicianRows(selectedIds, technicians) {
  const rows = normalizeTechnicianIdList(selectedIds);
  if (rows.length < technicians.length) return [...rows, ""];
  return rows.length ? rows : [""];
}

function getTechnicianLabel(intervention) {
  if (Array.isArray(intervention?.technician_names) && intervention.technician_names.length) {
    return intervention.technician_names.join(", ");
  }
  return intervention?.technician_name || "Technicien non assigne";
}

export default function DetailPanel({
  apiUrl,
  data,
  onAddNote,
  onUploadPhoto,
  onDeletePhoto,
  onUpdateIntervention,
  onDeleteIntervention,
  updatingStatus
}) {
  const [note, setNote] = useState("");
  const [mapChooser, setMapChooser] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const photoInputId = useId();
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    client_id: "",
    technician_ids: [],
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
      technician_ids: getInterventionTechnicianIds(intervention),
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
  const maintenanceKitLabel = formatMaintenanceKitLabel(intervention);
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

  const setEditTechnicianAt = (index, value) => {
    setEditForm((form) => {
      const nextIds = normalizeTechnicianIdList(form.technician_ids);
      if (value) {
        nextIds[index] = value;
      } else if (index < nextIds.length) {
        nextIds.splice(index, 1);
      }
      return { ...form, technician_ids: normalizeTechnicianIdList(nextIds) };
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const technicianIds = normalizeTechnicianIdList(editForm.technician_ids).map(Number);
    await onUpdateIntervention?.({
      client_id: Number(editForm.client_id),
      technician_id: technicianIds[0] || null,
      technician_ids: technicianIds,
      scheduled_at: editForm.scheduled_at.replace("T", " ") + ":00",
      duration_minutes: Number(editForm.duration_minutes) || 60,
      status: editForm.status,
      priority: editForm.priority,
      description: editForm.description
    });
    setIsEditing(false);
  };

  const handleQuickTechnicianChange = (index, value) => {
    const nextIds = getInterventionTechnicianIds(intervention);
    if (value) {
      nextIds[index] = value;
    } else if (index < nextIds.length) {
      nextIds.splice(index, 1);
    }
    const technicianIds = normalizeTechnicianIdList(nextIds).map(Number);
    onUpdateIntervention?.({
      technician_id: technicianIds[0] || null,
      technician_ids: technicianIds
    });
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

            <div className="technician-picker">
              {getTechnicianRows(editForm.technician_ids, technicians).map((selectedId, index) => {
                const selectedIds = normalizeTechnicianIdList(editForm.technician_ids);
                return (
                  <label key={`${index}-${selectedId || "new"}`}>
                    {index === 0
                      ? "Technicien principal"
                      : selectedId
                        ? `Technicien ${index + 1}`
                        : "Ajouter un technicien"}
                    <select
                      value={selectedId}
                      onChange={(e) => setEditTechnicianAt(index, e.target.value)}
                    >
                      <option value="">Non assigne</option>
                      {technicians
                        .filter(
                          (tech) =>
                            String(tech.id) === selectedId ||
                            !selectedIds.includes(String(tech.id))
                        )
                        .map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.name}
                          </option>
                        ))}
                    </select>
                  </label>
                );
              })}
            </div>

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
              max="660"
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
              <option>PRET</option>
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
                ? ` - ${
                    intervention.duration_minutes >= 660
                      ? "journee entiere"
                      : `${intervention.duration_minutes} min`
                  }`
                : ""}
            </p>
            {maintenanceKitLabel && <p className="muted-small">{maintenanceKitLabel}</p>}
            <p>{intervention.description}</p>
            <div className="badge-row">
              <span className="badge badge-status">{intervention.status}</span>
              <span className="badge badge-priority">{intervention.priority}</span>
            </div>
            <div className="quick-tech-row">
              <label>Affectation</label>
              <p className="muted-small">{getTechnicianLabel(intervention)}</p>
              <div className="technician-picker technician-picker--compact">
                {getTechnicianRows(getInterventionTechnicianIds(intervention), technicians).map(
                  (selectedId, index) => {
                    const selectedIds = getInterventionTechnicianIds(intervention);
                    return (
                      <label key={`${index}-${selectedId || "new"}`}>
                        {index === 0
                          ? "Principal"
                          : selectedId
                            ? `Tech ${index + 1}`
                            : "Ajouter"}
                        <select
                          value={selectedId}
                          onChange={(e) => handleQuickTechnicianChange(index, e.target.value)}
                          disabled={updatingStatus}
                        >
                          <option value="">Non assigne</option>
                          {technicians
                            .filter(
                              (tech) =>
                                String(tech.id) === selectedId ||
                                !selectedIds.includes(String(tech.id))
                            )
                            .map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    );
                  }
                )}
              </div>
            </div>
            <div className="intervention-edit-actions">
              <button
                className="btn small ghost"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Modifier intervention
              </button>
              {intervention.status === "TERMINE" && onUpdateIntervention ? (
                <button
                  className="btn small ghost"
                  type="button"
                  onClick={() => onUpdateIntervention({ status: "A FAIRE" })}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Mise a jour..." : "Repasser a faire"}
                </button>
              ) : onUpdateIntervention && (
                <button
                  className="btn small"
                  type="button"
                  onClick={() => onUpdateIntervention({ status: "TERMINE" })}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Mise a jour..." : "Marquer comme termine"}
                </button>
              )}
              {onDeleteIntervention && (
                <button
                  className="btn small danger"
                  type="button"
                  onClick={onDeleteIntervention}
                >
                  Supprimer
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
        <label className="btn small file-picker-btn" htmlFor={photoInputId}>
          <span>+ Ajouter une photo</span>
          <input
            id={photoInputId}
            name="photo"
            type="file"
            className="file-input-overlay"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        <div className="photo-grid">
          {photos.map((p) => {
            const photoSrc = buildUploadUrl(apiOrigin, p.url || p.filename);
            return (
            <div key={p.id} className="photo-item">
              <button
                className="photo-preview-btn"
                type="button"
                onClick={() => setSelectedPhoto({ src: photoSrc, alt: "Photo intervention" })}
                aria-label="Agrandir la photo"
              >
                <img
                  src={photoSrc}
                  alt="intervention"
                />
              </button>
              <button
                className="photo-delete-btn"
                type="button"
                onClick={() => onDeletePhoto?.(p.id)}
              >
                Supprimer
              </button>
            </div>
            );
          })}
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
    <PhotoLightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </>
  );
}
