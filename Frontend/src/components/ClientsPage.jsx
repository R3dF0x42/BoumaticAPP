import React, { useEffect, useMemo, useState } from "react";
import MapAppChooserModal from "./MapAppChooserModal.jsx";
import { buildMapAppLinks, isMobileDevice } from "../utils/maps.js";

function getDefaultMaintenanceDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getDefaultContractEndDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 2);
  return date.toISOString().slice(0, 10);
}

export default function ClientsPage({ apiUrl }) {
  const [clients, setClients] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [clientPhotos, setClientPhotos] = useState([]);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [creatingMaintenance, setCreatingMaintenance] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [techFilter, setTechFilter] = useState("all");
  const [mode, setMode] = useState("list"); // list | detail
  const [showNewForm, setShowNewForm] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [mapChooser, setMapChooser] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    robot_model: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    robot_model: ""
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    technician_id: "",
    start_at: getDefaultMaintenanceDateTime(),
    frequency_months: 6,
    end_at: getDefaultContractEndDate(),
    duration_minutes: 90,
    priority: "Normale",
    description: "Maintenance contrat"
  });
  const apiOrigin = apiUrl.replace(/\/api$/, "");

  const getClientMapTarget = (client) => {
    if (!client) return null;
    if (client.gps_lat != null && client.gps_lng != null) {
      return {
        lat: client.gps_lat,
        lng: client.gps_lng,
        address: client.address || ""
      };
    }
    if (client.address) {
      return {
        lat: null,
        lng: null,
        address: client.address
      };
    }
    return null;
  };

  const handleOpenMap = (target, title = "") => {
    if (!target) return;
    const links = buildMapAppLinks(target);
    if (!links) return;

    if (isMobileDevice()) {
      setMapChooser({ title, links });
      return;
    }

    window.open(links.google, "_blank", "noopener,noreferrer");
  };

  const loadClients = async () => {
    const res = await fetch(`${apiUrl}/clients`);
    setClients(await res.json());
  };

  const loadInterventions = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${apiUrl}/interventions`);
      setInterventions(await res.json());
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadTechnicians = async () => {
    const res = await fetch(`${apiUrl}/technicians`);
    setTechnicians(await res.json());
  };

  const loadClientPhotos = async (clientId) => {
    if (!clientId) {
      setClientPhotos([]);
      return;
    }

    setLoadingPhotos(true);
    try {
      const res = await fetch(`${apiUrl}/clients/${clientId}/photos`);
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setClientPhotos([]);
        setClientError(data.error || "Impossible de charger les photos client.");
        return;
      }

      setClientPhotos(Array.isArray(data) ? data : []);
    } catch {
      setClientPhotos([]);
      setClientError("Impossible de charger les photos client.");
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadMaintenancePlans = async (clientId) => {
    if (!clientId) {
      setMaintenancePlans([]);
      return;
    }

    setLoadingMaintenance(true);
    try {
      const res = await fetch(`${apiUrl}/clients/${clientId}/maintenance-plans`);
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setMaintenancePlans([]);
        setClientError(data.error || "Impossible de charger les maintenances.");
        return;
      }

      setMaintenancePlans(Array.isArray(data) ? data : []);
    } catch {
      setMaintenancePlans([]);
      setClientError("Impossible de charger les maintenances.");
    } finally {
      setLoadingMaintenance(false);
    }
  };

  useEffect(() => {
    loadClients();
    loadInterventions();
    loadTechnicians();
  }, []);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const setEditValue = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
  };

  const setMaintenanceValue = (field, value) => {
    setMaintenanceForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setClientError("");
    setClientInfo("");

    const res = await fetch(`${apiUrl}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setClientError(data.error || "Impossible de creer le client.");
      return;
    }

    setForm({
      name: "",
      address: "",
      phone: "",
      robot_model: ""
    });
    setClientInfo("Client cree.");
    loadClients();
    setShowNewForm(false);
  };

  useEffect(() => {
    if (clients.length && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      `${client.name || ""} ${client.address || ""} ${client.phone || ""} ${
        client.robot_model || ""
      }`
        .toLowerCase()
        .includes(term)
    );
  }, [clientSearch, clients]);

  useEffect(() => {
    if (!selectedClient) return;
    setEditForm({
      name: selectedClient.name || "",
      address: selectedClient.address || "",
      phone: selectedClient.phone || "",
      robot_model: selectedClient.robot_model || ""
    });
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadClientPhotos(selectedClientId);
    loadMaintenancePlans(selectedClientId);
  }, [selectedClientId]);

  const historyForClient = useMemo(() => {
    if (!selectedClientId) return [];
    return [...interventions]
      .filter((i) => i.client_id === selectedClientId)
      .sort(
        (a, b) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
  }, [interventions, selectedClientId]);

  const filteredHistory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return historyForClient.filter((h) => {
      const matchTech =
        techFilter === "all" || Number(techFilter) === h.technician_id;
      const matchTerm =
        !term ||
        `${h.description || ""} ${h.status || ""} ${h.priority || ""} ${
          h.technician_name || ""
        }`
          .toLowerCase()
          .includes(term);
      return matchTech && matchTerm;
    });
  }, [historyForClient, searchTerm, techFilter]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const submitClientUpdate = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    setClientError("");
    setClientInfo("");

    const res = await fetch(`${apiUrl}/clients/${selectedClient.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setClientError(data.error || "Impossible de modifier le client.");
      return;
    }

    setIsEditingClient(false);
    setClientInfo("Client mis a jour.");
    loadClients();
  };

  const handleSelectClient = (id) => {
    setSelectedClientId(id);
    setMode("detail");
    setIsEditingClient(false);
    setClientError("");
    setClientInfo("");
  };

  const handleUploadClientPhoto = async (file) => {
    if (!file || !selectedClient?.id) return;

    setClientError("");
    setClientInfo("");
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch(`${apiUrl}/clients/${selectedClient.id}/photos`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data.error || "Impossible d'ajouter la photo client.");
        return;
      }

      setClientInfo("Photo client ajoutee.");
      await loadClientPhotos(selectedClient.id);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteClientPhoto = async (photoId) => {
    if (!selectedClient?.id || !photoId) return;

    const confirmed = window.confirm("Confirmer la suppression de cette photo ?");
    if (!confirmed) return;

    setClientError("");
    setClientInfo("");
    setDeletingPhotoId(photoId);

    try {
      const res = await fetch(
        `${apiUrl}/clients/${selectedClient.id}/photos/${photoId}`,
        {
          method: "DELETE"
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data.error || "Impossible de supprimer la photo client.");
        return;
      }

      setClientInfo("Photo client supprimee.");
      await loadClientPhotos(selectedClient.id);
    } catch {
      setClientError("Impossible de supprimer la photo client.");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const submitMaintenancePlan = async (e) => {
    e.preventDefault();
    if (!selectedClient?.id) return;

    setClientError("");
    setClientInfo("");
    setCreatingMaintenance(true);

    try {
      const res = await fetch(`${apiUrl}/clients/${selectedClient.id}/maintenance-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...maintenanceForm,
          technician_id: maintenanceForm.technician_id
            ? Number(maintenanceForm.technician_id)
            : null,
          frequency_months: Number(maintenanceForm.frequency_months),
          duration_minutes: Number(maintenanceForm.duration_minutes)
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de programmer la maintenance.");
        return;
      }

      setClientInfo(`${data.count || 0} intervention(s) de maintenance creee(s).`);
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions();
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch {
      setClientError("Impossible de programmer la maintenance.");
    } finally {
      setCreatingMaintenance(false);
    }
  };

  const renderHistory = () => {
    if (!selectedClientId) {
      return <div className="muted-small">Selectionnez un client.</div>;
    }
    if (loadingHistory) {
      return <div className="muted-small">Chargement...</div>;
    }
    if (!filteredHistory.length) {
      return (
        <div className="muted-small">
          Aucune intervention enregistree pour ce client avec ces filtres.
        </div>
      );
    }
    return (
      <div className="history-list">
        {filteredHistory.map((inter) => (
          <div key={inter.id} className="history-item">
            <div className="history-title">
              <strong>{formatDate(inter.scheduled_at)}</strong>
              <span
                className={`badge badge-${inter.status?.toLowerCase?.() || "default"}`}
              >
                {inter.status || "Statut ?"}
              </span>
            </div>
            <div className="history-meta">
              <span>{inter.technician_name || "Technicien inconnu"}</span>
              {inter.priority && <span>Priorite : {inter.priority}</span>}
              {inter.duration_minutes && (
                <span>Duree : {inter.duration_minutes} min</span>
              )}
            </div>
            {inter.description && (
              <div className="history-description muted-small">
                {inter.description}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderHistoryFilters = () => (
    <div className="history-filters">
      <input
        type="text"
        placeholder="Recherche libre (description, statut, technicien)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
        <option value="all">Tous les techniciens</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderMaintenancePlans = () => {
    if (loadingMaintenance) {
      return <p className="muted-small">Chargement des contrats...</p>;
    }

    if (!maintenancePlans.length) {
      return <p className="muted-small">Aucun contrat de maintenance programme.</p>;
    }

    return (
      <div className="maintenance-plan-list">
        {maintenancePlans.map((plan) => (
          <div key={plan.id} className="maintenance-plan-item">
            <div>
              <strong>Tous les {plan.frequency_months} mois</strong>
              <p className="muted-small">
                {plan.generated_count} intervention(s) creee(s)
                {plan.next_scheduled_at
                  ? ` - Prochaine: ${formatDate(plan.next_scheduled_at)}`
                  : ""}
              </p>
              <p className="muted-small">
                Fin contrat: {plan.end_at ? formatDate(plan.end_at) : "Non renseignee"} - {plan.duration_minutes} min chacune
              </p>
            </div>
            <span className="pill pill-muted">
              {plan.technician_name || "Technicien libre"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (mode === "detail" && selectedClient) {
    const mapTarget = getClientMapTarget(selectedClient);
    const hasMapTarget = Boolean(mapTarget);
    const initials = getInitials(selectedClient.name);

    return (
      <>
      <section className="page">
        <div className="page-header">
          <div>
            <h2>{selectedClient.name}</h2>
            <p className="muted-small">Fiche client et interventions</p>
          </div>
          <div className="client-actions">
            <button
              className="btn small"
              onClick={() => {
                setIsEditingClient((v) => !v);
                setClientError("");
                setClientInfo("");
              }}
              type="button"
            >
              {isEditingClient ? "Annuler edition" : "Modifier client"}
            </button>
            <button className="btn small ghost" onClick={() => setMode("list")} type="button">
              {"<- Retour liste"}
            </button>
          </div>
        </div>

        {clientError && <p className="login-error">{clientError}</p>}
        {clientInfo && <p className="ok-message">{clientInfo}</p>}

        <div className="card">
          <div className="client-hero">
            <div className="client-avatar">{initials}</div>
            <div className="client-meta">
              <div className="client-meta-title">
                <strong>{selectedClient.name}</strong>
              </div>
              <div className="client-tags">
                {selectedClient.robot_model && (
                  <span className="pill">Robot : {selectedClient.robot_model}</span>
                )}
                {selectedClient.phone && (
                  <span className="pill pill-muted">{selectedClient.phone}</span>
                )}
                {hasMapTarget && <span className="pill pill-muted">GPS ok</span>}
              </div>
            </div>
            <div className="client-actions">
              {selectedClient.phone && (
                <a className="btn small" href={`tel:${selectedClient.phone}`}>
                  Appeler
                </a>
              )}
              {hasMapTarget && (
                <button
                  className="btn small ghost"
                  type="button"
                  onClick={() => handleOpenMap(mapTarget, selectedClient.name)}
                >
                  Ouvrir carte
                </button>
              )}
            </div>
          </div>

          {isEditingClient ? (
            <form className="client-detail-grid client-edit-grid" onSubmit={submitClientUpdate}>
              <div className="client-field">
                <label>Nom de la ferme</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditValue("name", e.target.value)}
                  required
                />
              </div>
              <div className="client-field">
                <label>Telephone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditValue("phone", e.target.value)}
                />
              </div>
              <div className="client-field">
                <label>Adresse</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditValue("address", e.target.value)}
                />
              </div>
              <div className="client-field">
                <label>Robot de traite</label>
                <input
                  value={editForm.robot_model}
                  onChange={(e) => setEditValue("robot_model", e.target.value)}
                />
              </div>
              <div className="client-edit-actions">
                <button className="btn small" type="submit">
                  Enregistrer modifications
                </button>
                <button
                  className="btn small ghost"
                  type="button"
                  onClick={() => setIsEditingClient(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <div className="client-detail-grid">
              <div className="client-field">
                <label>Adresse</label>
                <p className="muted-small">{selectedClient.address || "Non renseignee"}</p>
              </div>
              <div className="client-field">
                <label>Telephone</label>
                <p className="muted-small">
                  {selectedClient.phone ? (
                    <a href={`tel:${selectedClient.phone}`}>{selectedClient.phone}</a>
                  ) : (
                    "Non renseigne"
                  )}
                </p>
              </div>
              <div className="client-field">
                <label>Robot de traite</label>
                <p className="muted-small">{selectedClient.robot_model || "Non renseigne"}</p>
              </div>
              <div className="client-field">
                <label>Navigation GPS</label>
                <p className="muted-small">
                  {hasMapTarget ? (
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={() => handleOpenMap(mapTarget, selectedClient.name)}
                    >
                      Ouvrir carte
                    </button>
                  ) : (
                    "Adresse non renseignee"
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Contrat de maintenance</h3>
          <form className="maintenance-form" onSubmit={submitMaintenancePlan}>
            <label>Technicien</label>
            <select
              value={maintenanceForm.technician_id}
              onChange={(e) => setMaintenanceValue("technician_id", e.target.value)}
            >
              <option value="">Affecter plus tard</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <label>Premier passage</label>
            <input
              type="datetime-local"
              value={maintenanceForm.start_at}
              onChange={(e) => setMaintenanceValue("start_at", e.target.value)}
              required
            />

            <label>Frequence</label>
            <select
              value={maintenanceForm.frequency_months}
              onChange={(e) =>
                setMaintenanceValue("frequency_months", Number(e.target.value))
              }
            >
              <option value={3}>Tous les 3 mois</option>
              <option value={4}>Tous les 4 mois</option>
              <option value={6}>Tous les 6 mois</option>
            </select>

            <div className="maintenance-grid">
              <div>
                <label>Date de fin du contrat</label>
                <input
                  type="date"
                  value={maintenanceForm.end_at}
                  onChange={(e) =>
                    setMaintenanceValue("end_at", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <label>Duree de chaque intervention (minutes)</label>
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  inputMode="numeric"
                  value={maintenanceForm.duration_minutes}
                  onChange={(e) =>
                    setMaintenanceValue("duration_minutes", Number(e.target.value))
                  }
                  required
                />
              </div>
            </div>

            <label>Priorite</label>
            <select
              value={maintenanceForm.priority}
              onChange={(e) => setMaintenanceValue("priority", e.target.value)}
            >
              <option>Normale</option>
              <option>Urgente</option>
            </select>

            <label>Description</label>
            <textarea
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceValue("description", e.target.value)}
              required
            />
            <p className="muted-small">
              Une note sera ajoutee automatiquement dans chaque intervention :
              Maintenance Kit N°1 a N°6, puis retour au N°1.
            </p>

            <button className="btn small" type="submit" disabled={creatingMaintenance}>
              {creatingMaintenance ? "Creation..." : "Programmer les maintenances"}
            </button>
          </form>

          {renderMaintenancePlans()}
        </div>

        <div className="card">
          <h3>Historique des interventions</h3>
          {renderHistoryFilters()}
          {renderHistory()}
        </div>

        <div className="card">
          <h3>Photos du client</h3>
          <label className="btn small">
            {uploadingPhoto ? "Upload en cours..." : "+ Ajouter une photo"}
            <input
              type="file"
              style={{ display: "none" }}
              accept="image/*"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleUploadClientPhoto(file);
                e.target.value = "";
              }}
            />
          </label>

          {loadingPhotos ? (
            <p className="muted-small">Chargement des photos...</p>
          ) : (
            <div className="photo-grid">
              {clientPhotos.map((p) => (
                <div key={p.id} className="photo-item">
                  <img
                    src={
                      p.url
                        ? `${apiOrigin}${p.url}`
                        : `${apiOrigin}/uploads/${p.filename}`
                    }
                    alt="client"
                  />
                  <button
                    className="photo-delete-btn"
                    type="button"
                    onClick={() => handleDeleteClientPhoto(p.id)}
                    disabled={deletingPhotoId === p.id}
                  >
                    {deletingPhotoId === p.id ? "..." : "Supprimer"}
                  </button>
                </div>
              ))}
              {!clientPhotos.length && (
                <p className="muted-small">Aucune photo pour ce client.</p>
              )}
            </div>
          )}
        </div>
      </section>
      <MapAppChooserModal
        open={Boolean(mapChooser)}
        title={mapChooser?.title}
        links={mapChooser?.links}
        onClose={() => setMapChooser(null)}
      />
      </>
    );
  }

  return (
    <>
    <section className="page">
      <div className="page-header">
          <div>
            <h2>Clients</h2>
          <p className="muted-small">{clients.length} clients enregistres</p>
        </div>
        <button
          className="btn small"
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
        >
          {showNewForm ? "Fermer" : "Nouveau client"}
        </button>
      </div>

      {clientError && <p className="login-error">{clientError}</p>}
      {clientInfo && <p className="ok-message">{clientInfo}</p>}

      <div className="page-grid">
        {showNewForm && (
          <div className="card">
            <h3>Nouveau client</h3>
            <form className="form" onSubmit={submit}>
              <label>Nom de la ferme</label>
              <input
                value={form.name}
                onChange={(e) => setValue("name", e.target.value)}
                required
              />

              <label>Adresse</label>
              <textarea
                value={form.address}
                onChange={(e) => setValue("address", e.target.value)}
              />

              <label>Telephone</label>
              <input
                value={form.phone}
                onChange={(e) => setValue("phone", e.target.value)}
              />

              <label>Robot de traite</label>
              <input
                value={form.robot_model}
                onChange={(e) => setValue("robot_model", e.target.value)}
                placeholder="BouMatic, Lely, GEA..."
              />

              <button className="btn small" type="submit">
                Enregistrer
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Liste des clients</h3>
          <div className="mobile-search-row">
            <input
              type="search"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Rechercher ferme, ville, robot, telephone"
            />
          </div>
          <div className="table">
            {filteredClients.map((c) => {
              const mapTarget = getClientMapTarget(c);
              return (
              <div
                key={c.id}
                className={`table-row table-row--clickable ${
                  selectedClientId === c.id ? "table-row--active" : ""
                }`}
                onClick={() => handleSelectClient(c.id)}
              >
                <div className="table-main">
                  <strong>{c.name}</strong>
                  <div className="muted-small">{c.address}</div>
                  <div className="muted-small">
                    {c.robot_model && `Robot : ${c.robot_model}`}
                  </div>
                </div>
                <div className="table-side">
                  {mapTarget ? (
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMap(mapTarget, c.name);
                      }}
                    >
                      GPS
                    </button>
                  ) : (
                    <div className="muted-small">GPS ?</div>
                  )}
                  {c.phone && (
                    <a className="muted-small" href={`tel:${c.phone}`}>
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
              );
            })}
            {!filteredClients.length && (
              <div className="muted-small">Aucun client enregistre</div>
            )}
          </div>
        </div>
      </div>
    </section>
    <MapAppChooserModal
      open={Boolean(mapChooser)}
      title={mapChooser?.title}
      links={mapChooser?.links}
      onClose={() => setMapChooser(null)}
    />
    </>
  );
}
