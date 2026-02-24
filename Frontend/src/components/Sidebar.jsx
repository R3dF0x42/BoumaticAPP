import React, { useEffect, useState } from "react";

export default function Sidebar({
  date,
  setDate,
  interventions,
  selectedId,
  onSelect,
  currentPage,
  setCurrentPage,
  urgentCount,
  isMobile,
  loggedUser,
  isAdmin,
  onLogout
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const safeDate = date || "";
  const handleDateChange = typeof setDate === "function" ? setDate : () => {};

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPage]);

  const NavButtons = () => (
    <>
      <button
        className={
          "nav-item " + (currentPage === "planning" ? "nav-item--active" : "")
        }
        onClick={() => setCurrentPage("planning")}
      >
        Planning
        {urgentCount > 0 && <span className="nav-badge">{urgentCount}</span>}
      </button>

      <button
        className={
          "nav-item " + (currentPage === "clients" ? "nav-item--active" : "")
        }
        onClick={() => setCurrentPage("clients")}
      >
        Clients
      </button>

      {isAdmin && (
        <button
          className={"nav-item " + (currentPage === "admin" ? "nav-item--active" : "")}
          onClick={() => setCurrentPage("admin")}
        >
          Administration
        </button>
      )}
    </>
  );

  if (isMobile) {
    return (
      <aside className="sidebar sidebar--mobile">
        <div className="mobile-nav-bar">
          <div className="brand brand--inline">
            <div className="brand-box">
              <span className="brand-bou">Bou</span>
              <span className="brand-matic">Matic</span>
            </div>
            <span className="brand-sub">Maintenance</span>
          </div>
          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? "Fermer" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div className="mobile-nav-panel">
            <nav className="nav-menu nav-menu--mobile">
              <NavButtons />
            </nav>

            {currentPage === "planning" && (
              <div className="sidebar-section">
                <button
                  className="btn new-intervention"
                  onClick={() =>
                    window.dispatchEvent(new Event("openNewIntervention"))
                  }
                >
                  + Nouvelle intervention
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-box">
          <span className="brand-bou">Bou</span>
          <span className="brand-matic">Matic</span>
        </div>
        <span className="brand-sub">Maintenance</span>
      </div>

      {loggedUser && (
        <div className="sidebar-section session-row">
          <div className="session-chip">{isAdmin ? "Admin" : loggedUser.name}</div>
          <button className="btn small ghost session-logout" onClick={onLogout}>
            Deconnexion
          </button>
        </div>
      )}

      <nav className="nav-menu">
        <NavButtons />
      </nav>

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

      {currentPage === "planning" && (
        <>
          <div className="sidebar-section">
            <label>Date</label>
            <input
              type="date"
              value={safeDate}
              onChange={(e) => handleDateChange(e.target.value)}
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
                      {i.status} - {i.priority}
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
