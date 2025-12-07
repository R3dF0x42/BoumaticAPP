import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* -------------------------
   Create tables if missing
------------------------- */

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      gps_lat REAL,
      gps_lng REAL,
      phone TEXT,
      robot_model TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interventions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      technician_id INTEGER REFERENCES technicians(id),
      scheduled_at TIMESTAMP,
      status TEXT,
      priority TEXT,
      description TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      intervention_id INTEGER REFERENCES interventions(id),
      author TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      intervention_id INTEGER REFERENCES interventions(id),
      filename TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ PostgreSQL tables ready");
}

initDB().catch(console.error);

export default pool;
