import React, { useEffect, useState } from "react";

export default function TechnicianLogin({ apiUrl, onLogin }) {
  const [mode, setMode] = useState("technician");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: ""
  });

  const mapFetchError = (err, fallbackMessage) => {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("failed to fetch")) {
      return `Connexion API impossible (${apiUrl}).`;
    }
    return fallbackMessage;
  };

  useEffect(() => {
    const checkBootstrap = async () => {
      try {
        const res = await fetch(`${apiUrl}/technicians`);
        const techs = await res.json().catch(() => []);
        setBootstrapMode(Array.isArray(techs) && techs.length === 0);
      } catch {
        setBootstrapMode(false);
      } finally {
        setCheckingBootstrap(false);
      }
    };

    checkBootstrap();
  }, [apiUrl]);

  const loginTechnician = async (loginIdentifier, loginPassword) => {
    const res = await fetch(`${apiUrl}/auth/technician/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: loginIdentifier.trim(),
        password: loginPassword
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Connexion impossible pour le moment.");
    }

    onLogin(data.user);
  };

  const loginAdmin = async (loginPassword) => {
    const res = await fetch(`${apiUrl}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginPassword })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Connexion admin impossible.");
    }

    onLogin(data.user);
  };

  const submitTechLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginTechnician(identifier, password);
    } catch (err) {
      setError(mapFetchError(err, err.message || "Connexion impossible pour le moment."));
    } finally {
      setLoading(false);
    }
  };

  const submitAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginAdmin(adminPassword);
    } catch (err) {
      setError(mapFetchError(err, err.message || "Connexion admin impossible."));
    } finally {
      setLoading(false);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/technicians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          phone: createForm.phone,
          email: createForm.email,
          password: createForm.password
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Creation du technicien impossible.");
      }

      await loginTechnician(createForm.name, createForm.password);
    } catch (err) {
      setError(mapFetchError(err, err.message || "Creation du technicien impossible."));
    } finally {
      setLoading(false);
    }
  };

  const setCreateValue = (field, value) => {
    setCreateForm((f) => ({ ...f, [field]: value }));
  };

  if (checkingBootstrap) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="muted">Chargement...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand">
          <div className="brand-box">
            <span className="brand-bou">Bou</span>
            <span className="brand-matic">Matic</span>
          </div>
          <span className="brand-sub">Maintenance</span>
        </div>

        <div className="auth-mode-switch">
          <button
            className={`auth-mode-btn ${
              mode === "technician" ? "auth-mode-btn--active" : ""
            }`}
            type="button"
            onClick={() => {
              setMode("technician");
              setError("");
            }}
          >
            Technicien
          </button>
          <button
            className={`auth-mode-btn ${mode === "admin" ? "auth-mode-btn--active" : ""}`}
            type="button"
            onClick={() => {
              setMode("admin");
              setError("");
            }}
          >
            Admin
          </button>
        </div>

        {mode === "admin" ? (
          <>
            <h1>Connexion admin</h1>
            <p className="muted">Acces a la page Administration.</p>

            <form className="login-form" onSubmit={submitAdminLogin}>
              <label htmlFor="admin-password">Mot de passe admin</label>
              <input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {error && <p className="login-error">{error}</p>}

              <button
                className="btn new-intervention"
                type="submit"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Se connecter (admin)"}
              </button>
            </form>
          </>
        ) : bootstrapMode ? (
          <>
            <h1>Premier technicien</h1>
            <p className="muted">Aucun compte detecte. Cree le premier acces.</p>

            <form className="login-form" onSubmit={submitCreate}>
              <label htmlFor="bootstrap-name">Nom</label>
              <input
                id="bootstrap-name"
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateValue("name", e.target.value)}
                required
              />

              <label htmlFor="bootstrap-phone">Telephone</label>
              <input
                id="bootstrap-phone"
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateValue("phone", e.target.value)}
              />

              <label htmlFor="bootstrap-email">Email (optionnel)</label>
              <input
                id="bootstrap-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateValue("email", e.target.value)}
              />

              <label htmlFor="bootstrap-password">Mot de passe</label>
              <input
                id="bootstrap-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateValue("password", e.target.value)}
                minLength={4}
                required
              />

              {error && <p className="login-error">{error}</p>}

              <button
                className="btn new-intervention"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creation..." : "Creer et se connecter"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Connexion technicien</h1>
            <p className="muted">Connecte-toi pour acceder au planning.</p>
            <p className="muted-small">
              Compte existant sans mot de passe: utilise ton numero de telephone.
            </p>

            <form className="login-form" onSubmit={submitTechLogin}>
              <label htmlFor="tech-identifier">Nom ou email</label>
              <input
                id="tech-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />

              <label htmlFor="tech-password">Mot de passe</label>
              <input
                id="tech-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {error && <p className="login-error">{error}</p>}

              <button
                className="btn new-intervention"
                type="submit"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
