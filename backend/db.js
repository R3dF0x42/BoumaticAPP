import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data.db");
const db = new sqlite3.Database(dbPath);

// Création des tables si elles n’existent pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      gps_lat REAL,
      gps_lng REAL,
      phone TEXT,
      robot_model TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      technician_id INTEGER,
      scheduled_at TEXT,
      status TEXT,
      priority TEXT,
      description TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intervention_id INTEGER,
      author TEXT,
      content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intervention_id) REFERENCES interventions(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intervention_id INTEGER,
      filename TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intervention_id) REFERENCES interventions(id)
    );
  `);
});

export default db;
