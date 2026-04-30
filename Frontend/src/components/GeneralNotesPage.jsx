import React, { useEffect, useMemo, useRef, useState } from "react";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export default function GeneralNotesPage({ apiUrl, loggedUser }) {
  const [clients, setClients] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const noteTextareaRef = useRef(null);

  const loadClients = async () => {
    const res = await fetch(`${apiUrl}/clients`);
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  };

  const loadNotes = async (clientId = selectedClientId) => {
    setLoading(true);
    setError("");

    try {
      const suffix = clientId !== "all" ? `?client_id=${clientId}` : "";
      const res = await fetch(`${apiUrl}/client-notes${suffix}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossible de charger les notes.");
      }

      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Impossible de charger les notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients().catch(() => {
      setError("Impossible de charger les clients.");
    });
  }, [apiUrl]);

  useEffect(() => {
    loadNotes(selectedClientId);
  }, [apiUrl, selectedClientId]);

  useEffect(() => {
    if (!clients.length) {
      setFormClientId("");
      return;
    }

    if (selectedClientId !== "all") {
      setFormClientId(String(selectedClientId));
      return;
    }

    if (!formClientId || !clients.some((client) => String(client.id) === formClientId)) {
      setFormClientId(String(clients[0].id));
    }
  }, [clients, selectedClientId, formClientId]);

  useEffect(() => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  const searchedNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return notes;

    return notes.filter((note) =>
      `${note.client_name || ""} ${note.author || ""} ${note.content || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [notes, searchTerm]);

  const activeNotes = useMemo(
    () => searchedNotes.filter((note) => !note.completed_at),
    [searchedNotes]
  );

  const historyNotes = useMemo(
    () => searchedNotes.filter((note) => note.completed_at),
    [searchedNotes]
  );

  const visibleNotes = showHistory ? historyNotes : searchedNotes;

  const submitNote = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!formClientId) {
      setError("Selectionnez un client.");
      return;
    }

    if (!content.trim()) {
      setError("La note ne peut pas etre vide.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/client-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(formClientId),
          author: loggedUser?.role === "admin" ? "Admin" : loggedUser?.name || "Tech",
          content: content.trim()
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Impossible d'ajouter la note.");
      }

      setContent("");
      setInfo("Note ajoutee.");
      await loadNotes(selectedClientId);
    } catch (err) {
      setError(err.message || "Impossible d'ajouter la note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId) => {
    const confirmed = window.confirm(
      "Supprimer definitivement cette note de l'historique ?"
    );
    if (!confirmed) return;

    setDeletingId(noteId);
    setError("");
    setInfo("");

    try {
      const res = await fetch(`${apiUrl}/client-notes/${noteId}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Impossible de supprimer la note.");
      }

      setInfo("Note supprimee.");
      await loadNotes(selectedClientId);
    } catch (err) {
      setError(err.message || "Impossible de supprimer la note.");
    } finally {
      setDeletingId(null);
    }
  };

  const completeNote = async (noteId) => {
    setCompletingId(noteId);
    setError("");
    setInfo("");

    try {
      const res = await fetch(`${apiUrl}/client-notes/${noteId}/complete`, {
        method: "PATCH"
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Impossible de marquer la note comme faite.");
      }

      setInfo("Note marquee comme faite.");
      await loadNotes(selectedClientId);
    } catch (err) {
      setError(err.message || "Impossible de marquer la note comme faite.");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <main className="page page--wide general-notes-page">
      <div className="page-header">
        <div>
          <h2>Notes generales</h2>
          <p className="muted-small">Notes libres rattachees aux clients.</p>
        </div>
        <div className="notes-header-actions">
          <span className="pill">{activeNotes.length} notes</span>
          <button
            className={`icon-btn history-toggle ${showHistory ? "history-toggle--active" : ""}`}
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            aria-label={showHistory ? "Voir les notes" : "Voir l'historique"}
            title={showHistory ? "Notes" : "Historique"}
          >
            <HistoryIcon />
          </button>
        </div>
      </div>

      {error && <p className="login-error">{error}</p>}
      {info && <p className="ok-message">{info}</p>}

      <div className="page-grid notes-layout">
        <section className="card">
          <h3>Nouvelle note</h3>
          <form className="form" onSubmit={submitNote}>
            <label>
              Client
              <select
                value={formClientId}
                onChange={(event) => setFormClientId(event.target.value)}
                disabled={!clients.length}
              >
                {!clients.length && <option value="">Aucun client</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Note
              <textarea
                ref={noteTextareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Ajouter une note generale pour ce client"
              />
            </label>

            <button className="btn new-intervention" type="submit" disabled={saving || !clients.length}>
              {saving ? "Ajout..." : "Ajouter la note"}
            </button>
          </form>
        </section>

        <section className="card notes-list-card">
          <div className="table-row-head notes-toolbar">
            <div>
              <h3>{showHistory ? "Historique" : "Liste des notes"}</h3>
              <p className="muted-small">
                {loading
                  ? "Chargement..."
                  : showHistory
                    ? "Notes marquees comme faites."
                    : "Filtrer par client ou rechercher dans les notes."}
              </p>
            </div>
          </div>

          <div className="history-filters">
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
            >
              <option value="all">Tous les clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Recherche libre"
            />
          </div>

          <div className="table notes-table">
            {visibleNotes.map((note) => (
              <article
                className={`table-row table-row--stack general-note-row ${
                  note.completed_at ? "general-note-row--done" : ""
                }`}
                key={note.id}
              >
                <div className="table-row-head">
                  <div className="table-main">
                    <strong>{note.client_name}</strong>
                    <div className="history-meta">
                      <span>{formatDateTime(note.created_at)}</span>
                      <span>{note.author || "Utilisateur"}</span>
                      {note.completed_at && (
                        <span>Fait le {formatDateTime(note.completed_at)}</span>
                      )}
                    </div>
                  </div>
                  {showHistory ? (
                    <button
                      className="icon-btn trash-btn"
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      disabled={deletingId === note.id}
                      aria-label="Supprimer definitivement la note"
                      title="Supprimer"
                    >
                      <TrashIcon />
                    </button>
                  ) : (
                    !note.completed_at && (
                      <button
                        className="btn small done-btn"
                        type="button"
                        onClick={() => completeNote(note.id)}
                        disabled={completingId === note.id}
                      >
                        {completingId === note.id ? "..." : "Fait"}
                      </button>
                    )
                  )}
                </div>
                <p className="general-note-content">{note.content}</p>
              </article>
            ))}

            {!loading && !visibleNotes.length && (
              <div className="muted-small notes-empty">
                {showHistory
                  ? "Aucune note dans l'historique avec ces filtres."
                  : "Aucune note generale avec ces filtres."}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
