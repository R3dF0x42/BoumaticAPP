import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import CalendarWeek from "./components/CalendarWeek.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NewIntervention from "./components/NewIntervention.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import TechniciansPage from "./components/TechniciansPage.jsx";

const API_URL = process.env.REACT_APP_API_URL || "https://boumaticapp-production.up.railway.app/api";

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
  const [currentPage, setCurrentPage] = useState("planning"); // "planning" | "clients" | "technicians"

  // Charger interventions du jour
  useEffect(() => {
    fetch(`${API_URL}/interventions?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setInterventions(data);
        if (data.length && !selectedId) setSelectedId(data[0].id);
      })
      .catch(console.error);
  }, [date]);

  // Charger details intervention selectionnee
  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API_URL}/interventions/${selectedId}`)
      .then((res) => res.json())
      .then(setSelectedDetails)
      .catch(console.error);
  }, [selectedId]);

  const handleAddNote = async (content) => {
    if (!selectedId || !content.trim()) return;
    await fetch(`${API_URL}/interventions/${selectedId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "Tech", content })
    });
    const res = await fetch(`${API_URL}/interventions/${selectedId}`);
    setSelectedDetails(await res.json());
  };

  const handleUploadPhoto = async (file) => {
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append("photo", file);
    await fetch(`${API_URL}/interventions/${selectedId}/photos`, {
      method: "POST",
      body: fd
    });
    const res = await fetch(`${API_URL}/interventions/${selectedId}`);
    setSelectedDetails(await res.json());
  };

  // ouverture du modal "Nouvelle intervention"
  useEffect(() => {
    const open = () => setShowNewIntervention(true);
    window.addEventListener("openNewIntervention", open);
    return () => window.removeEventListener("openNewIntervention", open);
  }, []);

  // Deplacement drag & drop d'une intervention vers une autre heure ou date
  const handleMoveIntervention = async (id, newDateOrHour) => {
    const inter = interventions.find((i) => i.id === Number(id));
    if (!inter) return;

    const newDateTime = newDateOrHour.includes("T")
      ? newDateOrHour
      : `${date}T${newDateOrHour}:00`;

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

    const res = await fetch(`${API_URL}/interventions?date=${date}`);
    const data = await res.json();
    setInterventions(data);

    if (selectedId === Number(id)) {
      const detailRes = await fetch(`${API_URL}/interventions/${id}`);
      setSelectedDetails(await detailRes.json());
    }
  };

  const urgentCount = interventions.filter(
    (i) => i.priority && i.priority.toLowerCase().startsWith("urgent")
  ).length;

  const changeWeek = (offset) => {
    const d = new Date(date);

    if (offset === 0) {
      setDate(new Date().toISOString().slice(0, 10));
      return;
    }

    d.setDate(d.getDate() + offset * 7);
    setDate(d.toISOString().slice(0, 10));
  };

  const TECH_COLORS = [
    "#1d6fff",
    "#f38b1a",
    "#b14ff2",
    "#22c55e",
    "#e11d48",
    "#38bdf8",
    "#ffb800"
  ];

  const getTechColor = (techId) => {
    if (!techId) return "#1d6fff";
    return TECH_COLORS[techId % TECH_COLORS.length];
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
          urgentCount={urgentCount}
        />

        {currentPage === "planning" && (
          <div className="planning-container">
            <div className="week-nav">
              <button onClick={() => changeWeek(-1)}>Semaine -1</button>
              <button onClick={() => changeWeek(0)}>Aujourd'hui</button>
              <button onClick={() => changeWeek(+1)}>Semaine +1</button>
            </div>

            <CalendarWeek
              date={date}
              interventions={interventions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleMoveIntervention}
              getTechColor={getTechColor}
            />

            {selectedDetails && (
              <DetailPanel
                intervention={selectedDetails}
                onAddNote={handleAddNote}
                onUploadPhoto={handleUploadPhoto}
              />
            )}
          </div>
        )}

        {currentPage === "clients" && <ClientsPage apiUrl={API_URL} />}

        {currentPage === "technicians" && <TechniciansPage apiUrl={API_URL} />}
      </div>

      {showNewIntervention && (
        <NewIntervention
          onClose={() => setShowNewIntervention(false)}
          onCreated={async () => {
            const res = await fetch(`${API_URL}/interventions?date=${date}`);
            setInterventions(await res.json());
          }}
        />
      )}
    </>
  );
}
