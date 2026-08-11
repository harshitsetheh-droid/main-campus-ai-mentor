import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : "campus-ai-mentor-dev-secret");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

export function signToken(userId, username) {
  return jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Express middleware: requires a valid Bearer token
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.id;
    req.username = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
