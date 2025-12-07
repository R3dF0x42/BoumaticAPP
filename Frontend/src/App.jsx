import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import CalendarWeek from "./components/CalendarWeek.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import TechniciansPage from "./components/TechniciansPage.jsx";

const API_URL = "https://boumaticapp-production.up.railway.app/api";

export default function App() {

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });

  const [interventions, setInterventions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showNewIntervention, setShowNewIntervention] = useState(false);
  const [currentPage, setCurrentPage] = useState("planning");

  /* LOAD ALL INTERVENTIONS (NO DATE FILTER) */
  const loadInterventions = () => {
    fetch(`${API_URL}/interventions`)
      .then((res) => res.json())
      .then((data) => setInterventions(data))
      .catch(console.error);
  };

  useEffect(() => {
    loadInterventions();
  }, []);

  /* LOAD SELECTED INTERVENTION DETAILS */
  useEffect(() => {
    if (!selectedId) return;

    fetch(`${API_URL}/interventions/${selectedId}`)
      .then((res) => res.json())
      .then(setSelectedDetails)
      .catch(console.error);
  }, [selectedId]);


  /* MOVE INTERVENTION */
  const handleMoveIntervention = async (id, newDateTime) => {
    const inter = interventions.find((i) => i.id === Number(id));
    if (!inter) return;

    await fetch(`${API_URL}/interventions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: inter.status,
        priority: inter.priority,
        description: inter.description,
        scheduled_at: newDateTime
      })
    });

    loadInterventions();
  };

  /* COLORS */
  const TECH_COLORS = [
    "#1d6fff", "#f38b1a", "#b14ff2",
    "#22c55e", "#e11d48", "#38bdf8", "#ffb800"
  ];

  const getTechColor = (techId) =>
    techId ? TECH_COLORS[techId % TECH_COLORS.length] : "#1d6fff";


  /* NAVIGATE WEEKS */
  const changeWeek = (offset) => {
    const d = new Date(date);

    if (offset === 0) {
      setDate(new Date().toISOString().slice(0, 10));
      return;
    }

    d.setDate(d.getDate() + offset * 7);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <>
      <div className="app-layout">
        <Sidebar
          date={date}
          setDate={setDate}
          interventions={interventions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />

        {currentPage === "planning" && (
          <div className="planning-container">
            <div className="week-nav">
              <button onClick={() => changeWeek(-1)}>← Semaine -1</button>
              <button onClick={() => changeWeek(0)}>Aujourd’hui</button>
              <button onClick={() => changeWeek(+1)}>Semaine +1 →</button>
            </div>

            <CalendarWeek
              date={date}
              interventions={interventions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleMoveIntervention}
              getTechColor={getTechColor}
            />
          </div>
        )}

        {currentPage === "clients" && <ClientsPage apiUrl={API_URL} />}
        {currentPage === "technicians" && <TechniciansPage apiUrl={API_URL} />}
      </div>

      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={loadInterventions}
        />
      )}
    </>
  );
}
