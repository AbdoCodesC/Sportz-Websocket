import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { matchIdParamSchema } from '../validation/matches.js';
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from '../validation/commentary.js';

export const commentaryRouter = Router();

commentaryRouter.get('/:id', async (req, res) => {
  console.log('Fetching commentary for match ID:', req.params.id);
  try {
    // Validate matchId param
    const paramsResult = matchIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: 'Invalid match ID.',
        details: paramsResult.error.issues,
      });
    }

    // Validate query
    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res
        .status(400)
        .json({ error: 'Invalid query.', details: queryResult.error.issues });
    }

    const matchId = paramsResult.data.id;
    const limit = queryResult.data.limit ?? 100;

    // Fetch commentary from DB
    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ data: results });
  } catch (error) {
    console.error('Failed to fetch commentary:', error);
    res.status(500).json({ error: 'Failed to fetch commentary.' });
  }
});

// POST /:matchId - Create commentary
commentaryRouter.post('/:id', async (req, res) => {
  console.log('With id:', req.params.id);
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  console.log('Params result:', paramsResult);
  if (!paramsResult.success) {
    return res
      .status(400)
      .json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
  }

  const bodyResult = createCommentarySchema.safeParse(req.body);
  console.log('Body result:', bodyResult);
  if (!bodyResult.success) {
    return res.status(400).json({
      error: 'Invalid commentary payload.',
      details: bodyResult.error.issues,
    });
  }

  try {
    const { minute, ...rest } = bodyResult.data;
    const [result] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        minute,
        ...rest,
      })
      .returning();

    if (res.app.locals.broadcastCommentary) { // Broadcast new commentary to WebSocket subscribers
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    res.status(201).json({ data: result });
  } catch (error) {
    console.error('Failed to create commentary:', error);
    res.status(500).json({ error: 'Failed to create commentary.' });
  }
});
