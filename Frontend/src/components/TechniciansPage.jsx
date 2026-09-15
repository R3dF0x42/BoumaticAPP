import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch as fetch } from "../config/api.js";

export default function TechniciansPage({ apiUrl, canManage = false }) {
  const [techs, setTechs] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: ""
  });
  const [resetForId, setResetForId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [editForId, setEditForId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [deletingTechId, setDeletingTechId] = useState(null);
  const [creating, setCreating] = useState(false);
  const createPending = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/technicians`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data)) {
        setError(data.error || "Impossible de charger les techniciens.");
        return;
      }
      setTechs(data);
    } catch {
      setError("Impossible de charger les techniciens. Verifiez la connexion.");
    }
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage || createPending.current) return;
    createPending.current = true;
    setCreating(true);
    setError("");
    setInfo("");

    try {
      const res = await fetch(`${apiUrl}/technicians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Impossible de creer le technicien.");
        return;
      }
      setForm({ name: "", phone: "", email: "", password: "" });
      setInfo("Technicien cree.");
      await load();
    } catch {
      setError("Impossible de creer le technicien. Verifiez la connexion.");
    } finally {
      createPending.current = false;
      setCreating(false);
    }
  };

  const startReset = (techId) => {
    setError("");
    setInfo("");
    setResetForId(techId);
    setResetPassword("");
  };

  const cancelReset = () => {
    setResetForId(null);
    setResetPassword("");
    setResetLoading(false);
  };

  const submitReset = async (techId) => {
    setError("");
    setInfo("");

    if (!resetPassword || resetPassword.length < 4) {
      setError("Le nouveau mot de passe doit contenir au moins 4 caracteres.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${apiUrl}/technicians/${techId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Impossible de reinitialiser le mot de passe.");
        return;
      }

      setInfo("Mot de passe reinitialise.");
      cancelReset();
    } catch {
      setError("Impossible de reinitialiser le mot de passe. Verifiez la connexion.");
    } finally {
      setResetLoading(false);
    }
  };

  const startEdit = (tech) => {
    setError("");
    setInfo("");
    setEditForId(tech.id);
    setEditForm({
      name: tech.name || "",
      phone: tech.phone || "",
      email: tech.email || ""
    });
  };

  const cancelEdit = () => {
    setEditForId(null);
    setEditForm({ name: "", phone: "", email: "" });
    setEditLoading(false);
  };

  const submitEdit = async (techId) => {
    setError("");
    setInfo("");

    if (!editForm.name.trim()) {
      setError("Le nom du technicien est requis.");
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`${apiUrl}/technicians/${techId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Impossible de modifier le technicien.");
        return;
      }

      setInfo("Technicien mis a jour.");
      cancelEdit();
      load();
    } catch {
      setError("Impossible de modifier le technicien. Verifiez la connexion.");
    } finally {
      setEditLoading(false);
    }
  };

  const deleteTechnician = async (tech) => {
    if (!canManage || deletingTechId !== null || editLoading || resetLoading) return;

    const confirmed = window.confirm(
      `Supprimer definitivement le technicien "${tech.name}" ? Il ne pourra plus se connecter. Ses interventions et contrats seront conserves, mais il n'y sera plus affecte.`
    );
    if (!confirmed) return;

    setError("");
    setInfo("");
    setDeletingTechId(tech.id);

    try {
      const res = await fetch(`${apiUrl}/technicians/${tech.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Impossible de supprimer le technicien.");
        return;
      }

      setTechs((currentTechs) => currentTechs.filter((technician) => technician.id !== tech.id));
      if (editForId === tech.id) cancelEdit();
      if (resetForId === tech.id) cancelReset();
      setInfo("Technicien supprime.");
      window.dispatchEvent(new Event("refreshCalendar"));
    } catch {
      setError("Impossible de supprimer le technicien.");
    } finally {
      setDeletingTechId(null);
    }
  };

  return (
    <section className="page">
      <h2>{canManage ? "Administration techniciens" : "Techniciens"}</h2>
      <div className="page-grid">
        {canManage && (
          <div className="card">
            <h3>Nouveau technicien</h3>
            <form className="form" onSubmit={submit}>
              <label>Nom</label>
              <input
                value={form.name}
                onChange={(e) => setValue("name", e.target.value)}
                required
              />

              <label>Telephone</label>
              <input
                value={form.phone}
                onChange={(e) => setValue("phone", e.target.value)}
              />

              <label>Email (optionnel)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setValue("email", e.target.value)}
              />

              <label>Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setValue("password", e.target.value)}
                minLength={4}
                required
              />

              {error && <p className="login-error">{error}</p>}
              {info && <p className="ok-message">{info}</p>}

              <button className="btn small" type="submit" disabled={creating}>
                {creating ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Liste des techniciens</h3>
          {error && <p className="login-error">{error}</p>}
          {info && <p className="ok-message">{info}</p>}
          <div className="table">
            {techs.map((t) => (
              <div key={t.id} className="table-row table-row--stack">
                <div className="table-row-head">
                  <div className="table-main">
                    <strong>{t.name}</strong>
                    <div className="muted-small">{t.email || "Sans email"}</div>
                  </div>

                  <div className="table-side">
                    {t.phone && (
                      <a className="muted-small" href={`tel:${t.phone}`}>
                        {t.phone}
                      </a>
                    )}

                    {canManage && (
                      <div className="tech-actions">
                        <button
                          className="btn small ghost"
                          type="button"
                          onClick={() => startEdit(t)}
                          disabled={deletingTechId !== null}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn small ghost"
                          type="button"
                          onClick={() => startReset(t.id)}
                          disabled={deletingTechId !== null}
                        >
                          Reinitialiser MDP
                        </button>
                        <button
                          className="btn small danger"
                          type="button"
                          onClick={() => deleteTechnician(t)}
                          disabled={deletingTechId !== null || editLoading || resetLoading}
                        >
                          {deletingTechId === t.id ? "Suppression..." : "Supprimer"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {canManage && editForId === t.id && (
                  <div className="edit-inline">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Nom"
                    />
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="Telephone"
                    />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="Email"
                    />
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => submitEdit(t.id)}
                      disabled={editLoading || deletingTechId !== null}
                    >
                      {editLoading ? "En cours..." : "Sauvegarder"}
                    </button>
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={cancelEdit}
                      disabled={editLoading}
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {canManage && resetForId === t.id && (
                  <div className="reset-inline">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Nouveau mot de passe"
                      minLength={4}
                    />
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => submitReset(t.id)}
                      disabled={resetLoading || deletingTechId !== null}
                    >
                      {resetLoading ? "En cours..." : "Valider"}
                    </button>
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={cancelReset}
                      disabled={resetLoading}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!techs.length && (
              <div className="muted-small">Aucun technicien enregistre</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
