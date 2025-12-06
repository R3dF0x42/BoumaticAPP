import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// UPLOADS
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

/* -------- CLIENTS -------- */

app.get("/api/clients", (req, res) => {
  db.all("SELECT * FROM clients ORDER BY name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/clients", (req, res) => {
  const { name, address, gps_lat, gps_lng, phone, robot_model } = req.body;
  db.run(
    `INSERT INTO clients (name, address, gps_lat, gps_lng, phone, robot_model)
     VALUES (?,?,?,?,?,?)`,
    [name, address, gps_lat, gps_lng, phone, robot_model],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

/* -------- TECHNICIANS -------- */

app.get("/api/technicians", (req, res) => {
  db.all("SELECT * FROM technicians ORDER BY name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/technicians", (req, res) => {
  const { name, phone, email } = req.body;
  db.run(
    `INSERT INTO technicians (name, phone, email) VALUES (?,?,?)`,
    [name, phone, email],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

/* -------- INTERVENTIONS -------- */

app.get("/api/interventions", (req, res) => {
  const { date } = req.query;
  let sql = `
    SELECT i.*, c.name AS client_name, c.address, c.gps_lat, c.gps_lng
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
  `;
  const params = [];

  if (date) {
    sql += " WHERE date(i.scheduled_at) = date(?)";
    params.push(date);
  }

  sql += " ORDER BY i.scheduled_at";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/interventions/:id", (req, res) => {
  const id = req.params.id;
  db.get(
    `
    SELECT i.*, c.name AS client_name, c.address, c.gps_lat, c.gps_lng, c.robot_model
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `,
    [id],
    (err, intervention) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!intervention) return res.status(404).json({ error: "Not found" });

      db.all(
        "SELECT * FROM notes WHERE intervention_id = ? ORDER BY created_at DESC",
        [id],
        (err2, notes) => {
          if (err2) return res.status(500).json({ error: err2.message });

          db.all(
            "SELECT * FROM photos WHERE intervention_id = ? ORDER BY created_at DESC",
            [id],
            (err3, photos) => {
              if (err3) return res.status(500).json({ error: err3.message });
              res.json({ intervention, notes, photos });
            }
          );
        }
      );
    }
  );
});

app.post("/api/interventions", (req, res) => {
  const {
    client_id,
    technician_id,
    scheduled_at,
    status,
    priority,
    description
  } = req.body;

  db.run(
    `INSERT INTO interventions
     (client_id, technician_id, scheduled_at, status, priority, description)
     VALUES (?,?,?,?,?,?)`,
    [client_id, technician_id, scheduled_at, status, priority, description],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ✨ ICI : on ajoute scheduled_at dans la mise à jour
app.put("/api/interventions/:id", (req, res) => {
  const id = req.params.id;
  const { status, priority, description, scheduled_at } = req.body;

  db.run(
    `UPDATE interventions
     SET status = ?, priority = ?, description = ?, scheduled_at = ?
     WHERE id = ?`,
    [status, priority, description, scheduled_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

/* -------- NOTES & PHOTOS -------- */

app.post("/api/interventions/:id/notes", (req, res) => {
  const intervention_id = req.params.id;
  const { author, content } = req.body;

  db.run(
    `INSERT INTO notes (intervention_id, author, content)
     VALUES (?,?,?)`,
    [intervention_id, author, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.post(
  "/api/interventions/:id/photos",
  upload.single("photo"),
  (req, res) => {
    const intervention_id = req.params.id;
    const filename = req.file.filename;

    db.run(
      `INSERT INTO photos (intervention_id, filename)
       VALUES (?,?)`,
      [intervention_id, filename],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          id: this.lastID,
          url: `/uploads/${filename}`
        });
      }
    );
  }
);

app.get("/", (req, res) => {
  res.send("Maintenance Planner API");
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
