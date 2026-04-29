import Database from "better-sqlite3";

import { generateSignedRandomBytes } from "~/lib/crypto/random";
import { currentUnixSeconds } from "~/lib/time";

export const EXCHANGE_CONTEXT_ID_SIZE = 64;
export const CACHE_DB = new Database(":memory:");
const EXPIRES_AFTER = 60 * 5;

let _sweepIntervalHandle: NodeJS.Timeout | null = null;

export const init = () => {
  CACHE_DB.exec(
    `CREATE TABLE exchange_tokens (
      token BLOB(${EXCHANGE_CONTEXT_ID_SIZE}) PRIMARY KEY,
      state BLOB(255),
      exchanged_account_id INTEGER DEFAULT NULL,
      expires_at INTEGER NOT NULL
    );`
  );

  _sweepIntervalHandle = setInterval(
    sweep,
    30_000
  );
};

export const teardown = () => {
  CACHE_DB.exec(`DROP TABLE exchange_tokens;`);
  
  if (_sweepIntervalHandle !== null) {
    clearInterval(_sweepIntervalHandle);
  }
}

export const sweep = () => {
  CACHE_DB.prepare(`DELETE FROM exchange_tokens WHERE expires_at < ?;`).run(currentUnixSeconds());
}

const generateSignedId = () => generateSignedRandomBytes(EXCHANGE_CONTEXT_ID_SIZE);

export const create = (
  associatedState: Buffer
): string => {
  const { raw, signed } = generateSignedId();

  CACHE_DB.prepare("INSERT INTO exchange_tokens (token, state, expires_at) VALUES (?, ?, ?);")
    .run(raw, associatedState, currentUnixSeconds() + EXPIRES_AFTER);

  return signed;
}

export const updateTokenUsingState = (state: Buffer, exchangedAccountId: number) => {
  CACHE_DB
    .prepare("UPDATE exchange_tokens SET exchanged_account_id = ? WHERE state = ?;")
    .run(exchangedAccountId, state);
}


export const getExchangedAccountIdForToken = (token: Buffer): number | null => {
  const result = CACHE_DB
    .prepare("SELECT exchanged_account_id FROM exchange_tokens WHERE token = ? AND expires_at > ?;")
    .get(token, currentUnixSeconds()) as { exchanged_account_id: number };

  return result?.exchanged_account_id ?? null;
}

export const markUsed = (token: Buffer) => {
  CACHE_DB.prepare("DELETE FROM exchange_tokens WHERE token = ?;").run(token);
}