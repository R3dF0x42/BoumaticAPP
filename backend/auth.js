import crypto from "crypto";

const SESSION_COOKIE = "boumatic-session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cookieOptions(req) {
  const sameSite = process.env.SESSION_COOKIE_SAME_SITE === "none" ? "none" : "lax";
  return {
    httpOnly: true,
    sameSite,
    secure: sameSite === "none" || req.secure || process.env.SESSION_COOKIE_SECURE === "true",
    path: "/"
  };
}

function readSessionToken(req) {
  const cookie = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1) || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function isAllowedOrigin(req) {
  const origin = req.get("Origin");
  if (!origin) return true;
  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return true;
  try {
    const originUrl = new URL(origin);
    const serverUrl = new URL(`${req.protocol}://${req.get("host")}`);
    return originUrl.hostname === serverUrl.hostname && originUrl.protocol === serverUrl.protocol;
  } catch {
    return false;
  }
}

export function createSessionAuth(pool, adminPassword) {
  const issueSession = async (req, res, user, credential) => {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    await pool.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
    await pool.query(
      `INSERT INTO user_sessions (token_hash, role, technician_id, credential_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [digest(token), user.role, user.role === "technician" ? user.id : null, digest(credential), expiresAt]
    );
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_LIFETIME_MS });
    res.set("Cache-Control", "no-store");
    return user;
  };

  const requireSession = asyncHandler(async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const token = readSessionToken(req);
    if (!token) return res.status(401).json({ error: "Veuillez vous reconnecter." });
    const result = await pool.query(
      `SELECT s.role, s.credential_hash, t.id, t.name, t.email, t.password_hash
       FROM user_sessions s
       LEFT JOIN technicians t ON t.id = s.technician_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [digest(token)]
    );
    const session = result.rows[0];
    const credential = session?.role === "admin" ? adminPassword : session?.password_hash;
    if (!session || !credential || session.credential_hash !== digest(credential)) {
      res.clearCookie(SESSION_COOKIE, cookieOptions(req));
      return res.status(401).json({ error: "Session expiree. Veuillez vous reconnecter." });
    }
    req.user = session.role === "admin"
      ? { id: "admin", name: "Admin", role: "admin" }
      : { id: session.id, name: session.name, email: session.email, role: "technician" };
    next();
  });

  const logout = asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (token) await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [digest(token)]);
    res.clearCookie(SESSION_COOKIE, cookieOptions(req));
    res.status(204).end();
  });

  return { issueSession, requireSession, logout };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Cette action est reservee a l'administrateur." });
  }
  next();
}

export function createLoginLimiter() {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) {
      if (value.expiresAt <= now) attempts.delete(key);
    }
    const key = `${req.ip}:${req.path}`;
    const attempt = attempts.get(key) || { count: 0, expiresAt: now + 15 * 60 * 1000 };
    if (attempt.count >= 20) {
      res.set("Retry-After", String(Math.ceil((attempt.expiresAt - now) / 1000)));
      return res.status(429).json({ error: "Trop de tentatives. Reessayez dans quelques minutes." });
    }
    attempt.count += 1;
    attempts.set(key, attempt);
    res.once("finish", () => {
      if (res.statusCode === 200) attempts.delete(key);
    });
    next();
  };
}
