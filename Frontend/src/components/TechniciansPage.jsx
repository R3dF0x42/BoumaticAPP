import React, { useEffect, useState } from "react";

export default function TechniciansPage({ apiUrl }) {
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

  return (
    <section className="page">
      <h2>Techniciens</h2>
      <div className="page-grid">
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
                    <div className="muted-small">{t.email}</div>
                  </div>

                  <div className="table-side">
                    {t.phone && (
                      <a className="muted-small" href={`tel:${t.phone}`}>
                        {t.phone}
                      </a>
                    )}
                    <button
                      className="btn small ghost"
                      type="button"
                      onClick={() => startReset(t.id)}
                    >
                      Reinitialiser MDP
                    </button>
                  </div>
                </div>

                {resetForId === t.id && (
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
