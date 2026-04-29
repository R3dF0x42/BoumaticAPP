import React, { useEffect, useId, useMemo, useState } from "react";
import MapAppChooserModal from "./MapAppChooserModal.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import { buildMapAppLinks, isMobileDevice } from "../utils/maps.js";
import { buildUploadUrl, preparePhotoForUpload } from "../utils/images.js";

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

function toDateTimeInput(value) {
  if (!value) return getDefaultMaintenanceDateTime();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getDefaultMaintenanceDateTime();
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateInput(value) {
  if (!value) return getDefaultContractEndDate();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getDefaultContractEndDate();
  return date.toISOString().slice(0, 10);
}

const MAINTENANCE_KIT_MODELS = {
  gemini: {
    label: "Gemini",
    count: 8
  },
  gemini_up: {
    label: "Gemini UP",
    count: 6
  }
};

function getMaintenanceKitModelLabel(value) {
  const model = MAINTENANCE_KIT_MODELS[value] || MAINTENANCE_KIT_MODELS.gemini_up;
  return `${model.label} - ${model.count} kits`;
}

export default function ClientsPage({ apiUrl, onSelectIntervention }) {
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
  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [editingMaintenance, setEditingMaintenance] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [deletingClient, setDeletingClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [techFilter, setTechFilter] = useState("all");
  const [mode, setMode] = useState("list"); // list | detail
  const [showNewForm, setShowNewForm] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [mapChooser, setMapChooser] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const clientPhotoInputId = useId();
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    robot_model: "",
    commissioning_date: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    robot_model: "",
    commissioning_date: ""
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    technician_id: "",
    start_at: getDefaultMaintenanceDateTime(),
    frequency_months: 6,
    end_at: getDefaultContractEndDate(),
    maintenance_kit_model: "gemini_up",
    priority: "Normale",
    description: "Maintenance contrat"
  });
  const [maintenanceEditForm, setMaintenanceEditForm] = useState({
    technician_id: "",
    start_at: getDefaultMaintenanceDateTime(),
    frequency_months: 6,
    end_at: getDefaultContractEndDate(),
    maintenance_kit_model: "gemini_up",
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

  useEffect(() => {
    const refresh = () => {
      loadInterventions();
      if (selectedClientId) {
        loadMaintenancePlans(selectedClientId);
      }
    };

    window.addEventListener("refreshCalendar", refresh);
    return () => window.removeEventListener("refreshCalendar", refresh);
  }, [selectedClientId]);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const setEditValue = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
  };

  const setMaintenanceValue = (field, value) => {
    setMaintenanceForm((f) => ({ ...f, [field]: value }));
  };

  const setMaintenanceEditValue = (field, value) => {
    setMaintenanceEditForm((f) => ({ ...f, [field]: value }));
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
      robot_model: "",
      commissioning_date: ""
    });
    setClientInfo("Client cree.");
    loadClients();
    setShowNewForm(false);
  };

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId(null);
      return;
    }

    if (!selectedClientId || !clients.some((client) => client.id === selectedClientId)) {
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
      } ${client.commissioning_date || ""
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
      robot_model: selectedClient.robot_model || "",
      commissioning_date: selectedClient.commissioning_date?.slice(0, 10) || ""
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

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR");
  };

  const hasExactGps = (client) =>
    client?.gps_lat !== null &&
    client?.gps_lat !== undefined &&
    client?.gps_lng !== null &&
    client?.gps_lng !== undefined;

  const getClientInterventionCount = (clientId) =>
    interventions.filter((intervention) => intervention.client_id === clientId).length;

  const renderClientBadges = (client, { showMissingRobot = false } = {}) => {
    const badges = [];

    if (client.robot_model) {
      badges.push(
        <span key="robot" className="client-badge client-badge--robot">
          Robot {client.robot_model}
        </span>
      );
    } else if (showMissingRobot) {
      badges.push(
        <span key="robot" className="client-badge client-badge--muted">
          Robot non renseigne
        </span>
      );
    }

    if (client.commissioning_date) {
      badges.push(
        <span key="commissioning" className="client-badge client-badge--date">
          Mise en service {formatDateOnly(client.commissioning_date)}
        </span>
      );
    }

    if (hasExactGps(client)) {
      badges.push(
        <span key="gps" className="client-badge client-badge--gps">
          GPS exact
        </span>
      );
    } else if (client.address) {
      badges.push(
        <span key="address" className="client-badge client-badge--muted">
          Adresse
        </span>
      );
    }

    if (client.phone) {
      badges.push(
        <span key="phone" className="client-badge client-badge--phone">
          Tel {client.phone}
        </span>
      );
    }

    return badges;
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

  const handleDeleteClient = async () => {
    if (!selectedClient?.id || deletingClient) return;

    const confirmed = window.confirm(
      `Supprimer le client "${selectedClient.name}" et toutes ses interventions, contrats et photos ?`
    );
    if (!confirmed) return;

    setClientError("");
    setClientInfo("");
    setDeletingClient(true);

    try {
      const res = await fetch(`${apiUrl}/clients/${selectedClient.id}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de supprimer le client.");
        return;
      }

      setClientInfo("Client supprime.");
      setMode("list");
      setIsEditingClient(false);
      setClientPhotos([]);
      setMaintenancePlans([]);
      setSelectedClientId(null);
      await loadClients();
      await loadInterventions();
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch {
      setClientError("Impossible de supprimer le client.");
    } finally {
      setDeletingClient(false);
    }
  };

  const handleUploadClientPhoto = async (file) => {
    if (!file || !selectedClient?.id) return;

    setClientError("");
    setClientInfo("");
    setUploadingPhoto(true);

    try {
      const uploadFile = await preparePhotoForUpload(file);
      const formData = new FormData();
      formData.append("photo", uploadFile);

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
    } catch (err) {
      setClientError(
        `Impossible d'ajouter la photo client.${err?.message ? ` ${err.message}` : ""}`
      );
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

  const startEditMaintenance = (plan) => {
    setClientError("");
    setClientInfo("");
    setEditingMaintenanceId(plan.id);
    setMaintenanceEditForm({
      technician_id: plan.technician_id || "",
      start_at: toDateTimeInput(plan.start_at),
      frequency_months: plan.frequency_months || 6,
      end_at: toDateInput(plan.end_at),
      maintenance_kit_model: plan.maintenance_kit_model || "gemini_up",
      priority: plan.priority || "Normale",
      description: plan.description || "Maintenance contrat"
    });
  };

  const cancelEditMaintenance = () => {
    setEditingMaintenanceId(null);
    setEditingMaintenance(false);
  };

  const submitMaintenanceUpdate = async (e, planId) => {
    e.preventDefault();
    if (!selectedClient?.id) return;

    setClientError("");
    setClientInfo("");
    setEditingMaintenance(true);

    try {
      const res = await fetch(
        `${apiUrl}/clients/${selectedClient.id}/maintenance-plans/${planId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...maintenanceEditForm,
            technician_id: maintenanceEditForm.technician_id
              ? Number(maintenanceEditForm.technician_id)
              : null,
            frequency_months: Number(maintenanceEditForm.frequency_months)
          })
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de modifier le contrat.");
        return;
      }

      setClientInfo(`${data.count || 0} intervention(s) de maintenance mise(s) a jour.`);
      cancelEditMaintenance();
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions();
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch {
      setClientError("Impossible de modifier le contrat.");
    } finally {
      setEditingMaintenance(false);
    }
  };

  const deleteMaintenancePlan = async (planId) => {
    if (!selectedClient?.id) return;

    const confirmed = window.confirm(
      "Supprimer ce contrat et ses interventions non terminees ?"
    );
    if (!confirmed) return;

    setClientError("");
    setClientInfo("");

    try {
      const res = await fetch(
        `${apiUrl}/clients/${selectedClient.id}/maintenance-plans/${planId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de supprimer le contrat.");
        return;
      }

      setClientInfo("Contrat de maintenance supprime.");
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions();
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch {
      setClientError("Impossible de supprimer le contrat.");
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
          <button
            key={inter.id}
            className="history-item history-item--clickable"
            type="button"
            onClick={() => onSelectIntervention?.({ id: inter.id })}
          >
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
                <span>
                  Duree : {inter.duration_minutes >= 1440
                    ? "journee entiere"
                    : `${inter.duration_minutes} min`}
                </span>
              )}
            </div>
            {inter.description && (
              <div className="history-description muted-small">
                {inter.description}
              </div>
            )}
          </button>
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
            {editingMaintenanceId === plan.id ? (
              <form
                className="maintenance-form maintenance-form--edit"
                onSubmit={(e) => submitMaintenanceUpdate(e, plan.id)}
              >
                <label>Technicien</label>
                <select
                  value={maintenanceEditForm.technician_id}
                  onChange={(e) => setMaintenanceEditValue("technician_id", e.target.value)}
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
                  value={maintenanceEditForm.start_at}
                  onChange={(e) => setMaintenanceEditValue("start_at", e.target.value)}
                  required
                />

                <label>Frequence</label>
                <select
                  value={maintenanceEditForm.frequency_months}
                  onChange={(e) =>
                    setMaintenanceEditValue("frequency_months", Number(e.target.value))
                  }
                >
                  <option value={3}>Tous les 3 mois</option>
                  <option value={4}>Tous les 4 mois</option>
                  <option value={6}>Tous les 6 mois</option>
                </select>

                <label>Modele de kit</label>
                <select
                  value={maintenanceEditForm.maintenance_kit_model}
                  onChange={(e) =>
                    setMaintenanceEditValue("maintenance_kit_model", e.target.value)
                  }
                >
                  <option value="gemini">Gemini - 8 kits</option>
                  <option value="gemini_up">Gemini UP - 6 kits</option>
                </select>

                <label>Date de fin du contrat</label>
                <input
                  type="date"
                  value={maintenanceEditForm.end_at}
                  onChange={(e) => setMaintenanceEditValue("end_at", e.target.value)}
                  required
                />

                <label>Priorite</label>
                <select
                  value={maintenanceEditForm.priority}
                  onChange={(e) => setMaintenanceEditValue("priority", e.target.value)}
                >
                  <option>Normale</option>
                  <option>Urgente</option>
                </select>

                <label>Description</label>
                <textarea
                  value={maintenanceEditForm.description}
                  onChange={(e) => setMaintenanceEditValue("description", e.target.value)}
                  required
                />

                <div className="maintenance-actions">
                  <button className="btn small" type="submit" disabled={editingMaintenance}>
                    {editingMaintenance ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button
                    className="btn small ghost"
                    type="button"
                    onClick={cancelEditMaintenance}
                    disabled={editingMaintenance}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <strong>Tous les {plan.frequency_months} mois</strong>
                  <p className="muted-small">
                    {plan.generated_count} intervention(s) creee(s)
                    {plan.next_scheduled_at
                      ? ` - Prochaine: ${formatDate(plan.next_scheduled_at)}`
                      : ""}
                  </p>
                  <p className="muted-small">
                    Fin contrat: {plan.end_at ? formatDate(plan.end_at) : "Non renseignee"} - journee entiere
                  </p>
                  <p className="muted-small">
                    {getMaintenanceKitModelLabel(plan.maintenance_kit_model)}
                  </p>
                </div>
                <div className="maintenance-plan-side">
                  <span className="pill pill-muted">
                    {plan.technician_name || "Technicien libre"}
                  </span>
                  <div className="maintenance-actions">
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={() => startEditMaintenance(plan)}
                    >
                      Modifier
                    </button>
                    <button
                      className="btn small danger"
                      type="button"
                      onClick={() => deleteMaintenancePlan(plan.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (mode === "detail" && selectedClient) {
    const mapTarget = getClientMapTarget(selectedClient);
    const hasMapTarget = Boolean(mapTarget);
    const initials = getInitials(selectedClient.name);
    const nextMaintenanceDate = maintenancePlans
      .map((plan) => plan.next_scheduled_at)
      .filter(Boolean)
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];

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
            <button
              className="btn small danger"
              onClick={handleDeleteClient}
              type="button"
              disabled={deletingClient}
            >
              {deletingClient ? "Suppression..." : "Supprimer client"}
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
                {renderClientBadges(selectedClient, { showMissingRobot: true })}
                <span className="client-badge client-badge--maintenance">
                  {maintenancePlans.length} contrat(s)
                </span>
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

          <div className="client-kpi-grid">
            <div className="client-kpi">
              <span>Interventions</span>
              <strong>{historyForClient.length}</strong>
            </div>
            <div className="client-kpi">
              <span>Contrats</span>
              <strong>{maintenancePlans.length}</strong>
            </div>
            <div className="client-kpi">
              <span>Prochaine maintenance</span>
              <strong>{nextMaintenanceDate ? formatDate(nextMaintenanceDate) : "Aucune"}</strong>
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
                <label>Date de mise en service</label>
                <input
                  type="date"
                  value={editForm.commissioning_date}
                  onChange={(e) => setEditValue("commissioning_date", e.target.value)}
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
                <label>Date de mise en service</label>
                <p className="muted-small">
                  {selectedClient.commissioning_date
                    ? new Date(selectedClient.commissioning_date).toLocaleDateString("fr-FR")
                    : "Non renseignee"}
                </p>
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
            </div>

            <label>Modele de kit</label>
            <select
              value={maintenanceForm.maintenance_kit_model}
              onChange={(e) => setMaintenanceValue("maintenance_kit_model", e.target.value)}
            >
              <option value="gemini">Gemini - 8 kits</option>
              <option value="gemini_up">Gemini UP - 6 kits</option>
            </select>

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
              Le commentaire de chaque intervention indiquera automatiquement :
              Gemini Kit N°1 a N°8 ou Gemini UP Kit N°1 a N°6, puis retour au N°1.
              Les interventions creees sont prevues sur la journee entiere.
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
          <label
            className={`btn small file-picker-btn${uploadingPhoto ? " is-disabled" : ""}`}
            htmlFor={clientPhotoInputId}
          >
            <span>{uploadingPhoto ? "Upload en cours..." : "+ Ajouter une photo"}</span>
            <input
              id={clientPhotoInputId}
              name="photo"
              type="file"
              className="file-input-overlay"
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
              {clientPhotos.map((p) => {
                const photoSrc = buildUploadUrl(apiOrigin, p.url || p.filename);
                return (
                <div key={p.id} className="photo-item">
                  <button
                    className="photo-preview-btn"
                    type="button"
                    onClick={() => setSelectedPhoto({ src: photoSrc, alt: "Photo client" })}
                    aria-label="Agrandir la photo"
                  >
                    <img
                      src={photoSrc}
                      alt="client"
                    />
                  </button>
                  <button
                    className="photo-delete-btn"
                    type="button"
                    onClick={() => handleDeleteClientPhoto(p.id)}
                    disabled={deletingPhotoId === p.id}
                  >
                    {deletingPhotoId === p.id ? "..." : "Supprimer"}
                  </button>
                </div>
                );
              })}
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
      <PhotoLightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
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

              <label>Date de mise en service</label>
              <input
                type="date"
                value={form.commissioning_date}
                onChange={(e) => setValue("commissioning_date", e.target.value)}
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
              const badges = renderClientBadges(c);
              const interventionCount = getClientInterventionCount(c.id);
              return (
              <div
                key={c.id}
                className={`table-row table-row--clickable client-list-row ${
                  selectedClientId === c.id ? "table-row--active" : ""
                }`}
                onClick={() => handleSelectClient(c.id)}
              >
                <div className="client-list-avatar">{getInitials(c.name)}</div>
                <div className="table-main client-list-main">
                  <div className="client-list-title">
                    <strong>{c.name}</strong>
                    <span>{interventionCount} inter.</span>
                  </div>
                  {c.address && <div className="muted-small">{c.address}</div>}
                  <div className="client-tags client-tags--compact">
                    {badges.length ? (
                      badges
                    ) : (
                      <span className="client-badge client-badge--muted">
                        Infos a completer
                      </span>
                    )}
                  </div>
                </div>
                <div className="table-side client-list-actions">
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
                    <a
                      className="btn small ghost"
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Appeler
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
    <PhotoLightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </>
  );
}
