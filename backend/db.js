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
        robot_model TEXT,
        commissioning_date DATE
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
        description TEXT,
        duration_minutes INTEGER DEFAULT 60 NOT NULL,
        maintenance_kit_label TEXT,
        maintenance_occurrence_index INTEGER,
        private_to_technician_id INTEGER,
        google_event_id TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS intervention_technicians (
        intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
        technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
        position INTEGER DEFAULT 0 NOT NULL,
        PRIMARY KEY (intervention_id, technician_id)
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
      CREATE TABLE IF NOT EXISTS client_maintenance_plans (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP,
        frequency_months INTEGER NOT NULL,
        occurrences INTEGER NOT NULL,
        duration_minutes INTEGER DEFAULT 60 NOT NULL,
        maintenance_type TEXT DEFAULT 'robot_1' NOT NULL,
        maintenance_kit_model TEXT DEFAULT 'gemini_up' NOT NULL,
        maintenance_kit_count INTEGER DEFAULT 6 NOT NULL,
        maintenance_kit_start_number INTEGER DEFAULT 1 NOT NULL,
        priority TEXT DEFAULT 'Normale' NOT NULL,
        deplacement_offert BOOLEAN DEFAULT FALSE NOT NULL,
        description TEXT,
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
      CREATE TABLE IF NOT EXISTS client_notes (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        author TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE client_notes
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    `);

    await client.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS commissioning_date DATE,
        ADD COLUMN IF NOT EXISTS deplacements_offerts_utilises INTEGER DEFAULT 0 NOT NULL,
        ALTER COLUMN gps_lat TYPE DOUBLE PRECISION,
        ALTER COLUMN gps_lng TYPE DOUBLE PRECISION;
      UPDATE clients
      SET deplacements_offerts_utilises = 0
      WHERE deplacements_offerts_utilises IS NULL;
    `);

    await client.query(`
      ALTER TABLE interventions
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS maintenance_kit_label TEXT,
        ADD COLUMN IF NOT EXISTS google_event_id TEXT,
        ADD COLUMN IF NOT EXISTS maintenance_plan_id INTEGER,
        ADD COLUMN IF NOT EXISTS maintenance_occurrence_index INTEGER,
        ADD COLUMN IF NOT EXISTS private_to_technician_id INTEGER,
        ALTER COLUMN status SET DEFAULT 'pending',
        ALTER COLUMN priority SET DEFAULT 'normal';
      UPDATE interventions SET duration_minutes = 60 WHERE duration_minutes IS NULL;
      UPDATE interventions SET status = 'pending' WHERE status IS NULL;
      UPDATE interventions SET priority = 'normal' WHERE priority IS NULL;
      ALTER TABLE interventions
        ALTER COLUMN duration_minutes SET DEFAULT 60,
        ALTER COLUMN duration_minutes SET NOT NULL,
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN priority SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE client_maintenance_plans
        ADD COLUMN IF NOT EXISTS technician_id INTEGER,
        ADD COLUMN IF NOT EXISTS end_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS maintenance_type TEXT,
        ADD COLUMN IF NOT EXISTS maintenance_kit_model TEXT,
        ADD COLUMN IF NOT EXISTS maintenance_kit_count INTEGER,
        ADD COLUMN IF NOT EXISTS maintenance_kit_start_number INTEGER,
        ADD COLUMN IF NOT EXISTS priority TEXT,
        ADD COLUMN IF NOT EXISTS deplacement_offert BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS description TEXT;
      UPDATE client_maintenance_plans SET duration_minutes = 60 WHERE duration_minutes IS NULL;
      UPDATE client_maintenance_plans SET maintenance_type = 'robot_1' WHERE maintenance_type IS NULL;
      UPDATE client_maintenance_plans SET maintenance_kit_model = 'gemini_up' WHERE maintenance_kit_model IS NULL;
      UPDATE client_maintenance_plans SET maintenance_kit_count = 6 WHERE maintenance_kit_count IS NULL;
      UPDATE client_maintenance_plans SET maintenance_kit_start_number = 1 WHERE maintenance_kit_start_number IS NULL;
      UPDATE client_maintenance_plans SET priority = 'Normale' WHERE priority IS NULL;
      UPDATE client_maintenance_plans SET deplacement_offert = FALSE WHERE deplacement_offert IS NULL;
      ALTER TABLE client_maintenance_plans
        ALTER COLUMN duration_minutes SET DEFAULT 60,
        ALTER COLUMN duration_minutes SET NOT NULL,
        ALTER COLUMN maintenance_type SET DEFAULT 'robot_1',
        ALTER COLUMN maintenance_type SET NOT NULL,
        ALTER COLUMN maintenance_kit_model SET DEFAULT 'gemini_up',
        ALTER COLUMN maintenance_kit_model SET NOT NULL,
        ALTER COLUMN maintenance_kit_count SET DEFAULT 6,
        ALTER COLUMN maintenance_kit_count SET NOT NULL,
        ALTER COLUMN maintenance_kit_start_number SET DEFAULT 1,
        ALTER COLUMN maintenance_kit_start_number SET NOT NULL,
        ALTER COLUMN priority SET DEFAULT 'Normale',
        ALTER COLUMN priority SET NOT NULL,
        ALTER COLUMN deplacement_offert SET DEFAULT FALSE,
        ALTER COLUMN deplacement_offert SET NOT NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_client_id_fkey;
        ALTER TABLE interventions ADD CONSTRAINT interventions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

        ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_technician_id_fkey;
        ALTER TABLE interventions ADD CONSTRAINT interventions_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL;

        ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_maintenance_plan_id_fkey;
        ALTER TABLE interventions ADD CONSTRAINT interventions_maintenance_plan_id_fkey FOREIGN KEY (maintenance_plan_id) REFERENCES client_maintenance_plans(id) ON DELETE SET NULL;

        ALTER TABLE intervention_technicians DROP CONSTRAINT IF EXISTS intervention_technicians_intervention_id_fkey;
        ALTER TABLE intervention_technicians ADD CONSTRAINT intervention_technicians_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

        ALTER TABLE intervention_technicians DROP CONSTRAINT IF EXISTS intervention_technicians_technician_id_fkey;
        ALTER TABLE intervention_technicians ADD CONSTRAINT intervention_technicians_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE;

        ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_intervention_id_fkey;
        ALTER TABLE notes ADD CONSTRAINT notes_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

        ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_intervention_id_fkey;
        ALTER TABLE photos ADD CONSTRAINT photos_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES interventions(id) ON DELETE CASCADE;

        ALTER TABLE client_photos DROP CONSTRAINT IF EXISTS client_photos_client_id_fkey;
        ALTER TABLE client_photos ADD CONSTRAINT client_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

        ALTER TABLE client_notes DROP CONSTRAINT IF EXISTS client_notes_client_id_fkey;
        ALTER TABLE client_notes ADD CONSTRAINT client_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

        ALTER TABLE client_maintenance_plans DROP CONSTRAINT IF EXISTS client_maintenance_plans_client_id_fkey;
        ALTER TABLE client_maintenance_plans ADD CONSTRAINT client_maintenance_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

        ALTER TABLE client_maintenance_plans DROP CONSTRAINT IF EXISTS client_maintenance_plans_technician_id_fkey;
        ALTER TABLE client_maintenance_plans ADD CONSTRAINT client_maintenance_plans_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL;
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

        IF NOT EXISTS (SELECT 1 FROM client_notes WHERE client_id IS NULL) THEN
          ALTER TABLE client_notes ALTER COLUMN client_id SET NOT NULL;
        END IF;
      END
      $$;
    `);

    await client.query(`
      WITH numbered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY maintenance_plan_id
            ORDER BY scheduled_at, id
          ) - 1 AS occurrence_index
        FROM interventions
        WHERE maintenance_plan_id IS NOT NULL
          AND maintenance_occurrence_index IS NULL
      )
      UPDATE interventions i
      SET maintenance_occurrence_index = numbered.occurrence_index
      FROM numbered
      WHERE i.id = numbered.id;
    `);

    await client.query(`
      INSERT INTO intervention_technicians (intervention_id, technician_id, position)
      SELECT id, technician_id, 0
      FROM interventions
      WHERE technician_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_interventions_client_id ON interventions(client_id);
      CREATE INDEX IF NOT EXISTS idx_interventions_technician_id ON interventions(technician_id);
      CREATE INDEX IF NOT EXISTS idx_interventions_scheduled_at ON interventions(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_plan_id ON interventions(maintenance_plan_id);
      CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_occurrence ON interventions(maintenance_plan_id, maintenance_occurrence_index);
      CREATE INDEX IF NOT EXISTS idx_interventions_private_to_technician_id ON interventions(private_to_technician_id);
      CREATE INDEX IF NOT EXISTS idx_intervention_technicians_intervention_id ON intervention_technicians(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_intervention_technicians_technician_id ON intervention_technicians(technician_id);
      CREATE INDEX IF NOT EXISTS idx_client_maintenance_plans_client_id ON client_maintenance_plans(client_id);
      CREATE INDEX IF NOT EXISTS idx_notes_intervention_id ON notes(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_photos_intervention_id ON photos(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_client_photos_client_id ON client_photos(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
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
