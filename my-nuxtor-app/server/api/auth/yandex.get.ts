import { randomBytes } from "node:crypto";

const OAUTH_STATE_COOKIE = "yandex_oauth_state";
const OAUTH_MODE_COOKIE = "yandex_oauth_mode";

function normalizeRegistrationMode(rawMode: unknown): "blind" | "volunteer" {
	return String(rawMode || "").toLowerCase() === "blind" ? "blind" : "volunteer";
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig(event);
	const query = getQuery(event);
	const clientId = String(config.yandexClientId || "");
	const redirectUri = String(config.yandexRedirectUri || "");
	const registrationMode = normalizeRegistrationMode(query.mode);

	if (!clientId || !redirectUri) {
		throw createError({
			statusCode: 500,
			statusMessage: "Yandex OAuth is not configured"
		});
	}

	const state = randomBytes(24).toString("hex");

	setCookie(event, OAUTH_STATE_COOKIE, state, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 10,
		path: "/api/auth/yandex/callback"
	});

	setCookie(event, OAUTH_MODE_COOKIE, registrationMode, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 10,
		path: "/api/auth/yandex/callback"
	});

	const search = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: "login:email login:info",
		state
	});

	return sendRedirect(event, `https://oauth.yandex.ru/authorize?${search.toString()}`, 302);
});
