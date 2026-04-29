import { expect, suite, test, beforeEach, afterEach } from "vitest";
import * as context from "./context";
import { generateRandomBytes } from "~/lib/crypto/random";
import { verify } from "~/lib/crypto/hmac";
import { currentUnixSeconds } from "~/lib/time";

suite("Auth Context Tracker", () => {
  // Reset the database each time we run a test.
  beforeEach(() => context.init());
  afterEach(() => context.teardown());

  test("`init` creates an in-memory table called 'exchange_tokens'", () => {
    const result = context.CACHE_DB.prepare("SELECT count(*) as count FROM sqlite_schema WHERE name = 'exchange_tokens';")
      .get() as { count: number };
    expect(result["count"], "init() should setup an in-memory table called 'exchange_tokens'").toEqual(1);
  });

  test("Creating a new exchange token associated with a state stores it in the db", () => {
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);
    context.create(randomState);

    const result = context.CACHE_DB
      .prepare("SELECT count(*) as count FROM exchange_tokens WHERE state = ?;")
      .get(randomState) as { count: number };

    expect(result["count"], "tracking an exchange context should create an entry in the 'exchange_tokens' table").toEqual(1);
  });

  test("Updating a token with an account id using the state should update the table", () => {
    const EXPECTED_ACCOUNT_ID = 1;
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);
    context.create(randomState);
    context.updateTokenUsingState(randomState, EXPECTED_ACCOUNT_ID);

    const result = context.CACHE_DB
      .prepare("SELECT count(*) as count FROM exchange_tokens WHERE state = ? AND exchanged_account_id = ?;")
      .get(randomState, EXPECTED_ACCOUNT_ID) as { count: number };

    expect(result["count"], "Updating an exchange context using a specific token w/ an exchanged account id should set the account id in the table").toEqual(1);
  });

  test("Getting an exchanged account id from a completed exchange should result in the id", () => {
    const EXPECTED_ACCOUNT_ID = 2;
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);

    const token = context.create(randomState);
    context.updateTokenUsingState(randomState, EXPECTED_ACCOUNT_ID);

    expect(
      context.getExchangedAccountIdForToken(verify(token))
    ).toEqual(EXPECTED_ACCOUNT_ID)
  });


  test("An expired token is not accessible via context.getExchangedAccountIdForToken", () => {
    // TODO: Just mock `currentUnixSeconds` as that is why it exists.
    const EXPECTED_ACCOUNT_ID = 2;
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);

    const token = context.create(randomState);
    context.updateTokenUsingState(randomState, EXPECTED_ACCOUNT_ID);

    context.CACHE_DB.prepare("UPDATE exchange_tokens SET expires_at = ?").run(currentUnixSeconds() - 1);

    expect(
      context.getExchangedAccountIdForToken(verify(token))
    ).toEqual(null);
  });

  test("Sweeping the db clears expired tokens out", () => {
    const EXPECTED_ACCOUNT_ID = 2;
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);

    const token = context.create(randomState);
    context.updateTokenUsingState(randomState, EXPECTED_ACCOUNT_ID);

    context.CACHE_DB.prepare("UPDATE exchange_tokens SET expires_at = ?").run(currentUnixSeconds() - 1);

    context.sweep();

    const result = context.CACHE_DB.prepare("SELECT count(*) as count FROM exchange_tokens;")
      .get() as { count: number };

    expect(result["count"], "Sweeping should clear the db of expired entries").toEqual(0);
  });

  test("Marking an exchange token as used makes it no longer accessible", () => {
    const EXPECTED_ACCOUNT_ID = 2;
    const randomState = generateRandomBytes(context.EXCHANGE_CONTEXT_ID_SIZE);

    const token = context.create(randomState);
    context.updateTokenUsingState(randomState, EXPECTED_ACCOUNT_ID);
    context.markUsed(verify(token));

    expect(
      context.getExchangedAccountIdForToken(verify(token)),
      "A used token should not be valid to get an exchanged account id"
    ).toEqual(null);
  })
});