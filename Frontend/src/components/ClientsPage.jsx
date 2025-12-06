import React, { useEffect, useState } from "react";

export default function ClientsPage({ apiUrl }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    name: "",
    address: "",
    gps_lat: "",
    gps_lng: "",
    phone: "",
    robot_model: ""
  });

  const load = async () => {
    const res = await fetch(`${apiUrl}/clients`);
    setClients(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const setValue = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    await fetch(`${apiUrl}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
        gps_lng: form.gps_lng ? Number(form.gps_lng) : null
      })
    });
    setForm({
      name: "",
      address: "",
      gps_lat: "",
      gps_lng: "",
      phone: "",
      robot_model: ""
    });
    load();
  };

  return (
    <section className="page">
      <h2>Clients</h2>
      <div className="page-grid">
        <div className="card">
          <h3>Nouveau client</h3>
          <form className="form" onSubmit={submit}>
            <label>Nom de la ferme</label>
            <input
              value={form.name}
              onChange={(e) => setValue("name", e.target.value)}
              required
            />

            <label>Adresse</label>
            <textarea
              value={form.address}
              onChange={(e) => setValue("address", e.target.value)}
            />

            <label>GPS latitude</label>
            <input
              value={form.gps_lat}
              onChange={(e) => setValue("gps_lat", e.target.value)}
              placeholder="45.1234"
            />

            <label>GPS longitude</label>
            <input
              value={form.gps_lng}
              onChange={(e) => setValue("gps_lng", e.target.value)}
              placeholder="4.5678"
            />

            <label>Téléphone</label>
            <input
              value={form.phone}
              onChange={(e) => setValue("phone", e.target.value)}
            />

            <label>Robot de traite</label>
            <input
              value={form.robot_model}
              onChange={(e) => setValue("robot_model", e.target.value)}
              placeholder="BouMatic, Lely, GEA..."
            />

            <button className="btn small" type="submit">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Liste des clients</h3>
          <div className="table">
            {clients.map((c) => (
              <div key={c.id} className="table-row">
                <div className="table-main">
                  <strong>{c.name}</strong>
                  <div className="muted-small">{c.address}</div>
                  <div className="muted-small">
                    {c.robot_model && `Robot : ${c.robot_model}`}
                  </div>
                </div>
                <div className="table-side">
                  <div className="muted-small">
                    {c.gps_lat && c.gps_lng
                      ? `${c.gps_lat.toFixed?.(4) ?? c.gps_lat}, ${
                          c.gps_lng.toFixed?.(4) ?? c.gps_lng
                        }`
                      : "GPS ?"}
                  </div>
                  {c.phone && (
                    <a className="muted-small" href={`tel:${c.phone}`}>
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
            {!clients.length && (
              <div className="muted-small">Aucun client enregistré</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
