import { z } from 'zod';
import { exerciseSchema } from './exercise.ts';
import { idSchema, measureSchema, timestampsSchema } from './common.ts';

/**
 * A session is an ordered list of blocks; a block is a circuit repeated
 * `rounds` times over an ordered list of items; an item is one exercise
 * quantified by a measure.
 *
 * "5 rounds of (10 jumping jacks + 5 push-ups) with 30s rest, then 2 rounds of
 * (5 push-ups + 5 sit-ups)" is exactly two blocks. Rest is a property of the
 * thing you rest *after* rather than a node of its own, which keeps the tree
 * shallow and the editor simple; the runner materialises rest into real steps.
 */

export const sessionItemInputSchema = z.object({
	exerciseId: idSchema,
	measure: measureSchema,
	/** Rest taken after this item, before the next one in the same round. */
	restAfterSec: z.number().int().min(0).max(3600).default(0),
	/** Optional load target — kg, band colour, incline… free text stays flexible. */
	targetLoad: z.string().trim().max(40).default(''),
	notes: z.string().trim().max(500).default('')
});
export type SessionItemInput = z.infer<typeof sessionItemInputSchema>;

export const sessionBlockInputSchema = z.object({
	label: z.string().trim().max(80).default(''),
	rounds: z.number().int().min(1).max(100).default(1),
	/** Rest between two rounds of this block. */
	restBetweenRoundsSec: z.number().int().min(0).max(3600).default(0),
	/** Rest after the block is finished, before the next block. */
	restAfterSec: z.number().int().min(0).max(3600).default(0),
	items: z.array(sessionItemInputSchema).min(1, 'A block needs at least one exercise')
});
export type SessionBlockInput = z.infer<typeof sessionBlockInputSchema>;

export const sessionInputSchema = z.object({
	name: z.string().trim().min(1, 'A name is required').max(80),
	description: z.string().trim().max(2000).default(''),
	blocks: z.array(sessionBlockInputSchema).min(1, 'A session needs at least one block')
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

/** Persisted item: input plus identity and position. */
export const sessionItemSchema = sessionItemInputSchema.extend({
	id: idSchema,
	blockId: idSchema,
	position: z.number().int().min(0)
});
export type SessionItem = z.infer<typeof sessionItemSchema>;

export const sessionBlockSchema = sessionBlockInputSchema.extend({
	id: idSchema,
	sessionId: idSchema,
	position: z.number().int().min(0),
	items: z.array(sessionItemSchema)
});
export type SessionBlock = z.infer<typeof sessionBlockSchema>;

/** List view: everything a card needs, nothing more. */
export const sessionSummarySchema = z.object({
	id: idSchema,
	name: z.string(),
	description: z.string(),
	blockCount: z.number().int().min(0),
	exerciseCount: z.number().int().min(0),
	estimatedDurationSec: z.number().int().min(0),
	...timestampsSchema.shape
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

/** Item with its exercise resolved — what the editor and runner consume. */
export const sessionItemDetailSchema = sessionItemSchema.extend({
	exercise: exerciseSchema
});
export type SessionItemDetail = z.infer<typeof sessionItemDetailSchema>;

export const sessionBlockDetailSchema = sessionBlockSchema.extend({
	items: z.array(sessionItemDetailSchema)
});
export type SessionBlockDetail = z.infer<typeof sessionBlockDetailSchema>;

export const sessionDetailSchema = sessionSummarySchema.extend({
	blocks: z.array(sessionBlockDetailSchema)
});
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
