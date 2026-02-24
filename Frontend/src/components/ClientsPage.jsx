import React, { useEffect, useMemo, useState } from "react";

export default function ClientsPage({ apiUrl }) {
  const [clients, setClients] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [clientPhotos, setClientPhotos] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [techFilter, setTechFilter] = useState("all");
  const [mode, setMode] = useState("list"); // list | detail
  const [showNewForm, setShowNewForm] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    gps_lat: "",
    gps_lng: "",
    phone: "",
    robot_model: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    gps_lat: "",
    gps_lng: "",
    phone: "",
    robot_model: ""
  });
  const apiOrigin = apiUrl.replace(/\/api$/, "");

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

  const submit = async (e) => {
    e.preventDefault();
    setClientError("");
    setClientInfo("");

    const res = await fetch(`${apiUrl}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
        gps_lng: form.gps_lng ? Number(form.gps_lng) : null
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
      gps_lat: "",
      gps_lng: "",
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

  useEffect(() => {
    if (!selectedClient) return;
    setEditForm({
      name: selectedClient.name || "",
      address: selectedClient.address || "",
      gps_lat: selectedClient.gps_lat ?? "",
      gps_lng: selectedClient.gps_lng ?? "",
      phone: selectedClient.phone || "",
      robot_model: selectedClient.robot_model || ""
    });
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadClientPhotos(selectedClientId);
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
        ...editForm,
        gps_lat: editForm.gps_lat ? Number(editForm.gps_lat) : null,
        gps_lng: editForm.gps_lng ? Number(editForm.gps_lng) : null
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

  if (mode === "detail" && selectedClient) {
    const mapLink =
      selectedClient.gps_lat && selectedClient.gps_lng
        ? `https://www.google.com/maps?q=${selectedClient.gps_lat},${selectedClient.gps_lng}`
        : null;
    const initials = getInitials(selectedClient.name);

    return (
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
                {mapLink && <span className="pill pill-muted">GPS ok</span>}
              </div>
            </div>
            <div className="client-actions">
              {selectedClient.phone && (
                <a className="btn small" href={`tel:${selectedClient.phone}`}>
                  Appeler
                </a>
              )}
              {mapLink && (
                <a className="btn small ghost" href={mapLink} target="_blank" rel="noreferrer">
                  Ouvrir carte
                </a>
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
              <div className="client-field">
                <label>GPS latitude</label>
                <input
                  value={editForm.gps_lat}
                  onChange={(e) => setEditValue("gps_lat", e.target.value)}
                  placeholder="45.1234"
                />
              </div>
              <div className="client-field">
                <label>GPS longitude</label>
                <input
                  value={editForm.gps_lng}
                  onChange={(e) => setEditValue("gps_lng", e.target.value)}
                  placeholder="4.5678"
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
                <label>GPS</label>
                <p className="muted-small">
                  {mapLink ? (
                    <>
                      {selectedClient.gps_lat}, {selectedClient.gps_lng}{" "}
                      <a className="muted-small" href={mapLink} target="_blank" rel="noreferrer">
                        Ouvrir carte
                      </a>
                    </>
                  ) : (
                    "Non renseigne"
                  )}
                </p>
              </div>
            </div>
          )}
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
                </div>
              ))}
              {!clientPhotos.length && (
                <p className="muted-small">Aucune photo pour ce client.</p>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Clients</h2>
          <p className="muted-small">Liste cliquable + fiche detail</p>
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

              <label>GPS latitude</label>
              <input
                value={form.gps_lat}
                onChange={(e) => setValue("gps_lat", e.target.value)}
                placeholder="45.1234"
              />

              <label>GPS longitude</label>
              <input
                value={form.gps_lng}
                onChange={(e) => setValue("gps_lng", e.target.value)}
                placeholder="4.5678"
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
          <div className="table">
            {clients.map((c) => (
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
                  <div className="muted-small">
                    {c.gps_lat && c.gps_lng
                      ? `${c.gps_lat.toFixed?.(4) ?? c.gps_lat}, ${
                          c.gps_lng.toFixed?.(4) ?? c.gps_lng
                        }`
                      : "GPS ?"}
                  </div>
                  {c.phone && (
                    <a className="muted-small" href={`tel:${c.phone}`}>
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
            {!clients.length && (
              <div className="muted-small">Aucun client enregistre</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
