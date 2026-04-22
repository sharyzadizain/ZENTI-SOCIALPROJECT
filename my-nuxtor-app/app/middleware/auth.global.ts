const AUTH_PAGE = "/onboarding/gosuslugi";
const PRIVATE_PAGES = new Set(["/home", "/stats", "/profile", "/call", "/blind/home", "/blind/help", "/blind/conversation"]);
const PRIVATE_PREFIXES = ["/achievements", "/call"];

export default defineNuxtRouteMiddleware(async (to) => {
	const auth = useStrapiAuth();
	await auth.restoreSession();
	const isBlindProfile = auth.profileCollection.value === "profiles";
	const homePath = isBlindProfile ? "/blind/home" : "/home";

	if (to.path === "/" && auth.isLoggedIn.value) {
		return navigateTo(homePath);
	}

	const isPrivateRoute = PRIVATE_PAGES.has(to.path) || PRIVATE_PREFIXES.some(prefix => to.path.startsWith(prefix));

	if (isPrivateRoute && !auth.isLoggedIn.value) {
		return navigateTo(AUTH_PAGE);
	}

	if (to.path.startsWith("/auth") && to.path !== "/auth/callback" && auth.isLoggedIn.value) {
		return navigateTo(homePath);
	}
});
