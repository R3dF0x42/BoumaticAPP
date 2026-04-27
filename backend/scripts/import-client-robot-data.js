import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "..", "imports", "client-robot-import.json");

function formatDbDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateAtHour(isoDate, hour = 9) {
  const date = new Date(`${isoDate}T${String(hour).padStart(2, "0")}:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function findTechnicianId(name) {
  const safeName = name?.trim();
  if (!safeName) return null;

  const result = await pool.query(
    `
    SELECT id
    FROM technicians
    WHERE LOWER(name) = LOWER($1)
    LIMIT 1
    `,
    [safeName]
  );

  return result.rows[0]?.id || null;
}

async function getOrCreateClient(client) {
  const safeName = client.name?.trim();
  if (!safeName) return null;
  const gpsLat = Number.isFinite(Number(client.gps_lat)) ? Number(client.gps_lat) : null;
  const gpsLng = Number.isFinite(Number(client.gps_lng)) ? Number(client.gps_lng) : null;

  const existing = await pool.query(
    "SELECT id FROM clients WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [safeName]
  );

  if (existing.rows.length) {
    await pool.query(
      `
      UPDATE clients
      SET commissioning_date = COALESCE($1, commissioning_date),
          gps_lat = COALESCE(gps_lat, $2),
          gps_lng = COALESCE(gps_lng, $3)
      WHERE id = $4
      `,
      [client.commissioning_date || null, gpsLat, gpsLng, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const created = await pool.query(
    `
    INSERT INTO clients (name, commissioning_date, gps_lat, gps_lng)
    VALUES ($1,$2,$3,$4)
    RETURNING id
    `,
    [safeName, client.commissioning_date || null, gpsLat, gpsLng]
  );

  return created.rows[0].id;
}

async function insertIntervention({
  clientId,
  technicianId,
  scheduledAt,
  status,
  priority = "Normale",
  description,
  durationMinutes,
  maintenanceKitLabel = null
}) {
  const scheduled = formatDbDateTime(scheduledAt);

  const existing = await pool.query(
    `
    SELECT id
    FROM interventions
    WHERE client_id = $1
      AND scheduled_at = $2
      AND COALESCE(description, '') = $3
      AND COALESCE(maintenance_kit_label, '') = COALESCE($4, '')
    LIMIT 1
    `,
    [clientId, scheduled, description || "", maintenanceKitLabel || ""]
  );

  if (existing.rows.length) return false;

  await pool.query(
    `
    INSERT INTO interventions
      (client_id, technician_id, scheduled_at, status, priority, description, duration_minutes, maintenance_kit_label)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      clientId,
      technicianId || null,
      scheduled,
      status,
      priority,
      description || "",
      durationMinutes,
      maintenanceKitLabel || null
    ]
  );

  return true;
}

function buildHistoryDescription(item) {
  return [
    item.piece ? `Piece: ${item.piece}` : null,
    item.comment ? `Commentaire: ${item.comment}` : null,
    item.technician ? `Intervenant: ${item.technician}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  let clientsImported = 0;
  let historyImported = 0;
  let kitsImported = 0;
  let todosIgnored = 0;
  let clientsWithGps = 0;
  const now = new Date();

  for (const client of data.clients || []) {
    const clientId = await getOrCreateClient(client);
    if (!clientId) continue;
    clientsImported += 1;
    if (Number.isFinite(Number(client.gps_lat)) && Number.isFinite(Number(client.gps_lng))) {
      clientsWithGps += 1;
    }

    const defaultTechnicianId = await findTechnicianId(client.responsible);

    for (const item of client.history || []) {
      const scheduledAt = dateAtHour(item.date, 9);
      if (!scheduledAt) continue;

      const technicianId =
        (await findTechnicianId(item.technician)) || defaultTechnicianId;
      const inserted = await insertIntervention({
        clientId,
        technicianId,
        scheduledAt,
        status: "TERMINE",
        description: buildHistoryDescription(item),
        durationMinutes: 60
      });
      if (inserted) historyImported += 1;
    }

    for (const kit of client.maintenance_kits || []) {
      const scheduledAt = dateAtHour(kit.date, 8);
      if (!scheduledAt) continue;

      const inserted = await insertIntervention({
        clientId,
        technicianId: defaultTechnicianId,
        scheduledAt,
        status: scheduledAt < now ? "TERMINE" : "A FAIRE",
        description: "Maintenance contrat import fiche robot",
        durationMinutes: 1440,
        maintenanceKitLabel: `Maintenance Kit N°${kit.kit}`
      });
      if (inserted) kitsImported += 1;
    }

    todosIgnored += client.todos?.length || 0;
  }

  console.log(`Clients traites: ${clientsImported}`);
  console.log(`Clients avec coordonnees GPS dans le fichier: ${clientsWithGps}`);
  console.log(`Historique importe: ${historyImported}`);
  console.log(`Maintenances kit importees: ${kitsImported}`);
  console.log(`A prevoir non importes faute de date: ${todosIgnored}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
