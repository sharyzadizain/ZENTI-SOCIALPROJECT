export default defineEventHandler(async (event) => {
	const session = await getUserSession(event) as {
		user?: {
			id?: string
			email?: string
			name?: string
			avatar?: string | null
		}
		identity?: {
			provider?: string
			registrationMode?: "blind" | "volunteer"
			yandexId?: string
			login?: string
			email?: string
			name?: string
			firstName?: string
			lastName?: string
			phone?: string
			avatar?: string | null
		}
		strapi?: {
			token?: string
			user?: {
				id?: number
				email?: string
				username?: string
			}
		}
	};

	if (!session?.user || !session?.strapi?.token || !session?.strapi?.user?.id) {
		return {
			authenticated: false
		};
	}

	return {
		authenticated: true,
		user: session.user,
		identity: session.identity,
		strapi: session.strapi
	};
});
