/**
 * URLs that are used in the OAuth flow.
 */
interface ServiceUrls {
  /**
   * The base url to redirect the user to.
   */
  authorize: string;

  /**
   * The url used to exchange a code for a token.
   */
  token: string;
};


interface Identity {
  /**
   * A unique identifier in the context of the exchange 
   * (e.g., `sub` in google's `openidconnect` api). This value
   * should not change even if a value like the email in the 
   * identity changes (which may be the case).
   */
  subject: string;

  /**
   * The name of the user
   */
  name: string;

  /**
   * The email of the user
   */
  email: string;

  /**
   * The avatar url that can be fetched to produce an image.
   */
  avatarUrl: string;
};

interface OAuthTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
}

export type HandleCallbackResult = {
  tokens: OAuthTokens;
  identity: Identity;
};

export type Provider = {
  /**
   * An identifier like "google" to represent
   * the provider.
   */
  id: string;

  /**
   * The scopes that the oauth connection will request.
   */
  scopes: string[];

  /**
   * The client id to identify with the oauth provider.
   */
  clientId: string;

  /**
   * The type of access we require (e.g., offline).
   */
  accessType?: string;

  /**
   * The secret we use to exchange for a token with the 
   * provider.
   */
  clientSecret: string;
  urls: ServiceUrls;

  /**
   * Exchanges the code for a user object, and inserts this
   * into the db, returning the user id for the new (or pre-existing)
   * user.
   * 
   * @param code The code to exchange.
   * @returns A user ID
   */
  handleCallback: (code: string) => Promise<HandleCallbackResult>
};