import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";


const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

/* ------------------------- POSTGRES CONNECTION ------------------------- */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* TEST DATABASE CONNECTION */
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ PostgreSQL error", err));

app.use(cors());
app.use(express.json());

/* ------------------------- UPLOADS ------------------------- */

const uploadsDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  }
});
const upload = multer({ storage });
app.use("/uploads", express.static(uploadsDir));

/* ------------------------- CLIENTS ------------------------- */

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

/* ------------------------- TECHNICIANS ------------------------- */

app.get("/api/technicians", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM technicians ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/technicians", async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO technicians (name, phone, email)
       VALUES ($1,$2,$3) RETURNING id`,
      [name, phone, email]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------- INTERVENTIONS ------------------------- */

app.get("/api/interventions", async (req, res) => {
  const { date } = req.query;
  let sql = `
    SELECT i.*, 
           c.name AS client_name, c.address, c.gps_lat, c.gps_lng,
           t.name AS technician_name
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN technicians t ON i.technician_id = t.id
  `;
  const params = [];

  if (date) {
    sql += " WHERE DATE(i.scheduled_at) = $1";
    params.push(date);
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
      SELECT i.*, 
             c.name AS client_name, c.address, c.gps_lat, c.gps_lng, c.robot_model,
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
    description
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO interventions
       (client_id, technician_id, scheduled_at, status, priority, description)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [client_id, technician_id, scheduled_at, status, priority, description]
    );

    res.status(201).json({ id: result.rows[0].id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/interventions/:id", async (req, res) => {
  const id = req.params.id;
  const { status, priority, description, scheduled_at } = req.body;

  try {
    await pool.query(
      `UPDATE interventions
       SET status=$1, priority=$2, description=$3, scheduled_at=$4
       WHERE id=$5`,
      [status, priority, description, scheduled_at, id]
    );

    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------- NOTES & PHOTOS ------------------------- */

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

/* ------------------------- ROOT ------------------------- */

app.get("/", (req, res) => {
  res.send("Maintenance Planner API - PostgreSQL Ready 🚀");
});

/* ------------------------- START SERVER ------------------------- */

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
