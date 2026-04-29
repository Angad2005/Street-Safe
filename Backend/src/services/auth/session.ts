import { generateSignedRandomBytes } from "~/lib/crypto/random";
import db from "~/lib/db";

// 7 days
const DEFAULT_SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_ENTROPY = 64;

export const init = () => {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS sessions (
      token BLOB(${TOKEN_ENTROPY}) PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
    `
  );
}

const createSession = (userId: number) => {
  const { raw, signed } = generateSignedRandomBytes(TOKEN_ENTROPY);

  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + DEFAULT_SESSION_EXPIRY_SECONDS;

  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?);")
    .run(raw, userId, createdAt, expiresAt);

  
  return {
    token: signed,
    expiresAt: new Date(expiresAt * 1000)
  }
}

const deleteSession = (token: Buffer) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

const getSession = (token: Buffer) => {
  const result = db.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > unixepoch();")
    .get(token) as ({ user_id: number } | undefined);

  return result?.user_id ?? null;
}

export const sessionService = {
  createSession,
  deleteSession,
  getSession
}