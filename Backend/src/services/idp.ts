import db from "~/lib/db";
import { currentUnixSeconds, toUnixSeconds } from "~/lib/time";

import type { ProviderKey } from "./auth/providers";
import type { OAuthTokens } from "./auth/providers/types";

let _sweepIntervalHandle: NodeJS.Timeout | null = null;
const SWEEP_INTERVAL: number = 30 * 1000;

export const makeQualifiedSubject = (
  provider: ProviderKey,
  subject: string
) => `${provider}.${subject}`;

export const init = () => {
  db.exec(
    `CREATE TABLE IF NOT EXISTS identity_provider_tokens (
      subject VARCHAR(255) NOT NULL,
      access_token VARCHAR(1024) NOT NULL,
      refresh_token VARCHAR(1024),
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      FOREIGN KEY (subject) REFERENCES users (identity_provider_subject)
    );

    CREATE INDEX IF NOT EXISTS idx_identity_provider_tokens_non_refreshable_no_refresh_token_query ON identity_provider_tokens (refresh_token, access_token_expires_at);
    CREATE INDEX IF NOT EXISTS idx_identity_provider_tokens_non_refreshable_refresh_token_expired ON identity_provider_tokens (refresh_token);
    `
  );

  _sweepIntervalHandle = setInterval(
    sweep,
    SWEEP_INTERVAL
  );
}

const createEntry = (
  subject: string,
  provider: ProviderKey,
  tokens: OAuthTokens
) => {
  db.prepare(
    `
    INSERT INTO identity_provider_tokens (subject, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at)
    VALUES (?, ?, ?, ?, ?);
    `
  ).run(
    makeQualifiedSubject(provider, subject), 
    tokens.accessToken,
    tokens.refreshToken ?? null,
    toUnixSeconds(tokens.accessTokenExpiresAt),
    tokens.refreshTokenExpiresAt ? toUnixSeconds(tokens.refreshTokenExpiresAt) : null
  );
};

const deleteExpiredAndNonRefreshableIdpTokenEntries = () => {
  db.prepare(
    `
    DELETE FROM identity_provider_tokens 
    WHERE 
      (refresh_token = NULL AND access_token_expires_at < ?) OR 
      (refresh_token_expires_at < ?);
    `
  ).run(
    currentUnixSeconds(),
    currentUnixSeconds()
  );
};

const sweep = () => {
  deleteExpiredAndNonRefreshableIdpTokenEntries();
};

export const idpService = {
  createEntry,
}