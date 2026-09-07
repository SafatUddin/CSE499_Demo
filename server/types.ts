import type express from 'express';

// Populated by the express.json() verify callback (see server.ts) so webhook signature
// verification (Meta requires HMAC over the raw, unparsed body) has something to check
// against — req.body alone is already JSON-parsed by the time a route handler sees it.
export type RequestWithRawBody = express.Request & {
  rawBody?: Buffer;
};
