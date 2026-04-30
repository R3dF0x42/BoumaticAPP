import React, { useEffect, useMemo, useState } from "react";

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

export default function GeneralNotesPage({ apiUrl, loggedUser }) {
  const [clients, setClients] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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

  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return notes;

    return notes.filter((note) =>
      `${note.client_name || ""} ${note.author || ""} ${note.content || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [notes, searchTerm]);

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
    const confirmed = window.confirm("Supprimer cette note generale ?");
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

  return (
    <main className="page page--wide general-notes-page">
      <div className="page-header">
        <div>
          <h2>Notes generales</h2>
          <p className="muted-small">Notes libres rattachees aux clients.</p>
        </div>
        <span className="pill">{filteredNotes.length} notes</span>
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
              <h3>Liste des notes</h3>
              <p className="muted-small">
                {loading ? "Chargement..." : "Filtrer par client ou rechercher dans les notes."}
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
            {filteredNotes.map((note) => (
              <article className="table-row table-row--stack general-note-row" key={note.id}>
                <div className="table-row-head">
                  <div className="table-main">
                    <strong>{note.client_name}</strong>
                    <div className="history-meta">
                      <span>{formatDateTime(note.created_at)}</span>
                      <span>{note.author || "Utilisateur"}</span>
                    </div>
                  </div>
                  <button
                    className="btn small danger"
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    disabled={deletingId === note.id}
                  >
                    {deletingId === note.id ? "..." : "Supprimer"}
                  </button>
                </div>
                <p className="general-note-content">{note.content}</p>
              </article>
            ))}

            {!loading && !filteredNotes.length && (
              <div className="muted-small notes-empty">
                Aucune note generale avec ces filtres.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
