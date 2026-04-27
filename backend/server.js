import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pool from "./db.js";
import { createGoogleEvent, updateGoogleEvent } from "./google.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "coco";

app.use(cors());
app.use(express.json());

/* ----------------------- AUTH HELPERS ----------------------- */

const PASSWORD_KEYLEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEYLEN).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  const computed = crypto.scryptSync(password, salt, PASSWORD_KEYLEN).toString("hex");
  const computedBuffer = Buffer.from(computed, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  if (computedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
}

/* ----------------------- UPLOADS ----------------------- */

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  }
});
const upload = multer({ storage });
app.use("/uploads", express.static(uploadsDir));

/* ----------------------- CLIENTS ----------------------- */

app.get("/api/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/clients", async (req, res) => {
  const { name, address, gps_lat, gps_lng, phone, robot_model } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (name, address, gps_lat, gps_lng, phone, robot_model)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, address, gps_lat, gps_lng, phone, robot_model]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/clients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address, gps_lat, gps_lng, phone, robot_model } = req.body;
  const safeName = name?.trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  if (!safeName) {
    return res.status(400).json({ error: "Le nom du client est requis." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE clients
      SET name = $1,
          address = $2,
          gps_lat = COALESCE($3, gps_lat),
          gps_lng = COALESCE($4, gps_lng),
          phone = $5,
          robot_model = $6
      WHERE id = $7
      RETURNING id, name, address, gps_lat, gps_lng, phone, robot_model
      `,
      [
        safeName,
        address || null,
        gps_lat ?? null,
        gps_lng ?? null,
        phone || null,
        robot_model || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Client introuvable." });
    }

    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/clients/:id/photos", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, client_id, filename, created_at
      FROM client_photos
      WHERE client_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/clients/:id/photos", upload.single("photo"), async (req, res) => {
  const id = Number(req.params.id);
  const filename = req.file?.filename;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  if (!filename) {
    return res.status(400).json({ error: "Aucun fichier recu." });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO client_photos (client_id, filename)
      VALUES ($1, $2)
      RETURNING id
      `,
      [id, filename]
    );

    res.status(201).json({
      id: result.rows[0].id,
      url: `/uploads/${filename}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/clients/:clientId/photos/:photoId", async (req, res) => {
  const clientId = Number(req.params.clientId);
  const photoId = Number(req.params.photoId);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: "Identifiant photo invalide." });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM client_photos
      WHERE id = $1 AND client_id = $2
      RETURNING filename
      `,
      [photoId, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Photo introuvable." });
    }

    const filename = path.basename(result.rows[0].filename || "");
    if (filename) {
      const filePath = path.join(uploadsDir, filename);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Impossible de supprimer le fichier photo:", err.message);
        }
      }
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------- MAINTENANCE PLANS ----------------------- */

function parseLocalDateTime(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsClamped(date, monthsToAdd) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + monthsToAdd);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function formatDbDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildMaintenanceDatesUntil(startAt, frequencyMonths, endAt) {
  const dates = [];
  let current = new Date(startAt);

  while (current <= endAt && dates.length < 60) {
    dates.push(new Date(current));
    current = addMonthsClamped(current, frequencyMonths);
  }

  return dates;
}

function getMaintenanceKitLabel(index) {
  return `Maintenance Kit N°${(index % 6) + 1}`;
}

async function attachGoogleEvent(interventionId) {
  const detail = await pool.query(
    `
    SELECT i.*, c.name AS client_name
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = $1
    `,
    [interventionId]
  );

  const intervention = detail.rows[0];
  if (!intervention) return;

  try {
    const googleEventId = await createGoogleEvent(intervention);
    if (googleEventId) {
      await pool.query(
        `UPDATE interventions
         SET google_event_id = $1
         WHERE id = $2`,
        [googleEventId, interventionId]
      );
    }
  } catch (e) {
    console.error("Erreur création event Google:", e.message);
  }
}

app.get("/api/clients/:id/maintenance-plans", async (req, res) => {
  const clientId = Number(req.params.id);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  try {
    const result = await pool.query(
      `
      SELECT mp.*,
             t.name AS technician_name,
             COUNT(i.id)::int AS generated_count,
             MIN(i.scheduled_at) FILTER (WHERE i.scheduled_at >= NOW()) AS next_scheduled_at
      FROM client_maintenance_plans mp
      LEFT JOIN technicians t ON mp.technician_id = t.id
      LEFT JOIN interventions i ON i.maintenance_plan_id = mp.id
      WHERE mp.client_id = $1
      GROUP BY mp.id, t.name
      ORDER BY mp.created_at DESC
      `,
      [clientId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/clients/:id/maintenance-plans", async (req, res) => {
  const clientId = Number(req.params.id);
  const {
    technician_id,
    start_at,
    end_at,
    frequency_months,
    duration_minutes,
    priority,
    description
  } = req.body;

  const startDate = parseLocalDateTime(start_at);
  const endDate = parseLocalDateTime(end_at);
  const safeFrequency = Number(frequency_months);
  const safeDuration = Math.min(Math.max(Number(duration_minutes || 60), 15), 480);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ error: "Identifiant client invalide." });
  }

  if (!startDate) {
    return res.status(400).json({ error: "Date de début invalide." });
  }

  if (!endDate) {
    return res.status(400).json({ error: "Date de fin de contrat invalide." });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: "La date de fin doit être après le premier passage." });
  }

  if (![3, 4, 6].includes(safeFrequency)) {
    return res.status(400).json({ error: "Fréquence de maintenance invalide." });
  }

  const dates = buildMaintenanceDatesUntil(startDate, safeFrequency, endDate);

  if (!dates.length) {
    return res.status(400).json({ error: "Aucune maintenance à créer sur cette période." });
  }

  try {
    const planResult = await pool.query(
      `
      INSERT INTO client_maintenance_plans
        (client_id, technician_id, start_at, end_at, frequency_months, occurrences, duration_minutes, priority, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
      `,
      [
        clientId,
        technician_id || null,
        formatDbDateTime(startDate),
        formatDbDateTime(endDate),
        safeFrequency,
        dates.length,
        safeDuration,
        priority || "Normale",
        description || "Maintenance contrat"
      ]
    );

    const planId = planResult.rows[0].id;
    const createdIds = [];

    for (const [index, date] of dates.entries()) {
      const kitLabel = getMaintenanceKitLabel(index);
      const baseDescription = description || "Maintenance contrat";

      const interventionResult = await pool.query(
        `
        INSERT INTO interventions
          (client_id, technician_id, scheduled_at, status, priority, description, duration_minutes, maintenance_plan_id, maintenance_kit_label)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
        `,
        [
          clientId,
          technician_id || null,
          formatDbDateTime(date),
          "A FAIRE",
          priority || "Normale",
          baseDescription,
          safeDuration,
          planId,
          kitLabel
        ]
      );
      const interventionId = interventionResult.rows[0].id;
      createdIds.push(interventionId);
    }

    for (const interventionId of createdIds) {
      await attachGoogleEvent(interventionId);
    }

    res.status(201).json({
      id: planId,
      intervention_ids: createdIds,
      count: createdIds.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------- TECHNICIANS ----------------------- */

app.get("/api/technicians", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, phone, email FROM technicians ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/technicians", async (req, res) => {
  const { name, phone, email, password } = req.body;
  const safeName = name?.trim();
  const safeEmail = email?.trim();

  if (!safeName) {
    return res.status(400).json({ error: "Le nom du technicien est requis." });
  }

  if (!password || password.length < 4) {
    return res
      .status(400)
      .json({ error: "Le mot de passe doit contenir au moins 4 caracteres." });
  }

  const { salt, hash } = hashPassword(password);

  try {
    const result = await pool.query(
      `INSERT INTO technicians (name, phone, email, password_salt, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [safeName, phone || null, safeEmail || null, salt, hash]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/technicians/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, phone, email } = req.body;
  const safeName = name?.trim();
  const safeEmail = email?.trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant technicien invalide." });
  }

  if (!safeName) {
    return res.status(400).json({ error: "Le nom du technicien est requis." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE technicians
      SET name = $1,
          phone = $2,
          email = $3
      WHERE id = $4
      RETURNING id, name, phone, email
      `,
      [safeName, phone || null, safeEmail || null, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Technicien introuvable." });
    }

    res.json({ technician: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/technicians/:id/password", async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body?.password;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant technicien invalide." });
  }

  if (!password || password.length < 4) {
    return res
      .status(400)
      .json({ error: "Le mot de passe doit contenir au moins 4 caracteres." });
  }

  const { salt, hash } = hashPassword(password);

  try {
    const result = await pool.query(
      `
      UPDATE technicians
      SET password_salt = $1,
          password_hash = $2
      WHERE id = $3
      RETURNING id
      `,
      [salt, hash, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Technicien introuvable." });
    }

    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/admin/login", async (req, res) => {
  const password = req.body?.password;

  if (!password) {
    return res.status(400).json({ error: "Mot de passe admin requis." });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Mot de passe admin invalide." });
  }

  res.json({
    user: {
      id: "admin",
      name: "Admin",
      role: "admin"
    }
  });
});

app.post("/api/auth/technician/login", async (req, res) => {
  const identifier = req.body?.identifier?.trim();
  const password = req.body?.password;

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ error: "Identifiant et mot de passe requis." });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, name, email, phone, password_salt, password_hash
      FROM technicians
      WHERE LOWER(name) = LOWER($1) OR LOWER(email) = LOWER($1)
      ORDER BY id ASC
      LIMIT 1
      `,
      [identifier]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Identifiants invalides." });
    }

    const technician = result.rows[0];
    let valid = false;

    if (!technician.password_hash || !technician.password_salt) {
      const fallbackPassword = technician.phone?.trim();
      valid = Boolean(fallbackPassword && password === fallbackPassword);

      if (valid) {
        const { salt, hash } = hashPassword(password);
        await pool.query(
          `
          UPDATE technicians
          SET password_salt = $1, password_hash = $2
          WHERE id = $3
          `,
          [salt, hash, technician.id]
        );
      }
    } else {
      valid = verifyPassword(
        password,
        technician.password_salt,
        technician.password_hash
      );
    }

    if (!valid) {
      return res.status(401).json({ error: "Identifiants invalides." });
    }

    res.json({
      user: {
        id: technician.id,
        name: technician.name,
        email: technician.email,
        role: "technician"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------- INTERVENTIONS ----------------------- */

app.get("/api/interventions", async (req, res) => {
  const { start, end } = req.query;

  let sql = `
    SELECT i.*,
           c.name AS client_name,
           t.name AS technician_name
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN technicians t ON i.technician_id = t.id
  `;
  const params = [];

  if (start && end) {
    sql += " WHERE i.scheduled_at BETWEEN $1 AND $2";
    params.push(start, end);
  }

  sql += " ORDER BY i.scheduled_at";

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/interventions/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const inter = await pool.query(
      `
      SELECT 
        i.id,
        i.client_id,
        i.technician_id,
        to_char(i.scheduled_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at,
        i.status,
        i.priority,
        i.description,
        i.duration_minutes,
        i.maintenance_kit_label,
        c.name AS client_name,
        c.address,
        c.gps_lat,
        c.gps_lng,
        c.robot_model,
        t.name AS technician_name
      FROM interventions i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN technicians t ON i.technician_id = t.id
      WHERE i.id = $1
      `,
      [id]
    );

    if (!inter.rows.length)
      return res.status(404).json({ error: "Not found" });

    const notes = await pool.query(
      "SELECT * FROM notes WHERE intervention_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const photos = await pool.query(
      "SELECT * FROM photos WHERE intervention_id = $1 ORDER BY created_at DESC",
      [id]
    );

    res.json({
      intervention: inter.rows[0],
      notes: notes.rows,
      photos: photos.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/interventions", async (req, res) => {
  const {
  client_id,
  technician_id,
  scheduled_at,
  status,
  priority,
  description,
  duration_minutes
} = req.body;


  try {
    // 1) on insère l'intervention
    const result = await pool.query(
      `INSERT INTO interventions
      (client_id, technician_id, scheduled_at, status, priority, description, duration_minutes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id`,
      [
        client_id,
        technician_id,
        scheduled_at,
        status,
        priority,
        description,
        duration_minutes || 60
      ]

    );

    const newId = result.rows[0].id;

    // 2) on récupère l'intervention + client pour créer l'event Google
    const detail = await pool.query(
      `
        SELECT i.*, c.name AS client_name
        FROM interventions i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.id = $1
      `,
      [newId]
    );

    const intervention = detail.rows[0];

    // 3) on crée l'event Google
    let googleEventId = null;
    try {
      googleEventId = await createGoogleEvent(intervention);
    } catch (e) {
      console.error("Erreur création event Google:", e.message);
    }

    // 4) on stocke l'id de l'event Google si dispo
    if (googleEventId) {
      await pool.query(
        `UPDATE interventions
         SET google_event_id = $1
         WHERE id = $2`,
        [googleEventId, newId]
      );
    }

    res.status(201).json({ id: newId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put("/api/interventions/:id", async (req, res) => {
  const id = req.params.id;
  const {
    client_id,
    technician_id,
    status,
    priority,
    description,
    scheduled_at,
    duration_minutes
  } = req.body;

  try {
    // récupérer l'intervention avant modif pour avoir google_event_id
    const before = await pool.query(
      "SELECT google_event_id FROM interventions WHERE id = $1",
      [id]
    );

    const googleEventId = before.rows[0]?.google_event_id || null;

    // mise à jour en base
    await pool.query(
      `UPDATE interventions
       SET client_id=$1,
           technician_id=$2,
           status=$3,
           priority=$4,
           description=$5,
           scheduled_at=$6,
           duration_minutes=$7
       WHERE id=$8`,
      [
        client_id,
        technician_id || null,
        status,
        priority,
        description,
        scheduled_at,
        duration_minutes || 60,
        id
      ]
    );

    // mise à jour Google
    try {
      await updateGoogleEvent(googleEventId, scheduled_at);
    } catch (e) {
      console.error("Erreur maj event Google:", e.message);
    }

    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/interventions/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant intervention invalide." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM interventions WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Intervention introuvable." });
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ----------------------- NOTES & PHOTOS ----------------------- */

app.post("/api/interventions/:id/notes", async (req, res) => {
  const intervention_id = req.params.id;
  const { author, content } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO notes (intervention_id, author, content)
       VALUES ($1,$2,$3) RETURNING id`,
      [intervention_id, author, content]
    );
    res.status(201).json({ id: result.rows[0].id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/interventions/:id/photos", upload.single("photo"), async (req, res) => {
  const intervention_id = req.params.id;
  const filename = req.file?.filename;

  if (!filename) {
    return res.status(400).json({ error: "Aucun fichier recu." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO photos (intervention_id, filename)
       VALUES ($1,$2) RETURNING id`,
      [intervention_id, filename]
    );

    res.status(201).json({
      id: result.rows[0].id,
      url: `/uploads/${filename}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/interventions/:interventionId/photos/:photoId", async (req, res) => {
  const interventionId = Number(req.params.interventionId);
  const photoId = Number(req.params.photoId);

  if (!Number.isInteger(interventionId) || interventionId <= 0) {
    return res.status(400).json({ error: "Identifiant intervention invalide." });
  }

  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: "Identifiant photo invalide." });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM photos
      WHERE id = $1 AND intervention_id = $2
      RETURNING filename
      `,
      [photoId, interventionId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Photo introuvable." });
    }

    const filename = path.basename(result.rows[0].filename || "");
    if (filename) {
      const filePath = path.join(uploadsDir, filename);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Impossible de supprimer le fichier photo:", err.message);
        }
      }
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------- ROOT ----------------------- */

app.get("/", (req, res) => {
  res.send("Maintenance Planner API - PostgreSQL Ready 🚀");
});

/* ----------------------- START SERVER ----------------------- */

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
