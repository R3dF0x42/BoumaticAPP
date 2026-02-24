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
          gps_lat = $3,
          gps_lng = $4,
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
  const { status, priority, description, scheduled_at } = req.body;

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
       SET status=$1, priority=$2, description=$3, scheduled_at=$4
       WHERE id=$5`,
      [status, priority, description, scheduled_at, id]
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
  const filename = req.file.filename;

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

/* ----------------------- ROOT ----------------------- */

app.get("/", (req, res) => {
  res.send("Maintenance Planner API - PostgreSQL Ready 🚀");
});

/* ----------------------- START SERVER ----------------------- */

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
