import React, { useEffect, useState } from "react";

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

  const load = async () => {
    const res = await fetch(`${apiUrl}/technicians`);
    setTechs(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

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
    load();
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
    } finally {
      setEditLoading(false);
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

              <button className="btn small" type="submit">
                Enregistrer
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
                        >
                          Modifier
                        </button>
                        <button
                          className="btn small ghost"
                          type="button"
                          onClick={() => startReset(t.id)}
                        >
                          Reinitialiser MDP
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
                      disabled={editLoading}
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
                      disabled={resetLoading}
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
