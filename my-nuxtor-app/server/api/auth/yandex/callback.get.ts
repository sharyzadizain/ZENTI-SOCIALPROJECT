import { createHash } from "node:crypto";

const OAUTH_STATE_COOKIE = "yandex_oauth_state";
const OAUTH_MODE_COOKIE = "yandex_oauth_mode";

interface YandexTokenResponse {
	access_token: string
	token_type: string
	expires_in: number
	refresh_token?: string
}

interface YandexProfileResponse {
	id?: string
	login?: string
	default_email?: string
	real_name?: string
	first_name?: string
	last_name?: string
	default_avatar_id?: string
	default_phone?: string | {
		number?: string
		e164?: string
	}
	phone_number?: string
	default_phone_number?: string
}

interface StrapiAuthResponse {
	jwt: string
	user: {
		id: number
		email: string
		username: string
	}
}

function normalizeRegistrationMode(rawMode: unknown): "blind" | "volunteer" {
	return String(rawMode || "").toLowerCase() === "blind" ? "blind" : "volunteer";
}

function buildStrapiPassword(yandexId: string, salt: string): string {
	return createHash("sha256")
		.update(`yandex:${yandexId}:${salt}`)
		.digest("hex")
		.slice(0, 32);
}

function extractYandexPhone(profile: YandexProfileResponse): string {
	const defaultPhone = profile.default_phone;
	if (typeof defaultPhone === "string" && defaultPhone.trim()) {
		return defaultPhone.trim();
	}

	if (defaultPhone && typeof defaultPhone === "object") {
		const number = String(defaultPhone.number || defaultPhone.e164 || "").trim();
		if (number) {
			return number;
		}
	}

	return String(profile.phone_number || profile.default_phone_number || "").trim();
}

async function tryStrapiLogin(baseUrl: string, email: string, password: string): Promise<StrapiAuthResponse | null> {
	try {
		return await $fetch<StrapiAuthResponse>(`${baseUrl}/auth/local`, {
			method: "POST",
			body: {
				identifier: email,
				password
			}
		});
	} catch {
		return null;
	}
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig(event);
	const query = getQuery(event);
	const code = String(query.code || "");
	const state = String(query.state || "");
	const expectedState = getCookie(event, OAUTH_STATE_COOKIE);
	const rawRegistrationMode = getCookie(event, OAUTH_MODE_COOKIE);
	const registrationMode = normalizeRegistrationMode(rawRegistrationMode);

	deleteCookie(event, OAUTH_STATE_COOKIE, { path: "/api/auth/yandex/callback" });
	deleteCookie(event, OAUTH_MODE_COOKIE, { path: "/api/auth/yandex/callback" });

	if (!code || !state || !expectedState || state !== expectedState) {
		return sendRedirect(event, "/onboarding/gosuslugi?error=oauth_state", 302);
	}

	const clientId = String(config.yandexClientId || "");
	const clientSecret = String(config.yandexClientSecret || "");
	const redirectUri = String(config.yandexRedirectUri || "");

	if (!clientId || !clientSecret || !redirectUri) {
		return sendRedirect(event, "/onboarding/gosuslugi?error=oauth_config", 302);
	}

	const token = await $fetch<YandexTokenResponse>("https://oauth.yandex.ru/token", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded"
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri
		}).toString()
	});

	const profile = await $fetch<YandexProfileResponse>("https://login.yandex.ru/info?format=json", {
		headers: {
			Authorization: `OAuth ${token.access_token}`
		}
	});

	const yandexId = String(profile.id || "");
	const email = String(profile.default_email || (yandexId ? `${yandexId}@yandex.local` : "")).toLowerCase();
	const firstName = String(profile.first_name || "").trim();
	const lastName = String(profile.last_name || "").trim();
	const phone = extractYandexPhone(profile);

	if (!yandexId || !email) {
		return sendRedirect(event, "/onboarding/gosuslugi?error=oauth_profile", 302);
	}

	const fullName = `${firstName} ${lastName}`.trim();
	const displayName = String(profile.real_name || fullName || profile.first_name || profile.login || "Волонтер");
	const avatarId = String(profile.default_avatar_id || "");
	const avatar = avatarId ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200` : null;

	const strapiBase = `${String(config.public.strapiUrl || "http://localhost:1337").replace(/\/$/, "")}/api`;
	const strapiPassword = buildStrapiPassword(yandexId, String(config.strapiOauthPasswordSalt || "dev-oauth-salt"));

	let strapiAuth = await tryStrapiLogin(strapiBase, email, strapiPassword);

	if (!strapiAuth) {
		try {
			strapiAuth = await $fetch<StrapiAuthResponse>(`${strapiBase}/auth/local/register`, {
				method: "POST",
				body: {
					username: email,
					email,
					password: strapiPassword
				}
			});
		} catch {
			strapiAuth = await tryStrapiLogin(strapiBase, email, strapiPassword);
		}
	}

	if (!strapiAuth?.jwt || !strapiAuth.user?.id) {
		return sendRedirect(event, "/onboarding/gosuslugi?error=strapi_auth", 302);
	}

	await setUserSession(event, {
		user: {
			id: yandexId,
			email,
			name: displayName,
			avatar
		},
		identity: {
			provider: "yandex",
			registrationMode,
			yandexId,
			login: String(profile.login || ""),
			email,
			name: displayName,
			firstName,
			lastName,
			phone,
			avatar
		},
		strapi: {
			token: strapiAuth.jwt,
			user: strapiAuth.user
		}
	});

	return sendRedirect(event, "/auth/callback", 302);
});


