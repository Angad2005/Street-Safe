import z from "zod";
import { Router } from "express";

import { authService, sessionService } from "~/services/auth";
import { getProvider, validProviderKeySchema } from "~/services/auth/providers";
import { idpService } from "~/services/idp";
import { userService } from "~/services/user";

import { ApplicationError } from "~/lib/errors";
import { getValidated, validate } from "~/lib/validation";
import { signedBlob } from "~/lib/validation/signed";

import db from "~/lib/db";

const router = Router();

const exchangeSchema = z.object({
  exchangeContextId: signedBlob.nonoptional()
});

class UnknownExchangeContextError extends ApplicationError {
  constructor() {
    super({
      code: "exchange_context_wrong_state",
      message: "Exchange Context is not in the correct state to exchange a token",
      httpStatus: 400,
      context: null
    });
  }
}

router.post(
  "/exchange",
  validate({ body: exchangeSchema }),
  async (req, res) => {
    const { exchangeContextId } = getValidated(req, exchangeSchema);
    const exchangedAccountId = authService.getAccountIdFromExchangeContext(exchangeContextId);

    if (!exchangedAccountId) {
      throw new UnknownExchangeContextError();
    }


    const session = db.transaction(() => {
      authService.invalidateExchangeToken(exchangeContextId);
      return sessionService.createSession(exchangedAccountId);
    })();

    res.json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString()
    });
  }
)

const paramsSchema = z.object({
  provider: validProviderKeySchema
});

router.get(
  "/providers/:provider", 
  validate({ params: paramsSchema }),
  (req, res) => {
    const { provider: providerId } = getValidated(req, paramsSchema);
    const { authorizeUrl, exchangeContextId } = authService.createContext(providerId);

    res.json({
      authorizeUrl,
      exchangeContextId
    })
  }
);

const callbackQueryParamsSchema = z.object({
  code: z.string(),
  state: signedBlob.nonoptional()
});

router.get(
  "/providers/:provider/callback",
  validate({ 
    params: paramsSchema,
    query: callbackQueryParamsSchema 
  }),
  async (req, res) => {
    const { provider: providerId } = getValidated(req, paramsSchema);
    const { code, state } = getValidated(req, callbackQueryParamsSchema);

    const oauthProviderService = getProvider(providerId);
    const data = await oauthProviderService.handleCallback(code);

    
    db.transaction(() => {
      const userId = userService.createOrUpdateFromIdentity(
        providerId,
        data.identity
      );

      idpService.createEntry(
        data.identity.subject,
        providerId,
        data.tokens
      );

      authService.trackExchange(state, userId);
    })();
   
    res.status(200).end("OK");

  }
);

export default router;