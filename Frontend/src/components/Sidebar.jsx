import React from "react";

export default function Sidebar({
  date,
  setDate,
  interventions,
  selectedId,
  onSelect,
  currentPage,
  setCurrentPage,
  urgentCount
}) {
  return (
    <aside className="sidebar">

      {/* LOGO */}
      <div className="brand">
        <div className="brand-box">
          <span className="brand-bou">Bou</span>
          <span className="brand-matic">Matic</span>
        </div>
        <span className="brand-sub">Maintenance</span>
      </div>

      {/* MENU */}
      <nav className="nav-menu">

        <button
          className={
            "nav-item " + (currentPage === "planning" ? "nav-item--active" : "")
          }
          onClick={() => setCurrentPage("planning")}
        >
          📅 Planning
          {urgentCount > 0 && <span className="nav-badge">{urgentCount}</span>}
        </button>

        <button
          className={
            "nav-item " + (currentPage === "clients" ? "nav-item--active" : "")
          }
          onClick={() => setCurrentPage("clients")}
        >
          🐄 Clients
        </button>

        <button
          className={
            "nav-item " + (currentPage === "technicians" ? "nav-item--active" : "")
          }
          onClick={() => setCurrentPage("technicians")}
        >
          👨‍🔧 Techniciens
        </button>
      </nav>

      {/* BOUTON NOUVELLE INTERVENTION */}
      {currentPage === "planning" && (
        <div className="sidebar-section">
          <button
            className="btn new-intervention"
            onClick={() => window.dispatchEvent(new Event("openNewIntervention"))}
          >
            + Nouvelle intervention
          </button>
        </div>
      )}

      {/* LISTE INTERVENTIONS DU JOUR */}
      {currentPage === "planning" && (
        <>
          <div className="sidebar-section">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="sidebar-section">
            <h3>Interventions du jour</h3>
            <ul className="intervention-list">
              {interventions.map((i) => (
                <li
                  key={i.id}
                  className={
                    "intervention-item " +
                    (i.id === selectedId ? "intervention-item--active" : "")
                  }
                  onClick={() => onSelect(i.id)}
                >
                  <div className="intervention-hour">
                    {new Date(i.scheduled_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </div>
                  <div>
                    <div className="intervention-client">{i.client_name}</div>
                    <div className="intervention-status">
                      {i.status} · {i.priority}
                    </div>
                  </div>
                </li>
              ))}

              {!interventions.length && (
                <li className="empty">Aucune intervention</li>
              )}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
