# Authentication

Authentication is done via oauth2/openid connect.

## Setting up Google OAuth2

To use Google's OAuth2, do the following steps:
- Go to `console.cloud.google.com`
- Create a new project.
- Go to sidebar, then `APIs and services`, then `Credentials`.
- Click `Create credentials`.
- Click `OAuth client ID`.
- Complete the `OAuth` setup.
- Click `Create credentails` (if required).
- Select `Web application` as the type. Fill out the form.
- Set `{host}/oauth2/providers/google/callback` as a callback URI, where `host` is where your service is accessible (e.g., `http://localhost:3000`, `https://myservice.example.com`).
- Copy your client id and client secret, and add them as environment variables:
  - `OAUTH_BASE_URL` is the same as `{host}`
  - `OAUTH_GOOGLE_CLIENT_ID` is the client id.
  - `OAUTH_GOOGLE_CLIENT_SECRET` is the client secret.

Test out your OAuth2 login using the web app.

## Usage in server-side routes

To access the authentication state in a route, use the `getUserId` helper in `src/services/auth/middleware`:

```ts
import { authenticate, getUserId } from "./services/auth/middleware";

// ...

router.get(
  "/path",
  authenticate({ required: true }),
  (req, res) => {
    const userId = getUserId(req)!;
    res.end("user id is " + userId.toString());
  }
);
```

In this case, we can ignore the `null` case since `required` is set to true in the middleware.

The `!` operator eliminates nullish types, so `userId` is `number` instead of `number | null`.


### Error Cases

Errors raised by the `authenticate` middleware are expected and handled by the `handleError` middleware.

In the case that `required` is false, `getUserId` may return a number or null, based on whether or not 
the `Authorization` header was present and valid:
- If there is no `Authorization` header present, it is treated as no user being present, then the handler runs and `userId` is null.
- If there is an `Authorization` header present, but the token is not signed correctly, isn't known to us as a session, or is expired then the request is rejected.
- If there is an `Authorization` header present, and it is valid by all measures, then the handler runs and `userId` is non-null.

In the case that `required` is true:
- If there is no `Authorization` header present, the request is rejected.
- If the `Authorization` header is not signed correctly, then the request is rejected.
- If the session is expired, the request is rejected.
- Otherwise, the request is valid and the handler runs with `userId` being non-null.

## Flow

The OAuth2 flow is complicated by the fact that we can't trust the client, so we want to try and minimise
its interaction in the exchange process. To do this, the following design was chosen:
- The client sends a request to `/oauth2/providers/{provider}`, where `{provider}` is one of:
  - `google`

  The client is returned two values:
    - `authorizeUrl`: The url to redirect the client to.
    - `exchangeContextId`: The ID of the exchange context. This will be used in future and needs to be kept.
  
- The client goes through the exchange process, and is redirected back to `/oauth2/providers/{provider}/callback`.
- The `callback` endpoint validates that the `state` matches that of the `authorizeUrl`'s state, and exchanges the `code` for tokens. The tokens are used to fetch a profile.
- The client issues a request to `/oauth2/exchange`, with a body of `{"exchangeContextId":"..."}` with the exchange context id previously generated.
- The client is returned a `token` and a time that the token expires at (`expiresAt`). The token can be used in subsequent requests up until `expiresAt`.

