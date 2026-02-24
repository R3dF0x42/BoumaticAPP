import React, { useEffect, useState } from "react";

export default function TechniciansPage({ apiUrl }) {
  const [techs, setTechs] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: ""
  });

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
    load();
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

            <button className="btn small" type="submit">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Liste des techniciens</h3>
          <div className="table">
            {techs.map((t) => (
              <div key={t.id} className="table-row">
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
                </div>
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
