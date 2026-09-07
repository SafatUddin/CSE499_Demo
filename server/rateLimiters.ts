import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// In-memory store: fine for a single Node process. Multi-instance (e.g. multiple
// Railway replicas) would need a shared store for accurate global limits.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// No requireAuth on widget routes (public, keyed by widgetKey instead of a session),
// so cap by widgetKey+IP too — otherwise one abusive visitor or one abused store can
// exhaust Gemini calls for every other store sharing this process.
export const widgetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req, _res) => `${(req.body?.widgetKey || req.query?.widgetKey || '').toString()}:${ipKeyGenerator(req.ip || '')}`,
});
