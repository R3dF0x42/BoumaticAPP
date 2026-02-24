import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import TechniciansPage from "./components/TechniciansPage.jsx";
import GoogleCalendarFull from "./components/GoogleCalendarFull.jsx";
import TechnicianLogin from "./components/TechnicianLogin.jsx";
import { API_URL } from "./config/api.js";

const SESSION_KEY = "boumatic-user-session";

function normalizeSession(rawSession) {
  if (!rawSession) return null;
  if (rawSession.role) return rawSession;
  return { ...rawSession, role: "technician" };
}

export default function App() {
  const [interventions, setInterventions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showNewIntervention, setShowNewIntervention] = useState(false);
  const [currentPage, setCurrentPage] = useState("planning");
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 900;
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
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

  useEffect(() => {
    const open = () => setShowNewIntervention(true);

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
    if (!selectedId) return;

    fetch(`${API_URL}/interventions/${selectedId}`)
      .then((res) => res.json())
      .then(setSelectedDetails)
      .catch(console.error);
  }, [selectedId]);

  useEffect(() => {
    if (!isAdmin && currentPage === "admin") {
      setCurrentPage("planning");
    }
  }, [isAdmin, currentPage]);

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedId || !selectedDetails?.intervention) return;
    const { intervention } = selectedDetails;
    setUpdatingStatus(true);
    try {
      const payload = {
        status: newStatus,
        priority: intervention.priority,
        description: intervention.description,
        scheduled_at: intervention.scheduled_at?.replace("T", " ")
      };
      await fetch(`${API_URL}/interventions/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const refreshed = await fetch(`${API_URL}/interventions/${selectedId}`).then(
        (r) => r.json()
      );
      setSelectedDetails(refreshed);
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch (e) {
      console.error("Erreur mise a jour statut :", e);
      alert("Impossible de mettre a jour le statut pour le moment.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (content) => {
    if (!selectedId || !content?.trim()) return;
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

      const refreshed = await fetch(`${API_URL}/interventions/${selectedId}`).then(
        (r) => r.json()
      );
      setSelectedDetails(refreshed);
    } catch (e) {
      console.error("Erreur ajout note :", e);
      alert("Impossible d'ajouter la note pour le moment.");
    }
  };

  const handleUploadPhoto = async (file) => {
    if (!selectedId || !file) return;

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await fetch(`${API_URL}/interventions/${selectedId}/photos`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error("Erreur upload photo");
      }

      const refreshed = await fetch(`${API_URL}/interventions/${selectedId}`).then(
        (r) => r.json()
      );
      setSelectedDetails(refreshed);
    } catch (e) {
      console.error("Erreur upload photo intervention :", e);
      alert("Impossible d'ajouter la photo pour le moment.");
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

      const refreshed = await fetch(`${API_URL}/interventions/${selectedId}`).then(
        (r) => r.json()
      );
      setSelectedDetails(refreshed);
    } catch (e) {
      console.error("Erreur suppression photo intervention :", e);
      alert("Impossible de supprimer la photo pour le moment.");
    }
  };

  const handleSelectEvent = (ev) => {
    setSelectedId(Number(ev.id));
    if (isMobile) setShowDetailModal(true);
  };

  const handleLogin = (userSession) => {
    const normalized = normalizeSession(userSession);
    setLoggedUser(normalized);
    setCurrentPage(normalized?.role === "admin" ? "admin" : "planning");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    }
  };

  const handleLogout = () => {
    setLoggedUser(null);
    setSelectedId(null);
    setSelectedDetails(null);
    setShowNewIntervention(false);
    setShowDetailModal(false);
    setCurrentPage("planning");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
    }
  };

  if (!loggedUser) {
    return <TechnicianLogin apiUrl={API_URL} onLogin={handleLogin} />;
  }

  const renderTopNavMobile = () => (
    <div className="mobile-topbar">
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
        <select
          className="mobile-nav-select"
          value={currentPage}
          onChange={(e) => setCurrentPage(e.target.value)}
        >
          <option value="planning">Planning</option>
          <option value="clients">Clients</option>
          {isAdmin && <option value="admin">Administration</option>}
        </select>
        <button className="btn small ghost" type="button" onClick={handleLogout}>
          Deconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile && renderTopNavMobile()}

      <div className={isMobile ? "app-layout mobile-layout" : "app-layout"}>
        {!isMobile && (
          <Sidebar
            interventions={interventions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            isMobile={isMobile}
            loggedUser={loggedUser}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        )}

        {currentPage === "planning" && (
          <GoogleCalendarFull
            onSelectEvent={handleSelectEvent}
            onInterventionsLoaded={(list) => {
              setInterventions(list);
            }}
          />
        )}

        {!isMobile && (
          <>
            {currentPage === "clients" && <ClientsPage apiUrl={API_URL} />}
            {currentPage === "admin" && isAdmin && (
              <TechniciansPage apiUrl={API_URL} canManage />
            )}

            {currentPage !== "admin" && (
              <DetailPanel
                apiUrl={API_URL}
                data={selectedDetails}
                onAddNote={handleAddNote}
                onUploadPhoto={handleUploadPhoto}
                onDeletePhoto={handleDeletePhoto}
                onUpdateStatus={handleUpdateStatus}
                updatingStatus={updatingStatus}
              />
            )}
          </>
        )}

        {isMobile && currentPage === "clients" && <ClientsPage apiUrl={API_URL} />}
        {isMobile && currentPage === "admin" && isAdmin && (
          <TechniciansPage apiUrl={API_URL} canManage />
        )}
      </div>

      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={() => {
            window.dispatchEvent(new Event("refreshCalendar"));
          }}
        />
      )}

      {isMobile && showDetailModal && selectedDetails && (
        <div className="modal detail-modal">
          <div className="modal-box modal-box--large">
            <button
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
              aria-label="Fermer"
            >
              X
            </button>
            <DetailPanel
              apiUrl={API_URL}
              data={selectedDetails}
              onAddNote={handleAddNote}
              onUploadPhoto={handleUploadPhoto}
              onDeletePhoto={handleDeletePhoto}
              onUpdateStatus={handleUpdateStatus}
              updatingStatus={updatingStatus}
            />
          </div>
        </div>
      )}
    </>
  );
}
