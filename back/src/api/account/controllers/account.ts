type JwtPayload = {
	id?: number | string
};

function extractBearerToken(authHeader: string): string {
	const [scheme, token] = authHeader.trim().split(/\s+/);
	if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
		return "";
	}

	return token.trim();
}

function toId(value: unknown): number {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : 0;
}

export default {
	async deleteMe(ctx: any) {
		const authHeader = String(ctx.request.header.authorization || "");
		const token = extractBearerToken(authHeader);

		if (!token) {
			return ctx.unauthorized("Authorization token is required.");
		}

		let payload: JwtPayload | null = null;
		try {
			payload = await strapi
				.plugin("users-permissions")
				.service("jwt")
				.verify(token);
		} catch {
			return ctx.unauthorized("Invalid authentication token.");
		}

		const userId = toId(payload?.id);
		if (userId <= 0) {
			return ctx.unauthorized("Invalid authentication token.");
		}

		const userEntry = await strapi.db
			.query("plugin::users-permissions.user")
			.findOne({
				where: { id: userId },
				select: ["id", "email"]
			});
		const userEmail = String((userEntry as { email?: unknown })?.email || "").trim().toLowerCase();

		const profileEntries = await strapi.db
			.query("api::volunteer-profile.volunteer-profile")
			.findMany({
				where: { user: userId },
				select: ["id"]
			});

		for (const profileEntry of profileEntries) {
			const profileId = toId((profileEntry as { id?: unknown })?.id);
			if (profileId <= 0) {
				continue;
			}

			await strapi.db
				.query("api::volunteer-achievement-progress.volunteer-achievement-progress")
				.deleteMany({
					where: { volunteer_profile: profileId }
				});

			await strapi.db
				.query("api::volunteer-profile.volunteer-profile")
				.delete({
					where: { id: profileId }
				});
		}

		const plainProfileIds = new Set<number>();

		try {
			const plainProfileEntries = await strapi.db
				.query("api::profile.profile")
				.findMany({
					where: { users_permissions_user: userId },
					select: ["id"]
				});

			for (const plainProfileEntry of plainProfileEntries) {
				const plainProfileId = toId((plainProfileEntry as { id?: unknown })?.id);
				if (plainProfileId > 0) {
					plainProfileIds.add(plainProfileId);
				}
			}
		} catch {
			// noop: relation can be absent in profile schema.
		}

		if (userEmail) {
			const plainProfileEntriesByEmail = await strapi.db
				.query("api::profile.profile")
				.findMany({
					where: { email: userEmail },
					select: ["id"]
				});

			for (const plainProfileEntry of plainProfileEntriesByEmail) {
				const plainProfileId = toId((plainProfileEntry as { id?: unknown })?.id);
				if (plainProfileId > 0) {
					plainProfileIds.add(plainProfileId);
				}
			}
		}

		for (const plainProfileId of plainProfileIds) {
			if (plainProfileId <= 0) {
				continue;
			}

			await strapi.db
				.query("api::profile.profile")
				.delete({
					where: { id: plainProfileId }
				});
		}

		await strapi.db
			.query("plugin::users-permissions.user")
			.delete({
				where: { id: userId }
			});

		ctx.send({ ok: true });
	}
};
