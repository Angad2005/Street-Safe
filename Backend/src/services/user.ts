import db from "~/lib/db";

import type { Identity } from "./auth/providers/types";

import { ProviderKey } from "./auth/providers";
import { makeQualifiedSubject } from "./idp";


export const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      identity_provider_subject VARCHAR(1024) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(512) NOT NULL
    );
  `);
}

const createOrUpdateFromIdentity = (provider: ProviderKey, identity: Identity) => {
  const result = db.prepare(
    `
    INSERT INTO users (identity_provider_subject, name, email, avatar_url) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(identity_provider_subject) DO UPDATE SET name=?, email=?, avatar_url=?
    RETURNING id;
    `
  ).get(
    makeQualifiedSubject(
      provider,
      identity.subject
    ), 
    identity.name, identity.email, identity.avatarUrl,
    identity.name, identity.email, identity.avatarUrl
  ) as { id: number };

  return result.id;
};

const getById = (userId: number) => {
  const result = db.prepare(
    `SELECT id, name, email, avatar_url as avatarUrl FROM users WHERE id=?`
  ).get(userId) as { id: number, name: string, email: string, avatarUrl: string } | null;

  return result;
}

const getIdByEmail = (email: string): number|null => {
  const result = db.prepare(
    `SELECT id FROM users WHERE email=?`
  ).get(email) as { id: number } | null;

  return result?.id ?? null;
}

export const userService = {
  init,
  createOrUpdateFromIdentity,
  getById,
  getIdByEmail
}