import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
let queue = Promise.resolve();

async function runQuery(sql, values) {
  if (values?.length) return database.query(sql, values);
  const results = await database.exec(sql);
  return results.at(-1) || { rows: [] };
}

class Pool {
  async connect() {
    const previous = queue;
    let unlock;
    queue = new Promise((resolve) => { unlock = resolve; });
    await previous;
    let released = false;
    return {
      query: runQuery,
      release() {
        if (released) throw new Error("Connection released twice");
        released = true;
        unlock();
      }
    };
  }

  async query(sql, values) {
    const client = await this.connect();
    try {
      return await client.query(sql, values);
    } finally {
      client.release();
    }
  }

  async end() {
    await queue;
    await database.close();
  }
}

export default { Pool };
