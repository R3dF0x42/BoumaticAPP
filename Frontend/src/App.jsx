import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import TechniciansPage from "./components/TechniciansPage.jsx";
import GoogleCalendar from "./components/GoogleCalendar.jsx";

const API_URL = "https://boumaticapp-production.up.railway.app/api";

export default function App() {

  const [interventions, setInterventions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showNewIntervention, setShowNewIntervention] = useState(false);
  const [currentPage, setCurrentPage] = useState("planning");

  /* Charger toutes les interventions (pour liste + sélection) */
  const loadInterventions = () => {
    fetch(`${API_URL}/interventions`)
      .then((res) => res.json())
      .then((data) => setInterventions(data))
      .catch(console.error);
  };

  useEffect(() => {
    loadInterventions();
  }, []);

  /* Charger une intervention sélectionnée */
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

        {/* Sidebar */}
        <Sidebar
          interventions={interventions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />

        {/* PAGE : GOOGLE AGENDA */}
        {currentPage === "planning" && (
          <GoogleCalendar />
        )}

        {/* PAGE : CLIENTS */}
        {currentPage === "clients" && (
          <ClientsPage apiUrl={API_URL} />
        )}

        {/* PAGE : TECHNICIANS */}
        {currentPage === "technicians" && (
          <TechniciansPage apiUrl={API_URL} />
        )}

        {/* DETAILS PANEL */}
        {selectedDetails && (
          <DetailPanel
            data={selectedDetails}
          />
        )}

      </div>

      {/* MODAL : NEW INTERVENTION */}
      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={loadInterventions}
        />
      )}
    </>
  );
}
