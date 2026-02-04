import arcjet, {
  detectBot,
  shield,
  slidingWindow,
  tokenBucket,
} from '@arcjet/node';

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE';

if (!arcjetKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ARCJET_KEY is required in production');
  }
  console.warn('ARCJET_KEY not set; ArcJet protections are disabled.');
}

export const httpArcJet = arcjetKey
  ? arcjet({
      key: arcjetKey, // Get your site key from https://app.arcjet.com
      rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: arcjetMode }),
        // Create a bot detection rule
        detectBot({
          mode: arcjetMode, // Blocks requests. Use "DRY_RUN" to log only
          // Block all bots except the following
          allow: [
            'CATEGORY:SEARCH_ENGINE', // Google, Bing, etc
            'CATEGORY:PREVIEW', // Link previews e.g. Slack, Discord
          ],
        }),
        slidingWindow({ mode: arcjetMode, interval: '10s', max: 50 }), // Additional rate limit: max 50 requests per 10 seconds
      ],
    })
  : null;

export const wsArcJet = arcjetKey
  ? arcjet({
      key: arcjetKey, // Get your site key from https://app.arcjet.com
      rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: arcjetMode }),
        // Create a bot detection rule
        detectBot({
          mode: arcjetMode, // Blocks requests. Use "DRY_RUN" to log only
          // Block all bots except the following
          allow: [
            'CATEGORY:SEARCH_ENGINE', // Google, Bing, etc
            'CATEGORY:PREVIEW', // Link previews e.g. Slack, Discord
          ],
        }),
        slidingWindow({ mode: arcjetMode, interval: '2s', max: 5 }), // Additional rate limit: max 5 requests per 2 seconds
      ],
    })
  : null;

export function securityMiddleware() {
  return async (req, res, next) => {
    if (!httpArcJet) {
      return next();
    }

    try {
      const decision = await httpArcJet.protect(req);
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: 'Too many requests' });
        }
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch (e) {
      console.error('Arcjet middleware error', e);
      return res.status(503).json({ error: 'Service unavailable' });
    }

    next();
  };
}
