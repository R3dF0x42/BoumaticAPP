import React, { useEffect, useMemo, useState } from "react";

const FALLBACK_OPTIONS = ["Corentin", "Adrien", "Benjamin", "Alexandre"];

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function OnCallTechnicianControl({ apiUrl, loggedUser }) {
  const [technicianName, setTechnicianName] = useState("");
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEdit = useMemo(
    () => loggedUser?.role === "technician" && normalizeName(loggedUser?.name) === "adrien",
    [loggedUser]
  );

  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;

    fetch(`${apiUrl}/on-call-technician`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTechnicianName(data.technician_name || "");
        setOptions(Array.isArray(data.options) && data.options.length ? data.options : FALLBACK_OPTIONS);
      })
      .catch(() => {
        if (!cancelled) setError("Astreinte indisponible");
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const updateOnCallTechnician = async (value) => {
    setTechnicianName(value);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`${apiUrl}/on-call-technician`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technician_name: value,
          updated_by_technician_id: loggedUser?.id
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Modification refusee");
      }

      setTechnicianName(data.technician_name || value);
      setOptions(Array.isArray(data.options) && data.options.length ? data.options : options);
    } catch (err) {
      setError(err.message || "Modification impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="on-call-control">
      <span className="on-call-label">Technicien d'astreinte</span>
      <select
        className={`on-call-select ${!canEdit ? "on-call-select--locked" : ""}`}
        value={technicianName}
        onChange={(event) => updateOnCallTechnician(event.target.value)}
        disabled={!canEdit || saving}
        aria-label="Technicien d'astreinte"
        title={canEdit ? "Modifier le technicien d'astreinte" : "Seul Adrien peut modifier"}
      >
        <option value="" disabled>
          A choisir
        </option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {error && <span className="on-call-error">{error}</span>}
    </div>
  );
}
