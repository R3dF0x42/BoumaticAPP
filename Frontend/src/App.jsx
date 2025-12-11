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

  // charger détail intervention
  useEffect(() => {
    if (!selectedId) return;

    fetch(`${API_URL}/interventions/${selectedId}`)
      .then((res) => res.json())
      .then(setSelectedDetails)
      .catch(console.error);
  }, [selectedId]);

  return (
    <>
      <div className="app-layout">
        <Sidebar
          interventions={interventions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />

        {currentPage === "planning" && (
          <GoogleCalendarFull
            onSelectEvent={(ev) => {
              // quand on clique sur un event dans le calendrier
              setSelectedId(Number(ev.id));
            }}
            onInterventionsLoaded={(list) => {
              setInterventions(list);
            }}
          />
        )}

        {currentPage === "clients" && <ClientsPage apiUrl={API_URL} />}
        {currentPage === "technicians" && <TechniciansPage apiUrl={API_URL} />}

        <DetailPanel
          data={selectedDetails}
        />
      </div>

      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={() => {
            // on peut relancer un refresh du calendrier si besoin
          }}
        />
      )}
    </>
  );
}
