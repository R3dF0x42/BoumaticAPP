import pg from "pg";

const { Pool } = pg;

function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const useSsl = parseBooleanEnv(
  process.env.DB_SSL,
  process.env.NODE_ENV === "production"
);

const sslConfig = useSsl
  ? {
      rejectUnauthorized: parseBooleanEnv(
        process.env.DB_SSL_REJECT_UNAUTHORIZED,
        false
      )
    }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

/* -------------------------
   Create tables if missing
------------------------- */

async function initDB() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        gps_lat DOUBLE PRECISION,
        gps_lng DOUBLE PRECISION,
        phone TEXT,
        robot_model TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS technicians (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        password_salt TEXT,
        password_hash TEXT
      );
    `);

    await client.query(`
      ALTER TABLE technicians
        ADD COLUMN IF NOT EXISTS password_salt TEXT,
        ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS interventions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP,
        status TEXT DEFAULT 'pending' NOT NULL,
        priority TEXT DEFAULT 'normal' NOT NULL,
        description TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
        author TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
        filename TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_photos (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        filename TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE clients
        ALTER COLUMN gps_lat TYPE DOUBLE PRECISION,
        ALTER COLUMN gps_lng TYPE DOUBLE PRECISION;
    `);

    await client.query(`
      ALTER TABLE interventions
        ALTER COLUMN status SET DEFAULT 'pending',
        ALTER COLUMN priority SET DEFAULT 'normal';
      UPDATE interventions SET status = 'pending' WHERE status IS NULL;
      UPDATE interventions SET priority = 'normal' WHERE priority IS NULL;
      ALTER TABLE interventions
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN priority SET NOT NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_client_id_fkey;
        ALTER TABLE interventions ADD CONSTRAINT interventions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

        ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_technician_id_fkey;
        ALTER TABLE interventions ADD CONSTRAINT interventions_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL;

        ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_intervention_id_fkey;
        ALTER TABLE notes ADD CONSTRAINT notes_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

        ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_intervention_id_fkey;
        ALTER TABLE photos ADD CONSTRAINT photos_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

        ALTER TABLE client_photos DROP CONSTRAINT IF EXISTS client_photos_client_id_fkey;
        ALTER TABLE client_photos ADD CONSTRAINT client_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM interventions WHERE client_id IS NULL) THEN
          ALTER TABLE interventions ALTER COLUMN client_id SET NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM notes WHERE intervention_id IS NULL) THEN
          ALTER TABLE notes ALTER COLUMN intervention_id SET NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM photos WHERE intervention_id IS NULL) THEN
          ALTER TABLE photos ALTER COLUMN intervention_id SET NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM client_photos WHERE client_id IS NULL) THEN
          ALTER TABLE client_photos ALTER COLUMN client_id SET NOT NULL;
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_interventions_client_id ON interventions(client_id);
      CREATE INDEX IF NOT EXISTS idx_interventions_technician_id ON interventions(technician_id);
      CREATE INDEX IF NOT EXISTS idx_notes_intervention_id ON notes(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_photos_intervention_id ON photos(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_client_photos_client_id ON client_photos(client_id);
    `);

    await client.query("COMMIT");
    console.log("PostgreSQL tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

initDB().catch(console.error);

export default pool;
