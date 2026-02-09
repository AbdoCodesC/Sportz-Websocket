import { z } from 'zod';

// 1. listCommentaryQuerySchema
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// 2. createCommentarySchema
export const createCommentarySchema = z.object({
  minute: z.number().int().min(0).optional(),
  sequence: z.number().int(),
  period: z.string().optional(),
  eventType: z.string(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});
