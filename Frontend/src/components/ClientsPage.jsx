import React, { useEffect, useId, useMemo, useState } from "react";
import MapAppChooserModal from "./MapAppChooserModal.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import { buildMapAppLinks, isMobileDevice } from "../utils/maps.js";
import { buildUploadUrl, preparePhotoForUpload } from "../utils/images.js";

function getDefaultMaintenanceDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(7, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateTimeInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getDefaultContractEndDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 2);
  return date.toISOString().slice(0, 10);
}

function getCompressorStartDateTime(commissioningDate) {
  if (!commissioningDate) return getDefaultMaintenanceDateTime();
  const date = new Date(commissioningDate);
  if (Number.isNaN(date.getTime())) return getDefaultMaintenanceDateTime();
  date.setMonth(date.getMonth() + 6);
  date.setHours(7, 0, 0, 0);
  return toDateTimeInputValue(date);
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

function getMaintenanceKitCount(value) {
  return (MAINTENANCE_KIT_MODELS[value] || MAINTENANCE_KIT_MODELS.gemini_up).count;
}

function normalizeMaintenanceType(value) {
  if (value === "compressor") return "compressor";
  if (value === "robot_2") return "robot_2";
  return "robot_1";
}

function isRobotMaintenanceType(value) {
  return normalizeMaintenanceType(value) !== "compressor";
}

function getMaintenanceTypeLabel(value) {
  if (value === "compressor") return "Compresseur";
  if (value === "robot_2") return "Robot de traite 2";
  return "Robot de traite 1";
}

function getMaintenanceFrequencyLabel(value) {
  const frequency = Number(value);
  if (frequency === 3.5) return "3 mois et demi";
  return `${frequency || 0} mois`;
}

function getHistoryMaintenanceBadge(intervention) {
  if (!intervention?.maintenance_plan_id && !intervention?.maintenance_kit_label) return "";
  if (!isRobotMaintenanceType(intervention.maintenance_type)) return "";
  return getMaintenanceTypeLabel(intervention.maintenance_type);
}

function buildViewerQuery(user) {
  if (!user) return "";
  const params = new URLSearchParams();

  if (user.role === "admin") {
    params.set("viewer_role", "admin");
  } else if (user.id) {
    params.set("viewer_technician_id", String(user.id));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildInterventionsQuery(user, extraParams = {}) {
  const params = new URLSearchParams();

  if (user?.role === "admin") {
    params.set("viewer_role", "admin");
  } else if (user?.id) {
    params.set("viewer_technician_id", String(user.id));
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function ClientsPage({ apiUrl, onSelectIntervention, isAdmin = false, loggedUser }) {
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
  const [historySortOrder, setHistorySortOrder] = useState("desc");
  const [mode, setMode] = useState("list"); // list | detail
  const [activeClientTab, setActiveClientTab] = useState("overview");
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
    maintenance_type: "robot_1",
    start_at: getDefaultMaintenanceDateTime(),
    frequency_months: 6,
    end_at: getDefaultContractEndDate(),
    maintenance_kit_model: "gemini_up",
    maintenance_kit_start_number: 1,
    priority: "Normale",
    deplacement_offert: false,
    description: "Maintenance contrat"
  });
  const [maintenanceEditForm, setMaintenanceEditForm] = useState({
    technician_id: "",
    maintenance_type: "robot_1",
    start_at: getDefaultMaintenanceDateTime(),
    frequency_months: 6,
    end_at: getDefaultContractEndDate(),
    maintenance_kit_model: "gemini_up",
    maintenance_kit_start_number: 1,
    priority: "Normale",
    deplacement_offert: false,
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
    const res = await fetch(`${apiUrl}/clients${buildViewerQuery(loggedUser)}`);
    setClients(await res.json());
  };

  const loadInterventions = async (clientId = selectedClientId) => {
    if (!clientId) {
      setInterventions([]);
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await fetch(
        `${apiUrl}/interventions${buildInterventionsQuery(loggedUser, { client_id: clientId })}`
      );
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
    loadTechnicians();
  }, []);

  useEffect(() => {
    const refresh = () => {
      loadClients();
      if (selectedClientId) {
        loadInterventions(selectedClientId);
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

  const setMaintenanceKitModel = (value) => {
    setMaintenanceForm((f) => ({
      ...f,
      maintenance_kit_model: value,
      maintenance_kit_start_number: Math.min(
        Number(f.maintenance_kit_start_number) || 1,
        getMaintenanceKitCount(value)
      )
    }));
  };

  const setMaintenanceEditKitModel = (value) => {
    setMaintenanceEditForm((f) => ({
      ...f,
      maintenance_kit_model: value,
      maintenance_kit_start_number: Math.min(
        Number(f.maintenance_kit_start_number) || 1,
        getMaintenanceKitCount(value)
      )
    }));
  };

  const getOfferedTravelUsedCount = (client) => {
    const count = Number(client?.deplacements_offerts_utilises || 0);
    if (!Number.isFinite(count)) return 0;
    return Math.max(0, Math.min(4, count));
  };

  const isOfferedTravelContractActive = (plan) => {
    if (!plan?.deplacement_offert) return false;
    if (!plan.end_at) return true;
    const endDate = new Date(plan.end_at);
    if (Number.isNaN(endDate.getTime())) return false;
    return endDate >= new Date();
  };

  const updateOfferedTravelLights = async (nextCount) => {
    if (!selectedClient?.id) return;

    const currentCount = getOfferedTravelUsedCount(selectedClient);

    if (nextCount < currentCount && !isAdmin) {
      setClientError("Seul un admin peut remettre un deplacement offert en vert.");
      return;
    }

    const message =
      nextCount > currentCount
        ? "Confirmer que ce deplacement offert a ete utilise ?"
        : "Remettre ce deplacement offert en vert ?";

    if (!window.confirm(message)) return;

    setClientError("");
    setClientInfo("");

    try {
      const res = await fetch(`${apiUrl}/clients/${selectedClient.id}/deplacements-offerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used_count: nextCount, is_admin: isAdmin })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de modifier les deplacements offerts.");
        return;
      }

      setClients((list) =>
        list.map((client) =>
          client.id === selectedClient.id
            ? {
                ...client,
                deplacements_offerts_utilises:
                  data.client?.deplacements_offerts_utilises ?? nextCount
              }
            : client
        )
      );
      setClientInfo("Deplacements offerts mis a jour.");
    } catch {
      setClientError("Impossible de modifier les deplacements offerts.");
    }
  };

  const setMaintenanceType = (value) => {
    setMaintenanceForm((f) => ({
      ...f,
      maintenance_type: value,
      start_at:
        value === "compressor"
          ? getCompressorStartDateTime(selectedClient?.commissioning_date)
          : f.start_at,
      frequency_months: value === "compressor" ? 6 : Number(f.frequency_months) === 12 ? 6 : f.frequency_months,
      description: value === "compressor" ? "Maintenance compresseur" : "Maintenance contrat"
    }));
  };

  const setMaintenanceEditType = (value) => {
    setMaintenanceEditForm((f) => ({
      ...f,
      maintenance_type: value,
      frequency_months: value === "compressor" ? 6 : Number(f.frequency_months) === 12 ? 6 : f.frequency_months,
      description: value === "compressor" ? "Maintenance compresseur" : "Maintenance contrat"
    }));
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
    if (!selectedClient || maintenanceForm.maintenance_type !== "compressor") return;
    setMaintenanceForm((f) => ({
      ...f,
      start_at: getCompressorStartDateTime(selectedClient.commissioning_date)
    }));
  }, [selectedClient, maintenanceForm.maintenance_type]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadInterventions(selectedClientId);
    loadClientPhotos(selectedClientId);
    loadMaintenancePlans(selectedClientId);
  }, [selectedClientId]);

  const historyForClient = useMemo(() => {
    if (!selectedClientId) return [];
    return interventions.filter((i) => i.client_id === selectedClientId);
  }, [interventions, selectedClientId]);

  const filteredHistory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return historyForClient
      .filter((h) => {
        const interventionTechnicianIds = Array.isArray(h.technician_ids)
          ? h.technician_ids.map(Number)
          : h.technician_id
            ? [Number(h.technician_id)]
            : [];
        const matchTech =
          techFilter === "all" || interventionTechnicianIds.includes(Number(techFilter));
        const matchTerm =
          !term ||
          `${h.description || ""} ${h.status || ""} ${h.priority || ""} ${
            h.technician_name || ""
          } ${
            Array.isArray(h.technician_names) ? h.technician_names.join(" ") : ""
          } ${getHistoryMaintenanceBadge(h)}`
            .toLowerCase()
            .includes(term);
        return matchTech && matchTerm;
      })
      .sort((a, b) => {
        const aTime = new Date(a.scheduled_at).getTime();
        const bTime = new Date(b.scheduled_at).getTime();
        return historySortOrder === "asc" ? aTime - bTime : bTime - aTime;
      });
  }, [historyForClient, historySortOrder, searchTerm, techFilter]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
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

  const interventionCountsByClient = useMemo(() => {
    const counts = new Map();
    for (const client of clients) {
      counts.set(client.id, Number(client.intervention_count || 0));
    }
    return counts;
  }, [clients]);

  const getClientInterventionCount = (clientId) =>
    interventionCountsByClient.get(clientId) || 0;

  const getWarrantyBadge = (commissioningDate) => {
    if (!commissioningDate) return null;

    const startDate = new Date(commissioningDate);
    if (Number.isNaN(startDate.getTime())) return null;

    const oneYearDate = new Date(startDate);
    oneYearDate.setFullYear(oneYearDate.getFullYear() + 1);

    const twoYearDate = new Date(startDate);
    twoYearDate.setFullYear(twoYearDate.getFullYear() + 2);

    const today = new Date();

    if (today < oneYearDate) {
      return {
        label: "Garantie Boumatic",
        className: "client-badge--warranty-full"
      };
    }

    if (today < twoYearDate) {
      return {
        label: "Garantie pieces",
        className: "client-badge--warranty-parts"
      };
    }

    return {
      label: "Aucune garantie",
      className: "client-badge--warranty-none"
    };
  };

  const renderClientBadges = (client, { showMissingRobot = false } = {}) => {
    const badges = [];
    const warrantyBadge = getWarrantyBadge(client.commissioning_date);

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

    if (warrantyBadge) {
      badges.push(
        <span
          key="warranty"
          className={`client-badge ${warrantyBadge.className}`}
        >
          {warrantyBadge.label}
        </span>
      );
    }

    if (Number(client.maintenance_plan_count || 0) > 0) {
      badges.push(
        <span key="maintenance" className="client-badge client-badge--maintenance">
          {Number(client.maintenance_plan_count)} contrat(s)
        </span>
      );
    }

    if (hasExactGps(client)) {
      badges.push(
        <span key="gps" className="client-badge client-badge--gps">
          GPS exact
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
    setActiveClientTab("overview");
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
      setActiveClientTab("overview");
      setIsEditingClient(false);
      setClientPhotos([]);
      setMaintenancePlans([]);
      setSelectedClientId(null);
      setInterventions([]);
      await loadClients();
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

  const openPhotoPreview = (event, photo) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedPhoto(photo);
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
          maintenance_kit_start_number: Number(maintenanceForm.maintenance_kit_start_number) || 1
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClientError(data.error || "Impossible de programmer la maintenance.");
        return;
      }

      setClientInfo(`${data.count || 0} intervention(s) de maintenance creee(s).`);
      await loadClients();
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions(selectedClient.id);
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
      maintenance_type: normalizeMaintenanceType(plan.maintenance_type),
      start_at: toDateTimeInput(plan.start_at),
      frequency_months: Number(plan.frequency_months) || 6,
      end_at: toDateInput(plan.end_at),
      maintenance_kit_model: plan.maintenance_kit_model || "gemini_up",
      maintenance_kit_start_number: plan.maintenance_kit_start_number || 1,
      priority: plan.priority || "Normale",
      deplacement_offert: plan.deplacement_offert === true,
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
            frequency_months: Number(maintenanceEditForm.frequency_months),
            maintenance_kit_start_number:
              Number(maintenanceEditForm.maintenance_kit_start_number) || 1
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
      await loadClients();
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions(selectedClient.id);
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
      await loadClients();
      await loadMaintenancePlans(selectedClient.id);
      await loadInterventions(selectedClient.id);
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
        {filteredHistory.map((inter) => {
          const maintenanceBadge = getHistoryMaintenanceBadge(inter);
          return (
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
              {maintenanceBadge && (
                <div className="history-badges">
                  <span className="client-badge client-badge--maintenance">
                    {maintenanceBadge}
                  </span>
                  {inter.maintenance_kit_label && (
                    <span className="client-badge client-badge--muted">
                      {inter.maintenance_kit_label}
                    </span>
                  )}
                </div>
              )}
              <div className="history-meta">
                <span>{inter.technician_name || "Technicien inconnu"}</span>
                {inter.priority && <span>Priorite : {inter.priority}</span>}
                {inter.duration_minutes && (
                  <span>
                    Duree : {inter.duration_minutes >= 660
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
          );
        })}
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
      <button
        className="btn small history-sort-btn"
        type="button"
        onClick={() => setHistorySortOrder((order) => (order === "asc" ? "desc" : "asc"))}
      >
        {historySortOrder === "asc" ? "↑ Plus ancien d'abord" : "↓ Plus recent d'abord"}
      </button>
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

                <label>Type de contrat</label>
                <select
                  value={maintenanceEditForm.maintenance_type}
                  onChange={(e) => setMaintenanceEditType(e.target.value)}
                >
                  <option value="robot_1">Robot de traite 1</option>
                  <option value="robot_2">Robot de traite 2</option>
                  <option value="compressor">Compresseur</option>
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
                  {isRobotMaintenanceType(maintenanceEditForm.maintenance_type) && (
                    <>
                      <option value={3}>Tous les 3 mois</option>
                      <option value={3.5}>Tous les 3 mois et demi</option>
                      <option value={4}>Tous les 4 mois</option>
                      <option value={5}>Tous les 5 mois</option>
                    </>
                  )}
                  <option value={6}>Tous les 6 mois</option>
                  {maintenanceEditForm.maintenance_type === "compressor" && (
                    <option value={12}>Tous les 12 mois</option>
                  )}
                </select>

                {isRobotMaintenanceType(maintenanceEditForm.maintenance_type) && (
                  <>
                    <label>Modele de kit</label>
                    <select
                      value={maintenanceEditForm.maintenance_kit_model}
                      onChange={(e) =>
                        setMaintenanceEditKitModel(e.target.value)
                      }
                    >
                      <option value="gemini">Gemini - 8 kits</option>
                      <option value="gemini_up">Gemini UP - 6 kits</option>
                    </select>
                    <label>Commencer au kit N°</label>
                    <input
                      type="number"
                      min="1"
                      max={getMaintenanceKitCount(maintenanceEditForm.maintenance_kit_model)}
                      value={maintenanceEditForm.maintenance_kit_start_number}
                      onChange={(e) =>
                        setMaintenanceEditValue(
                          "maintenance_kit_start_number",
                          Number(e.target.value)
                        )
                      }
                      required
                    />
                  </>
                )}

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

                <label className="maintenance-checkbox-row">
                  <input
                    type="checkbox"
                    checked={maintenanceEditForm.deplacement_offert}
                    onChange={(e) =>
                      setMaintenanceEditValue("deplacement_offert", e.target.checked)
                    }
                  />
                  <span>Deplacement offert</span>
                </label>

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
                  <strong>
                    {getMaintenanceTypeLabel(plan.maintenance_type)} - tous les{" "}
                    {getMaintenanceFrequencyLabel(plan.frequency_months)}
                  </strong>
                  <p className="muted-small">
                    {plan.generated_count} intervention(s) creee(s)
                    {plan.next_scheduled_at
                      ? ` - Prochaine: ${formatDate(plan.next_scheduled_at)}`
                      : ""}
                  </p>
                  <p className="muted-small">
                    Fin contrat: {plan.end_at ? formatDate(plan.end_at) : "Non renseignee"} - journee entiere
                  </p>
                  {plan.deplacement_offert && (
                    <p className="muted-small">Deplacement offert active sur ce contrat</p>
                  )}
                  {isRobotMaintenanceType(plan.maintenance_type) && (
                    <p className="muted-small">
                      {getMaintenanceKitModelLabel(plan.maintenance_kit_model)}
                      {` - depart Kit N°${plan.maintenance_kit_start_number || 1}`}
                    </p>
                  )}
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

  const renderOfferedTravelLights = () => {
    const usedCount = getOfferedTravelUsedCount(selectedClient);

    return (
      <div className="offered-travel-panel">
        <div>
          <strong>Deplacements offerts</strong>
          <p className="muted-small">
            {usedCount}/4 utilise(s)
            {!isAdmin ? " - retour en vert reserve a l'admin" : ""}
          </p>
        </div>
        <div className="offered-travel-lights" aria-label="Deplacements offerts">
          {[0, 1, 2, 3].map((index) => {
            const isUsed = index < usedCount;
            const canToggle = !isUsed || isAdmin;
            const nextCount = isUsed ? index : index + 1;

            return (
              <button
                key={index}
                className={`offered-travel-light ${
                  isUsed ? "offered-travel-light--red" : "offered-travel-light--green"
                }`}
                type="button"
                role="checkbox"
                aria-checked={isUsed}
                disabled={!canToggle}
                title={
                  isUsed && !isAdmin
                    ? "Connexion admin requise pour remettre en vert"
                    : isUsed
                      ? "Remettre ce feu en vert"
                      : "Marquer ce deplacement comme utilise"
                }
                onClick={() => updateOfferedTravelLights(nextCount)}
              >
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>
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
    const hasOfferedTravelContract = maintenancePlans.some(isOfferedTravelContractActive);
    const clientDetailTabs = [
      { value: "overview", label: "Infos" },
      { value: "maintenance", label: `Contrats ${maintenancePlans.length}` },
      { value: "history", label: `Historique ${historyForClient.length}` },
      { value: "photos", label: `Photos ${clientPhotos.length}` }
    ];

    return (
      <>
      <section className="page clients-page clients-page--detail">
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
                setActiveClientTab("overview");
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

        <div className="card client-profile-card">
          <div className="client-hero">
            <div className="client-avatar">{initials}</div>
            <div className="client-meta">
              <div className="client-meta-title">
                <strong>{selectedClient.name}</strong>
              </div>
              <div className="client-tags">
                {renderClientBadges(selectedClient, { showMissingRobot: true })}
              </div>
            </div>
            <div className="client-actions">
              {selectedClient.phone && (
                <a className="btn small client-action-btn client-action-btn--phone" href={`tel:${selectedClient.phone}`}>
                  <span>Appeler</span>
                </a>
              )}
              {hasMapTarget && (
                <button
                  className="btn small client-action-btn client-action-btn--map"
                  type="button"
                  onClick={() => handleOpenMap(mapTarget, selectedClient.name)}
                >
                  <span>Ouvrir carte</span>
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
        </div>

        <div className="client-detail-tabs" aria-label="Sections client">
          {clientDetailTabs.map((tab) => (
            <button
              key={tab.value}
              className={activeClientTab === tab.value ? "client-detail-tab--active" : ""}
              type="button"
              onClick={() => setActiveClientTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeClientTab === "overview" && (
          <>
            {hasOfferedTravelContract && (
              <div className="card">{renderOfferedTravelLights()}</div>
            )}

            <div className="card client-section-card">
              <h3>Informations client</h3>
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
          </>
        )}

        {activeClientTab === "maintenance" && (
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

            <label>Type de contrat</label>
            <select
              value={maintenanceForm.maintenance_type}
              onChange={(e) => setMaintenanceType(e.target.value)}
            >
              <option value="robot_1">Robot de traite 1</option>
              <option value="robot_2">Robot de traite 2</option>
              <option value="compressor">Compresseur</option>
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
              {isRobotMaintenanceType(maintenanceForm.maintenance_type) && (
                <>
                  <option value={3}>Tous les 3 mois</option>
                  <option value={3.5}>Tous les 3 mois et demi</option>
                  <option value={4}>Tous les 4 mois</option>
                  <option value={5}>Tous les 5 mois</option>
                </>
              )}
              <option value={6}>Tous les 6 mois</option>
              {maintenanceForm.maintenance_type === "compressor" && (
                <option value={12}>Tous les 12 mois</option>
              )}
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

            {isRobotMaintenanceType(maintenanceForm.maintenance_type) && (
              <>
                <label>Modele de kit</label>
                <select
                  value={maintenanceForm.maintenance_kit_model}
                  onChange={(e) => setMaintenanceKitModel(e.target.value)}
                >
                  <option value="gemini">Gemini - 8 kits</option>
                  <option value="gemini_up">Gemini UP - 6 kits</option>
                </select>
                <label>Commencer au kit N°</label>
                <input
                  type="number"
                  min="1"
                  max={getMaintenanceKitCount(maintenanceForm.maintenance_kit_model)}
                  value={maintenanceForm.maintenance_kit_start_number}
                  onChange={(e) =>
                    setMaintenanceValue("maintenance_kit_start_number", Number(e.target.value))
                  }
                  required
                />
              </>
            )}

            <label>Priorite</label>
            <select
              value={maintenanceForm.priority}
              onChange={(e) => setMaintenanceValue("priority", e.target.value)}
            >
              <option>Normale</option>
              <option>Urgente</option>
            </select>

            <label className="maintenance-checkbox-row">
              <input
                type="checkbox"
                checked={maintenanceForm.deplacement_offert}
                onChange={(e) => setMaintenanceValue("deplacement_offert", e.target.checked)}
              />
              <span>Deplacement offert</span>
            </label>

            <label>Description</label>
            <textarea
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceValue("description", e.target.value)}
              required
            />
            <p className="muted-small">
              {maintenanceForm.maintenance_type === "compressor"
                ? "Pour un compresseur, le premier passage est propose 6 mois apres la mise en service. Les interventions sont prevues sur la journee entiere."
                : "Le commentaire de chaque intervention indiquera automatiquement : Gemini Kit N°1 a N°8 ou Gemini UP Kit N°1 a N°6, puis retour au N°1. Les interventions creees sont prevues sur la journee entiere."}
            </p>

            <button className="btn small" type="submit" disabled={creatingMaintenance}>
              {creatingMaintenance ? "Creation..." : "Programmer les maintenances"}
            </button>
          </form>

          {renderMaintenancePlans()}
        </div>
        )}

        {activeClientTab === "history" && (
        <div className="card">
          <h3>Historique des interventions</h3>
          {renderHistoryFilters()}
          {renderHistory()}
        </div>
        )}

        {activeClientTab === "photos" && (
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
                  <a
                    href={photoSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="photo-preview-btn"
                    onClick={(event) =>
                      openPhotoPreview(event, { src: photoSrc, alt: "Photo client" })
                    }
                    onTouchEnd={(event) =>
                      openPhotoPreview(event, { src: photoSrc, alt: "Photo client" })
                    }
                    aria-label="Agrandir la photo"
                  >
                    <img
                      src={photoSrc}
                      alt="client"
                    />
                  </a>
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
        )}
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
    <section className="page clients-page">
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

      <div className="page-grid clients-grid">
        {showNewForm && (
          <div className="card client-create-card">
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

        <div className="card client-list-card">
          <div className="client-list-card-head">
            <div>
              <h3>Liste des clients</h3>
              <p className="muted-small">{filteredClients.length} resultat(s)</p>
            </div>
          </div>
          <div className="mobile-search-row">
            <input
              type="search"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Rechercher ferme, ville, robot, telephone"
            />
          </div>
          <div className="table client-card-list">
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
                      className="btn small client-action-btn client-action-btn--map"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMap(mapTarget, c.name);
                      }}
                    >
                      <span>GPS</span>
                    </button>
                  ) : (
                    <div className="muted-small">GPS ?</div>
                  )}
                  {c.phone && (
                    <a
                      className="btn small client-action-btn client-action-btn--phone"
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Appeler</span>
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
