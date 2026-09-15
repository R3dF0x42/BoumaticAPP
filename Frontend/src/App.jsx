import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import TechnicianLogin from "./components/TechnicianLogin.jsx";
import { apiFetch as fetch, API_URL } from "./config/api.js";
import { preparePhotoForUpload } from "./utils/images.js";

const GoogleCalendarFull = lazy(() => import("./components/GoogleCalendarFull.jsx"));
const ClientsPage = lazy(() => import("./components/ClientsPage.jsx"));
const GeneralNotesPage = lazy(() => import("./components/GeneralNotesPage.jsx"));
const MaintenancePlanningPage = lazy(() => import("./components/MaintenancePlanningPage.jsx"));
const TechniciansPage = lazy(() => import("./components/TechniciansPage.jsx"));

const SESSION_KEY = "boumatic-user-session";
const PAGE_KEY = "boumatic-current-page";
const VALID_PAGES = new Set(["planning", "maintenance", "notes", "clients", "admin"]);

function normalizeSession(rawSession) {
  if (!rawSession) return null;
  if (rawSession.role) return rawSession;
  return { ...rawSession, role: "technician" };
}

function readNavigationFromLocation() {
  if (typeof window === "undefined") {
    return { page: "planning", interventionId: null };
  }

  const hash = window.location.hash.replace(/^#\/?/, "");
  const [pagePart, detailPart, idPart] = hash.split("/");
  const storedPage = window.localStorage.getItem(PAGE_KEY);
  const page = VALID_PAGES.has(pagePart)
    ? pagePart
    : VALID_PAGES.has(storedPage)
      ? storedPage
      : "planning";
  const interventionId = detailPart === "intervention" ? Number(idPart) : null;

  return {
    page,
    interventionId: Number.isInteger(interventionId) && interventionId > 0 ? interventionId : null
  };
}

function buildNavigationHash(page, interventionId = null) {
  const safePage = VALID_PAGES.has(page) ? page : "planning";
  if (interventionId) {
    return `#/${safePage}/intervention/${interventionId}`;
  }
  return `#/${safePage}`;
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

export default function App() {
  const initialNavigation = readNavigationFromLocation();
  const [interventions, setInterventions] = useState([]);
  const [selectedId, setSelectedId] = useState(initialNavigation.interventionId);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const selectedIdRef = useRef(initialNavigation.interventionId);
  const pendingUpdates = useRef(new Set());
  const [showNewIntervention, setShowNewIntervention] = useState(false);
  const [newInterventionDate, setNewInterventionDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialNavigation.page);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 900;
  });
  const [showDetailModal, setShowDetailModal] = useState(() =>
    Boolean(initialNavigation.interventionId && typeof window !== "undefined" && window.innerWidth < 900)
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  const [loggedUser, setLoggedUser] = useState(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return normalizeSession(JSON.parse(raw));
    } catch {
      return null;
    }
  });

  const isAdmin = loggedUser?.role === "admin";
  const viewerQuery = buildViewerQuery(loggedUser);

  const applyNavigation = useCallback((navigation) => {
    const nextPage = VALID_PAGES.has(navigation.page) ? navigation.page : "planning";
    const nextInterventionId = navigation.interventionId;

    setCurrentPage(nextPage);
    if (selectedIdRef.current !== nextInterventionId) {
      setSelectedDetails(null);
    }
    selectedIdRef.current = nextInterventionId;
    setSelectedId(nextInterventionId);
    setShowDetailModal(Boolean(nextInterventionId && window.innerWidth < 900));
    if (!nextInterventionId) {
      setSelectedDetails(null);
    }
  }, []);

  const navigateTo = useCallback((page, options = {}) => {
    if (typeof window === "undefined") return;

    const nextPage = VALID_PAGES.has(page) ? page : "planning";
    const interventionId =
      options.interventionId ? Number(options.interventionId) : null;
    const navigation = {
      page: nextPage,
      interventionId: Number.isInteger(interventionId) && interventionId > 0 ? interventionId : null
    };
    const hash = buildNavigationHash(navigation.page, navigation.interventionId);
    const method = options.replace ? "replaceState" : "pushState";

    applyNavigation(navigation);
    window.history[method](navigation, "", hash);
  }, [applyNavigation]);

  useEffect(() => {
    const open = (event) => {
      if (event?.detail?.date) {
        setNewInterventionDate(event.detail.date);
      }
      setShowNewIntervention(true);
    };

    window.addEventListener("openNewIntervention", open);
    return () => window.removeEventListener("openNewIntervention", open);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentNavigation = readNavigationFromLocation();
    window.history.replaceState(
      currentNavigation,
      "",
      buildNavigationHash(currentNavigation.page, currentNavigation.interventionId)
    );

    const handlePopState = () => {
      applyNavigation(readNavigationFromLocation());
      setShowNewIntervention(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyNavigation]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();

    fetch(`${API_URL}/interventions/${selectedId}${viewerQuery}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur chargement intervention");
        }
        return data;
      })
      .then((details) => {
        if (!controller.signal.aborted && selectedIdRef.current === selectedId) {
          setSelectedDetails(details);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted || selectedIdRef.current !== selectedId) return;
        console.error(err);
        setSelectedDetails(null);
      });

    return () => controller.abort();
  }, [selectedId, viewerQuery]);

  useEffect(() => {
    if (!isAdmin && currentPage === "admin") {
      navigateTo("planning", { replace: true });
    }
  }, [isAdmin, currentPage, navigateTo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PAGE_KEY, currentPage);
  }, [currentPage]);

  const refreshInterventionDetails = async (interventionId) => {
    const res = await fetch(`${API_URL}/interventions/${interventionId}${viewerQuery}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erreur rechargement intervention");
    if (selectedIdRef.current === interventionId) setSelectedDetails(data);
  };

  const handleUpdateIntervention = async (updates) => {
    if (!selectedId || selectedDetails?.intervention?.id !== selectedId) return false;
    if (pendingUpdates.current.has(selectedId)) return false;
    pendingUpdates.current.add(selectedId);
    const { intervention } = selectedDetails;
    setUpdatingStatus(true);
    try {
      const payload = {
        client_id: intervention.client_id,
        technician_id: intervention.technician_id,
        technician_ids: Array.isArray(intervention.technician_ids)
          ? intervention.technician_ids
          : intervention.technician_id
            ? [intervention.technician_id]
            : [],
        status: intervention.status,
        priority: intervention.priority,
        description: intervention.description,
        scheduled_at: intervention.scheduled_at?.replace("T", " "),
        duration_minutes: intervention.duration_minutes || 60,
        ...updates
      };
      const res = await fetch(`${API_URL}/interventions/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur mise a jour intervention");
      }

      await refreshInterventionDetails(selectedId).catch(console.error);
      window.dispatchEvent(new Event("refreshCalendar"));
      return true;
    } catch (e) {
      console.error("Erreur mise a jour statut :", e);
      alert("Impossible de mettre a jour le statut pour le moment.");
      return false;
    } finally {
      pendingUpdates.current.delete(selectedId);
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (content) => {
    if (!selectedId || selectedDetails?.intervention?.id !== selectedId || !content?.trim()) return false;
    try {
      const res = await fetch(`${API_URL}/interventions/${selectedId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: isAdmin ? "Admin" : loggedUser?.name || "Tech",
          content: content.trim()
        })
      });

      if (!res.ok) {
        throw new Error("Erreur ajout note");
      }

      await refreshInterventionDetails(selectedId).catch(console.error);
      return true;
    } catch (e) {
      console.error("Erreur ajout note :", e);
      alert("Impossible d'ajouter la note pour le moment.");
      return false;
    }
  };

  const handleUploadPhoto = async (file) => {
    if (!selectedId || !file) return;

    try {
      const uploadFile = await preparePhotoForUpload(file);
      const formData = new FormData();
      formData.append("photo", uploadFile);

      const res = await fetch(`${API_URL}/interventions/${selectedId}/photos`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur upload photo");
      }

      await refreshInterventionDetails(selectedId).catch(console.error);
    } catch (e) {
      console.error("Erreur upload photo intervention :", e);
      alert(`Impossible d'ajouter la photo pour le moment.\n${e.message || ""}`);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!selectedId || !photoId) return;

    const confirmed = window.confirm("Confirmer la suppression de cette photo ?");
    if (!confirmed) return;

    try {
      const res = await fetch(
        `${API_URL}/interventions/${selectedId}/photos/${photoId}`,
        {
          method: "DELETE"
        }
      );

      if (!res.ok) {
        throw new Error("Erreur suppression photo");
      }

      await refreshInterventionDetails(selectedId).catch(console.error);
    } catch (e) {
      console.error("Erreur suppression photo intervention :", e);
      alert("Impossible de supprimer la photo pour le moment.");
    }
  };

  const handleDeleteIntervention = async () => {
    if (!selectedId) return;

    const confirmed = window.confirm("Supprimer definitivement cette intervention ?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/interventions/${selectedId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Erreur suppression intervention");
      }

      if (selectedIdRef.current === selectedId) {
        navigateTo(currentPage, { replace: true });
      }
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch (e) {
      console.error("Erreur suppression intervention :", e);
      alert("Impossible de supprimer l'intervention pour le moment.");
    }
  };

  const handleSelectEvent = (ev) => {
    navigateTo(currentPage, { interventionId: Number(ev.id) });
  };

  const handleCloseInterventionDetails = () => {
    navigateTo(currentPage, { replace: true });
  };

  const handleSelectInterventionId = useCallback((id) => {
    navigateTo("planning", { interventionId: Number(id) });
  }, [navigateTo]);

  const handleInterventionsLoaded = useCallback((list) => {
    setInterventions(list);
  }, []);

  const handleActiveCalendarDateChange = useCallback((date) => {
    if (date) setNewInterventionDate(date);
  }, []);

  const renderPageFallback = () => (
    <main className="page">
      <p className="muted">Chargement...</p>
    </main>
  );

  const handleLogin = (userSession) => {
    const normalized = normalizeSession(userSession);
    setLoggedUser(normalized);
    navigateTo(normalized?.role === "admin" ? "admin" : "planning", { replace: true });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    }
  };

  const clearSession = useCallback(() => {
    selectedIdRef.current = null;
    setLoggedUser(null);
    setSelectedId(null);
    setSelectedDetails(null);
    setShowNewIntervention(false);
    setShowDetailModal(false);
    navigateTo("planning", { replace: true });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(PAGE_KEY);
    }
  }, [navigateTo]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/auth/session`, { signal: controller.signal })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          clearSession();
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Connexion au serveur impossible.");
        if (controller.signal.aborted) return;
        setLoggedUser(data.user);
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSessionError(err.message || "Connexion au serveur impossible.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });
    return () => controller.abort();
  }, [clearSession, sessionCheckAttempt]);

  useEffect(() => {
    window.addEventListener("sessionExpired", clearSession);
    return () => window.removeEventListener("sessionExpired", clearSession);
  }, [clearSession]);

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/logout`, { method: "POST" });
      if (!res.ok && res.status !== 401) throw new Error("Deconnexion impossible.");
      clearSession();
    } catch {
      alert("Deconnexion impossible. Verifiez la connexion et reessayez.");
    }
  };

  if (checkingSession || sessionError) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className={sessionError ? "login-error" : "muted"}>
            {sessionError ? "Connexion au serveur impossible. Verifiez votre connexion." : "Chargement..."}
          </p>
          {sessionError && (
            <button className="btn" type="button" onClick={() => {
              setSessionError("");
              setCheckingSession(true);
              setSessionCheckAttempt((attempt) => attempt + 1);
            }}>
              Reessayer
            </button>
          )}
        </section>
      </main>
    );
  }

  if (!loggedUser) {
    return <TechnicianLogin apiUrl={API_URL} onLogin={handleLogin} />;
  }

  const mobilePages = [
    { value: "planning", label: "Planning", short: "Planning" },
    { value: "maintenance", label: "Maintenance a prevoir", short: "Maint." },
    { value: "notes", label: "Notes generales", short: "Notes" },
    { value: "clients", label: "Clients", short: "Clients" },
    ...(isAdmin ? [{ value: "admin", label: "Admin", short: "Admin" }] : [])
  ];

  const renderTopNavMobile = () => (
    <div className="mobile-topbar">
      <div className="mobile-topbar-main">
        <div className="brand brand--inline">
          <div className="brand-box">
            <span className="brand-bou">Bou</span>
            <span className="brand-matic">Matic</span>
          </div>
          <span className="brand-sub">Maintenance</span>
        </div>
        <div className="mobile-topbar-actions">
          <span className="session-chip">
            {isAdmin ? "Admin" : loggedUser.name}
          </span>
          <button className="btn small ghost" type="button" onClick={handleLogout}>
            Deconnexion
          </button>
        </div>
      </div>

    </div>
  );

  const renderBottomNavMobile = () => (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale">
      {mobilePages.map((page) => (
          <button
            key={page.value}
            className={`mobile-bottom-tab ${
              currentPage === page.value ? "mobile-bottom-tab--active" : ""
            }`}
            type="button"
            onClick={() => navigateTo(page.value)}
          >
          <span>{page.short}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {isMobile && renderTopNavMobile()}

      <div className={isMobile ? "app-layout mobile-layout" : "app-layout"}>
        {!isMobile && (
          <Sidebar
            interventions={interventions}
            selectedId={selectedId}
            onSelect={handleSelectInterventionId}
            currentPage={currentPage}
            setCurrentPage={navigateTo}
            isMobile={isMobile}
            loggedUser={loggedUser}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        )}

        <Suspense fallback={renderPageFallback()}>
          {currentPage === "planning" && (
            <GoogleCalendarFull
              onSelectEvent={handleSelectEvent}
              onInterventionsLoaded={handleInterventionsLoaded}
              onActiveDateChange={handleActiveCalendarDateChange}
              loggedUser={loggedUser}
            />
          )}

          {!isMobile && (
            <>
              {currentPage === "clients" && (
                <ClientsPage
                  apiUrl={API_URL}
                  onSelectIntervention={handleSelectEvent}
                  isAdmin={isAdmin}
                  loggedUser={loggedUser}
                />
              )}
              {currentPage === "notes" && (
                <GeneralNotesPage apiUrl={API_URL} loggedUser={loggedUser} />
              )}
              {currentPage === "maintenance" && (
                <MaintenancePlanningPage apiUrl={API_URL} loggedUser={loggedUser} />
              )}
              {currentPage === "admin" && isAdmin && (
                <TechniciansPage apiUrl={API_URL} canManage />
              )}

              {currentPage !== "admin" &&
                currentPage !== "notes" &&
                currentPage !== "maintenance" && (
                <DetailPanel
                  key={selectedDetails?.intervention?.id || "empty"}
                  apiUrl={API_URL}
                  data={selectedDetails}
                  onAddNote={handleAddNote}
                  onUploadPhoto={handleUploadPhoto}
                  onDeletePhoto={handleDeletePhoto}
                  onUpdateIntervention={handleUpdateIntervention}
                  onDeleteIntervention={handleDeleteIntervention}
                  updatingStatus={updatingStatus}
                />
              )}
            </>
          )}

          {isMobile && currentPage === "clients" && (
            <ClientsPage
              apiUrl={API_URL}
              onSelectIntervention={handleSelectEvent}
              isAdmin={isAdmin}
              loggedUser={loggedUser}
            />
          )}
          {isMobile && currentPage === "notes" && (
            <GeneralNotesPage apiUrl={API_URL} loggedUser={loggedUser} />
          )}
          {isMobile && currentPage === "maintenance" && (
            <MaintenancePlanningPage apiUrl={API_URL} loggedUser={loggedUser} />
          )}
          {isMobile && currentPage === "admin" && isAdmin && (
            <TechniciansPage apiUrl={API_URL} canManage />
          )}
        </Suspense>
      </div>

      {isMobile && currentPage === "planning" && (
        <button
          className="btn mobile-create-fab"
          type="button"
          onClick={() => setShowNewIntervention(true)}
        >
          + Intervention
        </button>
      )}

      {isMobile && renderBottomNavMobile()}

      {showNewIntervention && (
        <NewIntervention
          loggedUser={loggedUser}
          defaultDate={newInterventionDate}
          onClose={() => setShowNewIntervention(false)}
          onCreated={() => {
            window.dispatchEvent(new Event("refreshCalendar"));
          }}
        />
      )}

      {isMobile && showDetailModal && selectedDetails && (
        <div className="modal detail-modal">
          <div className="modal-box modal-box--large">
            <div className="modal-header intervention-modal-header">
              <div className="modal-title-block">
                <h2>Intervention</h2>
                <p className="muted-small">
                  Consulter, modifier ou supprimer cette intervention.
                </p>
              </div>
              <button
                className="modal-close modal-close--inline"
                onClick={handleCloseInterventionDetails}
                type="button"
                aria-label="Fermer"
              >
                X
              </button>
            </div>
          <DetailPanel
            key={selectedDetails?.intervention?.id || "empty"}
              apiUrl={API_URL}
              data={selectedDetails}
              onAddNote={handleAddNote}
              onUploadPhoto={handleUploadPhoto}
              onDeletePhoto={handleDeletePhoto}
              onUpdateIntervention={handleUpdateIntervention}
              onDeleteIntervention={handleDeleteIntervention}
              updatingStatus={updatingStatus}
            />
          </div>
        </div>
      )}
    </>
  );
}
