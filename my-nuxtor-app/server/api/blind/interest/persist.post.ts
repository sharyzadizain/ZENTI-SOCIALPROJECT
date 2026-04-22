import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

interface PersistInterestBody {
	interest?: string
	profileId?: number | null
	email?: string | null
}

function normalizeInterest(value: unknown): string {
	return String(value || "").replace(/\s+/g, " ").trim().slice(0, 360);
}

function resolveCandidateDbPath(baseDir: string, configuredFilename: string): string {
	if (configuredFilename) {
		return path.resolve(baseDir, configuredFilename);
	}

	return path.resolve(baseDir, ".tmp", "data.db");
}

function resolveBackSqlitePath(): string {
	const explicitDbPath = String(
		process.env.NUXT_BACK_SQLITE_PATH
		|| process.env.BACK_SQLITE_PATH
		|| ""
	).trim();
	if (explicitDbPath) {
		return path.isAbsolute(explicitDbPath)
			? explicitDbPath
			: path.resolve(process.cwd(), explicitDbPath);
	}

	const configuredFilename = String(process.env.DATABASE_FILENAME || "").trim();
	if (path.isAbsolute(configuredFilename)) {
		return configuredFilename;
	}

	const cwd = process.cwd();
	const candidateBackDirs = [
		path.resolve(cwd, "back"),
		path.resolve(cwd, "..", "back"),
		path.resolve(cwd, "..", "..", "back")
	];

	for (const backDir of candidateBackDirs) {
		const candidate = resolveCandidateDbPath(backDir, configuredFilename);
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	const fallbackBackDir = candidateBackDirs[0] || path.resolve(cwd, "back");
	return resolveCandidateDbPath(fallbackBackDir, configuredFilename);
}

export default defineEventHandler(async (event) => {
	const body = await readBody<PersistInterestBody>(event);
	const interest = normalizeInterest(body?.interest);
	const profileIdRaw = Number(body?.profileId || 0);
	const profileId = Number.isFinite(profileIdRaw) && profileIdRaw > 0 ? Math.floor(profileIdRaw) : 0;
	const email = String(body?.email || "").trim().toLowerCase();

	if (!interest) {
		throw createError({
			statusCode: 400,
			statusMessage: "Interest is required"
		});
	}

	if (!profileId && !email) {
		throw createError({
			statusCode: 400,
			statusMessage: "profileId or email is required"
		});
	}

	const dbPath = resolveBackSqlitePath();
	let updatedRows = 0;
	const now = Date.now();
	const db = new DatabaseSync(dbPath);

	try {
		if (profileId > 0) {
			const byIdResult = db.prepare(
				"UPDATE profiles SET interest = ?, updated_at = ? WHERE id = ?"
			).run(interest, now, profileId);
			updatedRows += Number(byIdResult.changes || 0);
		}

		if (email) {
			const byEmailResult = db.prepare(
				"UPDATE profiles SET interest = ?, updated_at = ? WHERE lower(email) = lower(?)"
			).run(interest, now, email);
			updatedRows += Number(byEmailResult.changes || 0);
		}
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: "Failed to persist blind interest",
			data: {
				reason: error instanceof Error ? error.message : "Unknown database error"
			}
		});
	} finally {
		db.close();
	}

	return {
		ok: true,
		updatedRows,
		dbPath
	};
});
