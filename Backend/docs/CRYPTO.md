# Cryptographic Library

## HMAC

The HMAC library in `lib/crypto/hmac.ts` provides a `sign` and `verify` function
that signs and verifies a `blob` (as a `Buffer` in nodejs), encoding it as a two-part
`base64url` string, as `{data}.{signature}`, where:
- `data` is a `base64url` encoded form of the blob input
- `signature` is a `base64url` encoded form of a HMAC using `sha384`.

Note that `data` is *NOT* encrypted in any manner, so should be treated as readable 
by others.

The data is secured using `HMAC_SIGNATURE_SECRET` configured as an environment variable. 

### Exceptions

The following exceptions can be raised in the following cases:
- `InvalidFormatError`: The data provided is not a valid form of signed data.
- `SignatureMismatchError`: The calculated signature of the blob does not match the 
  signature provided by the caller.

## Random

The random library in `lib/crypto/random.ts` provides a few helpers:

- `generateRandomBytes`: A wrapper for `crypto.randomBytes` from `node:crypto`.
- `generateSignedRandomBytes`: Generates random bytes, and calculates a signed
  version of them. Useful for authentication tokens, device ids, etc.

It consists of passthroughs to cryptographically secure random byte generators.