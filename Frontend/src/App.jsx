import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import TechniciansPage from "./components/TechniciansPage.jsx";
import GoogleCalendarFull from "./components/GoogleCalendarFull.jsx";

const API_URL = "https://boumaticapp-production.up.railway.app/api";

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
  

  // écoute le bouton "Nouvelle intervention"
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


  // charger détail intervention
  useEffect(() => {
    if (!selectedId) return;

    fetch(`${API_URL}/interventions/${selectedId}`)
      .then((res) => res.json())
      .then(setSelectedDetails)
      .catch(console.error);
  }, [selectedId]);

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
      const refreshed = await fetch(`${API_URL}/interventions/${selectedId}`).then((r) =>
        r.json()
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

  const handleSelectEvent = (ev) => {
    setSelectedId(Number(ev.id));
    if (isMobile) setShowDetailModal(true);
  };

  const renderTopNavMobile = () => (
    <div className="mobile-topbar">
      <div className="brand brand--inline">
        <div className="brand-box">
          <span className="brand-bou">Bou</span>
          <span className="brand-matic">Matic</span>
        </div>
        <span className="brand-sub">Maintenance</span>
      </div>
      <select
        className="mobile-nav-select"
        value={currentPage}
        onChange={(e) => setCurrentPage(e.target.value)}
      >
        <option value="planning">Planning</option>
        <option value="clients">Clients</option>
        <option value="technicians">Techniciens</option>
      </select>
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
            {currentPage === "technicians" && (
              <TechniciansPage apiUrl={API_URL} />
            )}

            <DetailPanel
              data={selectedDetails}
              onUpdateStatus={handleUpdateStatus}
              updatingStatus={updatingStatus}
            />
          </>
        )}

        {isMobile && currentPage === "clients" && (
          <ClientsPage apiUrl={API_URL} />
        )}
        {isMobile && currentPage === "technicians" && (
          <TechniciansPage apiUrl={API_URL} />
        )}
      </div>

      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={() => {
            // dire au calendrier de se recharger
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
              data={selectedDetails}
              onUpdateStatus={handleUpdateStatus}
              updatingStatus={updatingStatus}
            />
          </div>
        </div>
      )}

    </>
  );
}
