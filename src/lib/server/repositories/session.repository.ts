import { asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { Page, PageQuery } from '$domain/models/common.ts';
import type {
	SessionBlock,
	SessionBlockDetail,
	SessionDetail,
	SessionInput,
	SessionItem,
	SessionSummary
} from '$domain/models/session.ts';
import { countExercises, estimateSessionSeconds } from '$domain/services/session-plan.ts';
import { db, schema, type DbExecutor } from '../db/client.ts';
import { toSessionBlock, toSessionItem } from '../db/mappers.ts';
import { newId } from '../db/ids.ts';
import { exerciseRepository } from './exercise.repository.ts';
import { ownedBy } from './scope.ts';

const { sessions, sessionBlocks, sessionItems } = schema;

/** Blocks with their items, ordered, for a set of sessions. */
function loadStructures(sessionIds: string[]): Map<string, SessionBlock[]> {
	const result = new Map<string, SessionBlock[]>();
	if (sessionIds.length === 0) return result;

	const blockRows = db
		.select()
		.from(sessionBlocks)
		.where(inArray(sessionBlocks.sessionId, sessionIds))
		.orderBy(asc(sessionBlocks.sessionId), asc(sessionBlocks.position))
		.all();

	const itemRows =
		blockRows.length > 0
			? db
					.select()
					.from(sessionItems)
					.where(inArray(sessionItems.blockId, blockRows.map((row) => row.id)))
					.orderBy(asc(sessionItems.blockId), asc(sessionItems.position))
					.all()
			: [];

	const itemsByBlock = new Map<string, SessionItem[]>();
	for (const row of itemRows) {
		const list = itemsByBlock.get(row.blockId);
		const item = toSessionItem(row);
		if (list) list.push(item);
		else itemsByBlock.set(row.blockId, [item]);
	}

	for (const row of blockRows) {
		const block = toSessionBlock(row, itemsByBlock.get(row.id) ?? []);
		const list = result.get(row.sessionId);
		if (list) list.push(block);
		else result.set(row.sessionId, [block]);
	}

	return result;
}

function toSummary(
	row: { id: string; name: string; description: string; createdAt: string; updatedAt: string },
	blocks: SessionBlock[]
): SessionSummary {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		blockCount: blocks.length,
		exerciseCount: countExercises(blocks),
		estimatedDurationSec: estimateSessionSeconds(blocks),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/** Writes the block/item tree for a session. Callers must be inside a transaction. */
function writeStructure(tx: DbExecutor, sessionId: string, input: SessionInput): void {
	input.blocks.forEach((block, blockIndex) => {
		const blockId = newId();
		tx.insert(sessionBlocks)
			.values({
				id: blockId,
				sessionId,
				position: blockIndex,
				label: block.label,
				rounds: block.rounds,
				restBetweenRoundsSec: block.restBetweenRoundsSec,
				restAfterSec: block.restAfterSec
			})
			.run();

		block.items.forEach((item, itemIndex) => {
			tx.insert(sessionItems)
				.values({
					id: newId(),
					blockId,
					exerciseId: item.exerciseId,
					position: itemIndex,
					measureType: item.measure.type,
					measureValue: item.measure.value,
					restAfterSec: item.restAfterSec,
					targetLoad: item.targetLoad,
					notes: item.notes
				})
				.run();
		});
	});
}

export const sessionRepository = {
	list(userId: string, query: PageQuery): Page<SessionSummary> {
		const term = query.search ? `%${query.search}%` : null;
		const search = term
			? or(like(sessions.name, term), like(sessions.description, term))
			: undefined;
		const filter = ownedBy(sessions.userId, userId, search);

		const rows = db
			.select()
			.from(sessions)
			.where(filter)
			.orderBy(asc(sessions.name))
			.limit(query.limit)
			.offset(query.offset)
			.all();

		const total =
			db.select({ value: sql<number>`count(*)` }).from(sessions).where(filter).get()?.value ?? 0;

		const structures = loadStructures(rows.map((row) => row.id));

		return {
			items: rows.map((row) => toSummary(row, structures.get(row.id) ?? [])),
			total,
			limit: query.limit,
			offset: query.offset
		};
	},

	findSummary(userId: string, id: string): SessionSummary | null {
		const row = db
			.select()
			.from(sessions)
			.where(ownedBy(sessions.userId, userId, eq(sessions.id, id)))
			.get();
		if (!row) return null;
		return toSummary(row, loadStructures([id]).get(id) ?? []);
	},

	findSummariesByIds(userId: string, ids: string[]): Map<string, SessionSummary> {
		if (ids.length === 0) return new Map();
		const rows = db
			.select()
			.from(sessions)
			.where(ownedBy(sessions.userId, userId, inArray(sessions.id, ids)))
			.all();
		const structures = loadStructures(rows.map((row) => row.id));
		return new Map(rows.map((row) => [row.id, toSummary(row, structures.get(row.id) ?? [])]));
	},

	/** Full tree with exercises resolved — what the editor and runner need. */
	findDetail(userId: string, id: string): SessionDetail | null {
		const row = db
			.select()
			.from(sessions)
			.where(ownedBy(sessions.userId, userId, eq(sessions.id, id)))
			.get();
		if (!row) return null;

		const blocks = loadStructures([id]).get(id) ?? [];
		const exerciseIds = [...new Set(blocks.flatMap((block) => block.items.map((i) => i.exerciseId)))];
		const exercises = exerciseRepository.findManyByIds(userId, exerciseIds);

		const detailBlocks: SessionBlockDetail[] = blocks.map((block) => ({
			...block,
			items: block.items.flatMap((item) => {
				const exercise = exercises.get(item.exerciseId);
				// An item whose exercise vanished cannot be rendered or run; the
				// restrict constraint makes this unreachable in normal operation.
				return exercise ? [{ ...item, exercise }] : [];
			})
		}));

		return { ...toSummary(row, blocks), blocks: detailBlocks };
	},

	create(userId: string, input: SessionInput): SessionDetail {
		const id = newId();
		const now = new Date().toISOString();
		db.transaction((tx) => {
			tx.insert(sessions)
				.values({
					id,
					userId,
					name: input.name,
					description: input.description,
					createdAt: now,
					updatedAt: now
				})
				.run();
			writeStructure(tx, id, input);
		});
		return this.findDetail(userId, id) as SessionDetail;
	},

	/**
	 * Replaces the whole session. The block/item tree is small and always edited
	 * as a unit, so a delete-and-rewrite is simpler and safer than diffing —
	 * at the cost of new ids, which is why workouts snapshot their plan.
	 */
	replace(userId: string, id: string, input: SessionInput): SessionDetail | null {
		const exists = db
			.select({ id: sessions.id })
			.from(sessions)
			.where(ownedBy(sessions.userId, userId, eq(sessions.id, id)))
			.get();
		if (!exists) return null;

		db.transaction((tx) => {
			const blockIds = tx
				.select({ id: sessionBlocks.id })
				.from(sessionBlocks)
				.where(eq(sessionBlocks.sessionId, id))
				.all()
				.map((row) => row.id);

			if (blockIds.length > 0) {
				tx.delete(sessionItems).where(inArray(sessionItems.blockId, blockIds)).run();
				tx.delete(sessionBlocks).where(eq(sessionBlocks.sessionId, id)).run();
			}

			tx.update(sessions)
				.set({ name: input.name, description: input.description, updatedAt: new Date().toISOString() })
				.where(eq(sessions.id, id))
				.run();

			writeStructure(tx, id, input);
		});

		return this.findDetail(userId, id);
	},

	remove(userId: string, id: string): boolean {
		if (!this.findSummary(userId, id)) return false;
		return db.transaction((tx) => {
			const blockIds = tx
				.select({ id: sessionBlocks.id })
				.from(sessionBlocks)
				.where(eq(sessionBlocks.sessionId, id))
				.all()
				.map((row) => row.id);
			if (blockIds.length > 0) {
				tx.delete(sessionItems).where(inArray(sessionItems.blockId, blockIds)).run();
			}
			tx.delete(sessionBlocks).where(eq(sessionBlocks.sessionId, id)).run();
			return tx.delete(sessions).where(eq(sessions.id, id)).run().changes > 0;
		});
	},

	listAllIdsAndNames(userId: string): Array<{ id: string; name: string }> {
		return db
			.select({ id: sessions.id, name: sessions.name })
			.from(sessions)
			.where(ownedBy(sessions.userId, userId))
			.orderBy(asc(sessions.name))
			.all();
	}
};
