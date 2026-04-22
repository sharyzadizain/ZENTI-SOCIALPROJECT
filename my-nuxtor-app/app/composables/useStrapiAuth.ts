interface StrapiUser {
	id: number
	email: string
	username: string
}

interface StrapiAuthResponse {
	jwt: string
	user: StrapiUser
}

export interface VolunteerProfile {
	id: number
	documentId: string
	createdAt?: string
	updatedAt?: string
	firstName: string
	lastName: string
	phone: string
	emailDisplay: string
	interest: string
	gosuslugiVerified: boolean
	soundEnabled: boolean
	deedsCount: number
	totalHours: number
	peopleNeedHelp: number
	quoteText: string
}

export interface VolunteerAchievement {
	id: number
	title: string
	description: string
	receivedAt: string
	isReceived: boolean
	progressCurrent: number
	progressTarget: number
	progressUnit: string
	iconUrl: string | null
}

export interface VolunteerReview {
	id: number
	text: string
	createdAt: string
}

interface RegisterInput {
	email: string
	password: string
	firstName?: string
	lastName?: string
	phone?: string
}

interface LoginInput {
	email: string
	password: string
}

interface YandexIdentityInfo {
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

interface YandexSessionResponse {
	authenticated: boolean
	user?: {
		id?: string
		email?: string
		name?: string
		avatar?: string | null
	}
	identity?: YandexIdentityInfo
	strapi?: {
		token?: string
		user?: {
			id?: number
			email?: string
			username?: string
		}
	}
}

const TOKEN_KEY = "volunteer_auth_token";
const USER_KEY = "volunteer_auth_user";
const ONBOARDING_NAME_KEY = "volunteer_onboarding_name";
const ONBOARDING_INTERESTS_KEY = "volunteer_onboarding_interests";
const PROFILE_ID_KEY = "volunteer_profile_id";
const PROFILE_COLLECTION_KEY = "volunteer_profile_collection";

type ProfileCollection = "volunteer-profiles" | "profiles";

const DEFAULT_NAME = "Волонтер";
const DEFAULT_QUOTE = "";
const DEFAULT_PROGRESS_UNIT = "звонков";
const REVIEW_RELATION_FIELD_CANDIDATES = ["volunteer_profile", "volunteerProfile", "volunteer", "profile"] as const;

function unwrapEntry(entry: any): any {
	if (!entry) {
		return null;
	}

	if (entry.attributes && typeof entry.attributes === "object") {
		return {
			id: entry.id,
			...entry.attributes
		};
	}

	return entry;
}

function unwrapList(payload: any): any[] {
	if (Array.isArray(payload?.data)) {
		return payload.data.map(unwrapEntry).filter(Boolean);
	}

	if (Array.isArray(payload)) {
		return payload.map(unwrapEntry).filter(Boolean);
	}

	return [];
}

function unwrapSingle(payload: any): any | null {
	if (payload?.data !== undefined) {
		return unwrapEntry(payload.data);
	}

	return unwrapEntry(payload);
}

function toNumber(value: unknown, fallback = 0): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value: unknown): string {
	return String(value || "").trim();
}

function normalizeReviewText(value: unknown): string {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeInterestText(value: unknown): string {
	return String(value || "").replace(/\s+/g, " ").trim().slice(0, 360);
}

function splitFullName(fullName: string): { firstName: string, lastName: string } {
	const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
	if (!parts.length) {
		return {
			firstName: "",
			lastName: ""
		};
	}

	if (parts.length === 1) {
		return {
			firstName: parts[0] || "",
			lastName: ""
		};
	}

	return {
		firstName: parts[0] || "",
		lastName: parts.slice(1).join(" ")
	};
}

function normalizeError(error: unknown): string {
	const maybeError = error as {
		status?: number
		statusCode?: number
		data?: {
			error?: {
				message?: string
				status?: number
			}
		}
		message?: string
	};

	const rawMessage = maybeError?.data?.error?.message || maybeError?.message || "";
	const status = maybeError?.data?.error?.status || maybeError?.statusCode || maybeError?.status || 0;

	if (status === 403 || /forbidden/i.test(rawMessage)) {
		return "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РІ Strapi. РџСЂРѕРІРµСЂСЊ Permissions РґР»СЏ СЂРѕР»РµР№ Public/Authenticated.";
	}

	if (status === 400 && /(already|taken|exists|email)/i.test(rawMessage)) {
		return "Р­С‚РѕС‚ email СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ. РСЃРїРѕР»СЊР·СѓР№ РІС…РѕРґ РёР»Рё РґСЂСѓРіРѕР№ email.";
	}

	return rawMessage || "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ.";
}

function buildAchievementsCatalogPath(): string {
	return "/volunteer-achievements?populate=*&sort=createdAt:asc";
}

function buildAchievementByIdPath(achievementId: number): string {
	return `/volunteer-achievements?populate=*&filters[id][$eq]=${achievementId}`;
}

function getProfileUserRelationField(profileCollection: ProfileCollection): "user" | "users_permissions_user" {
	return profileCollection === "profiles" ? "users_permissions_user" : "user";
}

function buildProfileByUserPath(userId: number, profileCollection: ProfileCollection): string {
	const relationField = getProfileUserRelationField(profileCollection);
	return `/${profileCollection}?filters[${relationField}][id][$eq]=${userId}&populate=*`;
}

function buildProfileByIdPath(profileId: number, profileCollection: ProfileCollection): string {
	return `/${profileCollection}/${profileId}?populate=*`;
}

function buildProfileByRefPath(profileRef: string, profileCollection: ProfileCollection): string {
	return `/${profileCollection}/${encodeURIComponent(profileRef)}?populate=*`;
}

function buildProfileDeleteByRefPath(profileRef: string, profileCollection: ProfileCollection): string {
	return `/${profileCollection}/${encodeURIComponent(profileRef)}`;
}

function buildProfileByEmailPath(email: string, profileCollection: ProfileCollection): string {
	const emailField = profileCollection === "profiles" ? "email" : "emailDisplay";
	return `/${profileCollection}?filters[${emailField}][$eqi]=${encodeURIComponent(email)}&populate=*`;
}

function buildProfilesCatalogPath(profileCollection: ProfileCollection): string {
	return `/${profileCollection}?populate=*`;
}

function buildUserByIdPath(userId: number): string {
	return `/users/${userId}`;
}

function buildDeleteOwnAccountPath(): string {
	return "/account/me/delete";
}

function buildDeleteOwnAccountLegacyPath(): string {
	return "/account/me";
}

function buildProgressByProfilePath(profileId: number): string {
	return `/volunteer-achievement-progresses?populate=*&sort=updatedAt:desc&filters[volunteer_profile][id][$eq]=${profileId}`;
}

function buildProgressByProfileAndAchievementPath(profileId: number, achievementId: number): string {
	return `/volunteer-achievement-progresses?populate=*&sort=updatedAt:desc&filters[volunteer_profile][id][$eq]=${profileId}&filters[volunteer_achievement][id][$eq]=${achievementId}`;
}

function buildProgressByRefPath(progressRef: string): string {
	return `/volunteer-achievement-progresses/${encodeURIComponent(progressRef)}?populate=*`;
}

function progressWeight(progress: any): number {
	const hasAchievedAt = progress?.achievedAt ? 1 : 0;
	const updatedAt = Date.parse(String(progress?.updatedAt || progress?.createdAt || "")) || 0;
	return (hasAchievedAt * 10_000_000_000_000) + updatedAt;
}

function extractAchievementIdFromProgress(progress: any): number {
	const relation = unwrapEntry(progress?.volunteer_achievement?.data ?? progress?.volunteer_achievement);
	return toNumber(relation?.id, 0);
}

function buildProgressMap(progressEntries: any[]): Map<number, any> {
	const progressByAchievementId = new Map<number, any>();

	for (const progress of progressEntries) {
		const achievementId = extractAchievementIdFromProgress(progress);
		if (achievementId <= 0) {
			continue;
		}

		const previous = progressByAchievementId.get(achievementId);
		if (!previous || progressWeight(progress) >= progressWeight(previous)) {
			progressByAchievementId.set(achievementId, progress);
		}
	}

	return progressByAchievementId;
}

function shouldIgnoreProgressError(error: unknown): boolean {
	const message = normalizeError(error).toLowerCase();
	return /forbidden|invalid key|unknown field|unknown parameter/.test(message);
}

function normalizeProfileCollection(value: unknown): ProfileCollection {
	return value === "profiles" ? "profiles" : "volunteer-profiles";
}

export function useStrapiAuth() {
	const runtimeConfig = useRuntimeConfig();

	const token = useState<string | null>("auth_token", () => null);
	const user = useState<StrapiUser | null>("auth_user", () => null);
	const profile = useState<VolunteerProfile | null>("auth_profile", () => null);
	const profileCollection = useState<ProfileCollection>("auth_profile_collection", () => "volunteer-profiles");
	const achievements = useState<VolunteerAchievement[]>("auth_achievements", () => []);
	const initialized = useState<boolean>("auth_initialized", () => false);
	const onboardingName = useState<string>("onboarding_name", () => "");

	const baseUrl = computed(() => {
		const raw = String(runtimeConfig.public.strapiUrl || "http://localhost:1337");
		return raw.endsWith("/") ? raw.slice(0, -1) : raw;
	});

	const isLoggedIn = computed(() => Boolean(token.value && user.value));

	function resolveMediaUrl(media: any): string | null {
		const source = media?.data ?? media;
		const entry = unwrapEntry(source);
		const rawUrl = entry?.url || entry?.formats?.medium?.url || entry?.formats?.small?.url || entry?.formats?.thumbnail?.url;

		if (!rawUrl || typeof rawUrl !== "string") {
			return null;
		}

		if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
			return rawUrl;
		}

		return `${baseUrl.value}${rawUrl}`;
	}

	function mapProfile(raw: any, sourceCollection: ProfileCollection): VolunteerProfile {
		if (sourceCollection === "profiles") {
			return {
				id: toNumber(raw.id),
				documentId: String(raw.documentId || ""),
				createdAt: String(raw.createdAt || ""),
				updatedAt: String(raw.updatedAt || ""),
				firstName: String(raw.firstName || ""),
				lastName: String(raw.lastName || ""),
				phone: String(raw.phone || ""),
				emailDisplay: String(raw.email || user.value?.email || ""),
				interest: normalizeInterestText(raw.interest),
				gosuslugiVerified: true,
				soundEnabled: true,
				deedsCount: 0,
				totalHours: 0,
				peopleNeedHelp: 500,
				quoteText: DEFAULT_QUOTE
			};
		}

		return {
			id: toNumber(raw.id),
			documentId: String(raw.documentId || ""),
			createdAt: String(raw.createdAt || ""),
			updatedAt: String(raw.updatedAt || ""),
			firstName: String(raw.firstName || ""),
			lastName: String(raw.lastName || ""),
			phone: String(raw.phone || ""),
			emailDisplay: String(raw.emailDisplay || user.value?.email || ""),
			interest: normalizeInterestText(raw.interest),
			gosuslugiVerified: Boolean(raw.gosuslugiVerified),
			soundEnabled: raw.soundEnabled !== false,
			deedsCount: toNumber(raw.deedsCount, 0),
			totalHours: toNumber(raw.totalHours, 0),
			peopleNeedHelp: toNumber(raw.peopleNeedHelp, 500),
			quoteText: String(raw.quoteText || DEFAULT_QUOTE)
		};
	}

	function toProfileCreateData(initial: Partial<VolunteerProfile>, sourceCollection: ProfileCollection): Record<string, any> {
		if (!user.value) {
			return {};
		}

		if (sourceCollection === "profiles") {
			return {
				firstName: initial.firstName || onboardingName.value || DEFAULT_NAME,
				lastName: initial.lastName || "",
				phone: initial.phone || "",
				email: initial.emailDisplay || user.value.email,
				interest: normalizeInterestText(initial.interest)
			};
		}

		return {
			user: user.value.id,
			firstName: initial.firstName || onboardingName.value || DEFAULT_NAME,
			lastName: initial.lastName || "",
			phone: initial.phone || "",
			emailDisplay: initial.emailDisplay || user.value.email,
			gosuslugiVerified: initial.gosuslugiVerified ?? false,
			soundEnabled: initial.soundEnabled ?? true,
			deedsCount: initial.deedsCount ?? 0,
			totalHours: initial.totalHours ?? 0,
			peopleNeedHelp: initial.peopleNeedHelp ?? 500,
			quoteText: initial.quoteText || DEFAULT_QUOTE
		};
	}

	function toProfileUpdateData(updates: Partial<VolunteerProfile>, sourceCollection: ProfileCollection): Record<string, any> {
		if (sourceCollection === "profiles") {
			const {
				firstName,
				lastName,
				phone,
				emailDisplay,
				interest
			} = updates;

			return {
				...(firstName !== undefined ? { firstName } : {}),
				...(lastName !== undefined ? { lastName } : {}),
				...(phone !== undefined ? { phone } : {}),
				...(emailDisplay !== undefined ? { email: emailDisplay } : {}),
				...(interest !== undefined ? { interest: normalizeInterestText(interest) } : {})
			};
		}

		return {
			...updates
		};
	}

	function mapAchievement(raw: any, progressByAchievementId: Map<number, any>): VolunteerAchievement {
		const achievementId = toNumber(raw.id, 0);
		const progress = progressByAchievementId.get(achievementId) || null;
		const progressTarget = Math.max(1, toNumber(raw.progressTarget, 1));
		const progressCurrentRaw = toNumber(progress?.progressCurrent, 0);
		const profileCallCount = toNumber(profile.value?.deedsCount, 0);
		const progressUnit = String(raw.progressUnit || DEFAULT_PROGRESS_UNIT);
		const isCallBasedAchievement = /звон|call/i.test(progressUnit);
		const effectiveProgressCurrent = isCallBasedAchievement
			? Math.max(progressCurrentRaw, profileCallCount)
			: progressCurrentRaw;
		const explicitAchievedAt = String(progress?.achievedAt || "");
		const reachedTarget = effectiveProgressCurrent >= progressTarget;
		const fallbackAchievedAt = String(
			progress?.updatedAt
			|| progress?.createdAt
			|| profile.value?.updatedAt
			|| profile.value?.createdAt
			|| ""
		);
		const receivedAt = explicitAchievedAt || (reachedTarget ? fallbackAchievedAt : "");
		const isReceived = Boolean(explicitAchievedAt) || reachedTarget;
		const progressCurrent = isReceived
			? Math.max(effectiveProgressCurrent, progressTarget)
			: Math.max(effectiveProgressCurrent, 0);

		return {
			id: achievementId,
			title: String(raw.title || "Р”РѕСЃС‚РёР¶РµРЅРёРµ"),
			description: raw?.description == null ? "" : String(raw.description),
			receivedAt,
			isReceived,
			progressCurrent,
			progressTarget,
			progressUnit,
			iconUrl: resolveMediaUrl(raw.icon)
		};
	}

	async function strapiRequest<T>(path: string, options: Record<string, any> = {}): Promise<T> {
		const headers: Record<string, string> = {
			...(options.headers || {})
		};

		if (token.value) {
			headers.Authorization = `Bearer ${token.value}`;
		}

		return await $fetch(`${baseUrl.value}/api${path}`, {
			...options,
			headers
		}) as T;
	}

	async function strapiRequestPublic<T>(path: string, options: Record<string, any> = {}): Promise<T> {
		const headers: Record<string, string> = {
			...(options.headers || {})
		};

		delete headers.Authorization;

		return await $fetch(`${baseUrl.value}/api${path}`, {
			...options,
			headers
		}) as T;
	}

	function buildPublicationCandidates(path: string): string[] {
		const separator = path.includes("?") ? "&" : "?";
		return [
			`${path}${separator}publicationState=preview`,
			`${path}${separator}status=draft`,
			`${path}${separator}status=published`,
			path
		];
	}

	function isPublicationParamError(error: unknown): boolean {
		const message = normalizeError(error).toLowerCase();
		return /publicationstate|status/.test(message);
	}

	function isForbiddenError(error: unknown): boolean {
		const message = normalizeError(error).toLowerCase();
		const maybeError = error as {
			status?: number
			statusCode?: number
			data?: {
				error?: {
					status?: number
				}
			}
		};

		const status = maybeError?.data?.error?.status || maybeError?.statusCode || maybeError?.status || 0;
		return status === 403 || /forbidden/.test(message);
	}

	function isUserFieldError(error: unknown): boolean {
		const message = normalizeError(error).toLowerCase();
		const hasUnknownField = /invalid key|unknown field|unknown parameter/.test(message);
		const mentionsUserField = /\buser\b|users_permissions_user|users-permissions-user/.test(message);
		return hasUnknownField && mentionsUserField;
	}

	function isUnknownFieldError(error: unknown): boolean {
		const message = normalizeError(error).toLowerCase();
		return /invalid key|unknown field|unknown parameter/.test(message);
	}

	function isNotFoundError(error: unknown): boolean {
		const maybeError = error as {
			status?: number
			statusCode?: number
			data?: {
				error?: {
					status?: number
					message?: string
				}
			}
			message?: string
		};

		const status = maybeError?.data?.error?.status || maybeError?.statusCode || maybeError?.status || 0;
		const message = String(maybeError?.data?.error?.message || maybeError?.message || "").toLowerCase();
		return status === 404 || /not found/.test(message);
	}

	function isMethodNotAllowedError(error: unknown): boolean {
		const maybeError = error as {
			status?: number
			statusCode?: number
			data?: {
				error?: {
					status?: number
					message?: string
				}
			}
			message?: string
		};

		const status = maybeError?.data?.error?.status || maybeError?.statusCode || maybeError?.status || 0;
		const message = String(maybeError?.data?.error?.message || maybeError?.message || "").toLowerCase();
		return status === 405 || /method not allowed/.test(message);
	}

	async function requestListWithPublicationFallback(path: string): Promise<any[]> {
		const deduped = new Map<string, any>();
		let lastError: unknown = null;

		for (const candidatePath of buildPublicationCandidates(path)) {
			try {
				const payload = await strapiRequest<any>(candidatePath);
				for (const item of unwrapList(payload)) {
					const key = String(item?.id ?? `${deduped.size}-${candidatePath}`);
					deduped.set(key, item);
				}
			} catch (error) {
				if (isForbiddenError(error)) {
					try {
						const publicPayload = await strapiRequestPublic<any>(candidatePath);
						for (const item of unwrapList(publicPayload)) {
							const key = String(item?.id ?? `${deduped.size}-${candidatePath}`);
							deduped.set(key, item);
						}
						continue;
					} catch (publicError) {
						if (isPublicationParamError(publicError)) {
							continue;
						}
						lastError = publicError;
						continue;
					}
				}

				if (isPublicationParamError(error)) {
					continue;
				}

				lastError = error;
			}
		}

		if (!deduped.size && lastError) {
			throw lastError;
		}

		return [...deduped.values()];
	}

	async function requestAchievementsCatalog(): Promise<any[]> {
		return await requestListWithPublicationFallback(buildAchievementsCatalogPath());
	}

	async function requestAchievementById(achievementId: number): Promise<any | null> {
		const entries = await requestListWithPublicationFallback(buildAchievementByIdPath(achievementId));
		return entries[0] || null;
	}

	async function requestProgressByProfile(profileId: number): Promise<any[]> {
		return await requestListWithPublicationFallback(buildProgressByProfilePath(profileId));
	}

	async function requestProgressByProfileAndAchievement(profileId: number, achievementId: number): Promise<any[]> {
		return await requestListWithPublicationFallback(buildProgressByProfileAndAchievementPath(profileId, achievementId));
	}

	async function syncCallAchievementProgress(): Promise<void> {
		if (!profile.value?.id || profileCollection.value !== "volunteer-profiles") {
			return;
		}

		const callCount = toNumber(profile.value.deedsCount, 0);
		const nowIso = new Date().toISOString();

		let catalog: any[] = [];
		try {
			catalog = await requestAchievementsCatalog();
		} catch (error) {
			if (!shouldIgnoreProgressError(error) && !isForbiddenError(error)) {
				throw error;
			}
			return;
		}

		const callAchievements = catalog.filter((item) => {
			const unit = String(item?.progressUnit || DEFAULT_PROGRESS_UNIT);
			return /звон|call/i.test(unit);
		});

		for (const achievement of callAchievements) {
			const achievementId = toNumber(achievement?.id, 0);
			if (achievementId <= 0) {
				continue;
			}

			const progressTarget = Math.max(1, toNumber(achievement?.progressTarget, 1));
			const shouldSetAchievedAt = callCount >= progressTarget;

			let existingProgress: any | null = null;
			try {
				const entries = await requestProgressByProfileAndAchievement(profile.value.id, achievementId);
				existingProgress = entries[0] || null;
			} catch (error) {
				if (!shouldIgnoreProgressError(error) && !isForbiddenError(error)) {
					throw error;
				}
				continue;
			}

			const existingCurrent = toNumber(existingProgress?.progressCurrent, 0);
			const nextCurrent = Math.max(existingCurrent, callCount);
			const existingAchievedAt = String(existingProgress?.achievedAt || "").trim();
			const nextAchievedAt = existingAchievedAt || (shouldSetAchievedAt ? nowIso : "");

			const shouldWrite = !existingProgress
				|| nextCurrent > existingCurrent
				|| (shouldSetAchievedAt && !existingAchievedAt);
			if (!shouldWrite) {
				continue;
			}

			const payload = {
				progressCurrent: nextCurrent,
				...(nextAchievedAt ? { achievedAt: nextAchievedAt } : {})
			};

			if (existingProgress) {
				const progressRefs = [
					String(existingProgress?.documentId || "").trim(),
					toNumber(existingProgress?.id, 0) > 0 ? String(toNumber(existingProgress?.id, 0)) : ""
				].filter(Boolean);

				let updated = false;
				for (const progressRef of progressRefs) {
					try {
						await strapiRequest<any>(buildProgressByRefPath(progressRef), {
							method: "PUT",
							body: {
								data: payload
							}
						});
						updated = true;
						break;
					} catch (error) {
						if (isNotFoundError(error)) {
							continue;
						}

						if (shouldIgnoreProgressError(error) || isForbiddenError(error)) {
							updated = true;
							break;
						}

						throw error;
					}
				}

				if (updated) {
					continue;
				}
			}

			try {
				await strapiRequest<any>("/volunteer-achievement-progresses", {
					method: "POST",
					body: {
						data: {
							volunteer_profile: profile.value.id,
							volunteer_achievement: achievementId,
							...payload
						}
					}
				});
			} catch (error) {
				if (!shouldIgnoreProgressError(error) && !isForbiddenError(error)) {
					throw error;
				}
			}
		}
	}

	function persistSession(): void {
		if (!import.meta.client) {
			return;
		}

		if (token.value) {
			localStorage.setItem(TOKEN_KEY, token.value);
		}

		if (user.value) {
			localStorage.setItem(USER_KEY, JSON.stringify(user.value));
		}
	}

	function persistProfileId(profileId: number | null): void {
		if (!import.meta.client) {
			return;
		}

		if (profileId && profileId > 0) {
			localStorage.setItem(PROFILE_ID_KEY, String(profileId));
		} else {
			localStorage.removeItem(PROFILE_ID_KEY);
		}
	}

	function persistProfileCollection(value: ProfileCollection): void {
		if (!import.meta.client) {
			return;
		}

		localStorage.setItem(PROFILE_COLLECTION_KEY, value);
	}

	function readPersistedProfileCollection(): ProfileCollection {
		if (!import.meta.client) {
			return "volunteer-profiles";
		}

		return normalizeProfileCollection(localStorage.getItem(PROFILE_COLLECTION_KEY));
	}

	function setProfileCollection(value: ProfileCollection): void {
		profileCollection.value = normalizeProfileCollection(value);
		persistProfileCollection(profileCollection.value);
	}

	function readPersistedProfileId(): number {
		if (!import.meta.client) {
			return 0;
		}

		return toNumber(localStorage.getItem(PROFILE_ID_KEY), 0);
	}

	function clearSessionStorage(): void {
		if (!import.meta.client) {
			return;
		}

		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
		localStorage.removeItem(PROFILE_ID_KEY);
		localStorage.removeItem(PROFILE_COLLECTION_KEY);
	}

	function applyExternalStrapiSession(sessionToken: string, sessionUser: { id?: number, email?: string, username?: string } | null | undefined): boolean {
		const normalizedToken = String(sessionToken || "");
		const normalizedId = toNumber(sessionUser?.id, 0);
		const normalizedEmail = String(sessionUser?.email || "").trim().toLowerCase();

		if (!normalizedToken || normalizedId <= 0 || !normalizedEmail) {
			return false;
		}

		token.value = normalizedToken;
		user.value = {
			id: normalizedId,
			email: normalizedEmail,
			username: String(sessionUser?.username || normalizedEmail)
		};
		persistSession();
		return true;
	}

	function normalizeYandexIdentity(identity: YandexIdentityInfo | null | undefined, fallbackUser: YandexSessionResponse["user"]): {
		firstName: string
		lastName: string
		email: string
		phone: string
	} {
		const fullName = normalizeText(identity?.name || fallbackUser?.name);
		const split = splitFullName(fullName);
		const firstName = normalizeText(identity?.firstName) || split.firstName;
		const lastName = normalizeText(identity?.lastName) || split.lastName;
		const email = normalizeText(identity?.email || fallbackUser?.email || user.value?.email).toLowerCase();
		const phone = normalizeText(identity?.phone);

		return {
			firstName,
			lastName,
			email,
			phone
		};
	}

	function applyRegistrationModeToProfileCollection(registrationMode: YandexIdentityInfo["registrationMode"]): void {
		if (registrationMode === "blind") {
			setProfileCollection("profiles");
			return;
		}

		if (registrationMode === "volunteer") {
			setProfileCollection("volunteer-profiles");
		}
	}

	function readOnboardingInterestFromStorage(): string {
		if (!import.meta.client) {
			return "";
		}

		return normalizeInterestText(localStorage.getItem(ONBOARDING_INTERESTS_KEY) || "");
	}

	async function syncProfileFromYandex(identity: YandexIdentityInfo | null | undefined, fallbackUser: YandexSessionResponse["user"]): Promise<void> {
		if (!user.value) {
			return;
		}

		applyRegistrationModeToProfileCollection(identity?.registrationMode);

		const normalized = normalizeYandexIdentity(identity, fallbackUser);
		const onboardingInterest = readOnboardingInterestFromStorage();
		const isBlindProfileCollection = profileCollection.value === "profiles";
		const profileSeed: Partial<VolunteerProfile> = {
			firstName: normalized.firstName || onboardingName.value || DEFAULT_NAME,
			lastName: normalized.lastName,
			phone: normalized.phone,
			emailDisplay: normalized.email || user.value.email,
			gosuslugiVerified: true
		};
		if (isBlindProfileCollection && onboardingInterest) {
			profileSeed.interest = onboardingInterest;
		}

		if (!onboardingName.value && normalized.firstName) {
			setOnboardingName(normalized.firstName);
		}

		const ensuredProfile = await ensureProfile(profileSeed);
		const updates: Partial<VolunteerProfile> = {};

		if (!normalizeText(ensuredProfile.firstName) && profileSeed.firstName) {
			updates.firstName = profileSeed.firstName;
		}

		if (!normalizeText(ensuredProfile.lastName) && profileSeed.lastName) {
			updates.lastName = profileSeed.lastName;
		}

		if (!normalizeText(ensuredProfile.phone) && profileSeed.phone) {
			updates.phone = profileSeed.phone;
		}

		if (!normalizeText(ensuredProfile.emailDisplay) && profileSeed.emailDisplay) {
			updates.emailDisplay = profileSeed.emailDisplay;
		}

		if (!ensuredProfile.gosuslugiVerified) {
			updates.gosuslugiVerified = true;
		}

		if (isBlindProfileCollection && onboardingInterest && normalizeInterestText(ensuredProfile.interest) !== onboardingInterest) {
			updates.interest = onboardingInterest;
		}

		if (Object.keys(updates).length > 0) {
			await updateProfile(updates);
		}
	}

	async function restoreFromYandexSession(): Promise<boolean> {
		try {
			const payload = await $fetch<YandexSessionResponse>("/api/auth/yandex/session", {
				credentials: "include"
			});

			if (!payload?.authenticated) {
				return false;
			}

			const applied = applyExternalStrapiSession(String(payload?.strapi?.token || ""), payload?.strapi?.user);
			if (!applied) {
				return false;
			}

			try {
				await syncProfileFromYandex(payload?.identity, payload?.user);
			} catch {
				// Keep login flow successful even if profile sync failed.
			}

			try {
				await refreshDashboard();
			} catch {
				// noop
			}

			return true;
		} catch {
			return false;
		}
	}

	function setOnboardingName(value: string): void {
		onboardingName.value = value.trim();

		if (!import.meta.client) {
			return;
		}

		if (onboardingName.value) {
			localStorage.setItem(ONBOARDING_NAME_KEY, onboardingName.value);
		} else {
			localStorage.removeItem(ONBOARDING_NAME_KEY);
		}
	}

	function findProfileByEmail(entries: any[], email: string, sourceCollection: ProfileCollection): any | null {
		const normalizedEmail = email.trim().toLowerCase();
		const emailField = sourceCollection === "profiles" ? "email" : "emailDisplay";
		const exactMatch = entries.find(entry => String(entry?.[emailField] || "").trim().toLowerCase() === normalizedEmail);
		return exactMatch || entries[0] || null;
	}

	function extractProfileUserId(entry: any, sourceCollection: ProfileCollection): number {
		const relationField = getProfileUserRelationField(sourceCollection);
		const relation = unwrapEntry(entry?.[relationField]?.data ?? entry?.[relationField]);
		return toNumber(relation?.id, 0);
	}

	async function loadProfileFromCollection(sourceCollection: ProfileCollection, hintedProfileId: number): Promise<VolunteerProfile | null> {
		if (!user.value) {
			return null;
		}

		if (hintedProfileId > 0) {
			try {
				const payload = await strapiRequest<any>(buildProfileByIdPath(hintedProfileId, sourceCollection));
				const selectedProfile = unwrapSingle(payload);

				if (selectedProfile) {
					profile.value = mapProfile(selectedProfile, sourceCollection);
					setProfileCollection(sourceCollection);
					persistProfileId(profile.value.id);
					return profile.value;
				}
			} catch {
				// Continue with filtered lookups.
			}
		}

		const pathCandidates = [
			...(sourceCollection === "volunteer-profiles"
				? [{ path: buildProfileByUserPath(user.value.id, sourceCollection), type: "user" as const }]
				: []),
			{ path: buildProfilesCatalogPath(sourceCollection), type: "catalog" as const },
			{ path: buildProfileByEmailPath(user.value.email, sourceCollection), type: "email" as const }
		];

		let lastError: unknown = null;

		for (const candidate of pathCandidates) {
			try {
				const entries = await requestListWithPublicationFallback(candidate.path);
				let selectedProfile: any | null = null;

				if (candidate.type === "catalog") {
					const byUserId = entries.filter(entry => extractProfileUserId(entry, sourceCollection) === user.value?.id);
					selectedProfile = findProfileByEmail(byUserId, user.value.email, sourceCollection);

					if (!selectedProfile) {
						const emailField = sourceCollection === "profiles" ? "email" : "emailDisplay";
						const byEmail = entries.filter(entry => String(entry?.[emailField] || "").trim().toLowerCase() === user.value?.email.trim().toLowerCase());
						selectedProfile = findProfileByEmail(byEmail, user.value.email, sourceCollection);
					}
				} else {
					selectedProfile = findProfileByEmail(entries, user.value.email, sourceCollection);
				}

				if (!selectedProfile) {
					continue;
				}

				profile.value = mapProfile(selectedProfile, sourceCollection);
				setProfileCollection(sourceCollection);
				persistProfileId(profile.value.id);
				return profile.value;
			} catch (error) {
				if (candidate.type === "user" && isUserFieldError(error)) {
					continue;
				}
				lastError = error;
			}
		}

		if (lastError) {
			throw lastError;
		}

		return null;
	}

	async function loadProfile(): Promise<VolunteerProfile | null> {
		if (!user.value) {
			profile.value = null;
			persistProfileId(null);
			return null;
		}

		const hintedProfileId = profile.value?.id || readPersistedProfileId();
		const sourceCandidates = [profileCollection.value];

		let lastError: unknown = null;

		for (const sourceCollection of sourceCandidates) {
			try {
				const loaded = await loadProfileFromCollection(sourceCollection, hintedProfileId);
				if (loaded) {
					return loaded;
				}
			} catch (error) {
				lastError = error;
			}
		}

		if (lastError) {
			throw lastError;
		}

		profile.value = null;
		persistProfileId(null);
		return null;
	}

	async function createProfile(initial: Partial<VolunteerProfile> = {}): Promise<VolunteerProfile> {
		if (!user.value) {
			throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ.");
		}

		const sourceCollection = profileCollection.value;
		const payload = await strapiRequest<any>(`/${sourceCollection}`, {
			method: "POST",
			body: {
				data: toProfileCreateData(initial, sourceCollection)
			}
		});

		const createdProfile = unwrapSingle(payload);
		if (!createdProfile) {
			throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїСЂРѕС„РёР»СЊ.");
		}

		profile.value = mapProfile(createdProfile, sourceCollection);
		setProfileCollection(sourceCollection);
		persistProfileId(profile.value.id);
		return profile.value;
	}

	async function ensureProfile(initial: Partial<VolunteerProfile> = {}): Promise<VolunteerProfile> {
		const existing = await loadProfile();
		if (existing) {
			return existing;
		}

		return await createProfile(initial);
	}

	async function loadAchievements(): Promise<VolunteerAchievement[]> {
		const catalog = await requestAchievementsCatalog();

		if (!profile.value) {
			achievements.value = catalog.map(item => mapAchievement(item, new Map<number, any>()));
			return achievements.value;
		}

		let progressEntries: any[] = [];
		try {
			progressEntries = await requestProgressByProfile(profile.value.id);
		} catch (error) {
			if (!shouldIgnoreProgressError(error)) {
				throw error;
			}
		}

		const progressByAchievementId = buildProgressMap(progressEntries);
		achievements.value = catalog.map(item => mapAchievement(item, progressByAchievementId));
		return achievements.value;
	}

	async function loadAchievementById(achievementId: number): Promise<VolunteerAchievement | null> {
		const cached = achievements.value.find(item => item.id === achievementId);
		if (cached) {
			return cached;
		}

		const rawAchievement = await requestAchievementById(achievementId);
		if (!rawAchievement) {
			return null;
		}

		let progressByAchievementId = new Map<number, any>();
		if (profile.value) {
			try {
				const progressEntries = await requestProgressByProfileAndAchievement(profile.value.id, achievementId);
				progressByAchievementId = buildProgressMap(progressEntries);
			} catch (error) {
				if (!shouldIgnoreProgressError(error)) {
					throw error;
				}
			}
		}

		const mapped = mapAchievement(rawAchievement, progressByAchievementId);
		achievements.value = [
			...achievements.value.filter(item => item.id !== mapped.id),
			mapped
		].sort((a, b) => a.id - b.id);

		return mapped;
	}

	async function refreshDashboard(): Promise<void> {
		await loadProfile();
		await syncCallAchievementProgress();
		await loadAchievements();
	}

	async function register(input: RegisterInput): Promise<void> {
		const email = input.email.trim().toLowerCase();
		const password = input.password.trim();

		const authPayload = await strapiRequest<StrapiAuthResponse>("/auth/local/register", {
			method: "POST",
			body: {
				username: email,
				email,
				password
			}
		});

		token.value = authPayload.jwt;
		user.value = authPayload.user;
		persistSession();
		setProfileCollection("volunteer-profiles");

		await ensureProfile({
			firstName: input.firstName?.trim() || onboardingName.value || DEFAULT_NAME,
			lastName: input.lastName?.trim() || "",
			phone: input.phone?.trim() || "",
			emailDisplay: email,
			gosuslugiVerified: false
		});

		await loadAchievements();
	}

	async function login(input: LoginInput): Promise<void> {
		const email = input.email.trim().toLowerCase();
		const password = input.password.trim();

		const authPayload = await strapiRequest<StrapiAuthResponse>("/auth/local", {
			method: "POST",
			body: {
				identifier: email,
				password
			}
		});

		token.value = authPayload.jwt;
		user.value = authPayload.user;
		persistSession();
		setProfileCollection("volunteer-profiles");

		await ensureProfile({
			firstName: onboardingName.value || DEFAULT_NAME,
			emailDisplay: email
		});

		await loadAchievements();
	}

	async function updateProfile(updates: Partial<VolunteerProfile>): Promise<VolunteerProfile> {
		if (!profile.value) {
			throw new Error("РџСЂРѕС„РёР»СЊ РЅРµ РЅР°Р№РґРµРЅ.");
		}

		const sourceCollection = profileCollection.value;
		const preparedUpdates = toProfileUpdateData(updates, sourceCollection);
		if (!Object.keys(preparedUpdates).length) {
			return profile.value;
		}

		const profileRefs = [
			profile.value.documentId.trim(),
			profile.value.id > 0 ? String(profile.value.id) : ""
		].filter(Boolean);

		let payload: any = null;
		let lastNotFoundError: unknown = null;

		for (const profileRef of profileRefs) {
			try {
				payload = await strapiRequest<any>(buildProfileByRefPath(profileRef, sourceCollection), {
					method: "PUT",
					body: {
						data: preparedUpdates
					}
				});
				lastNotFoundError = null;
				break;
			} catch (error) {
				if (isNotFoundError(error)) {
					lastNotFoundError = error;
					continue;
				}

				throw error;
			}
		}

		if (!payload) {
			if (lastNotFoundError) {
				throw lastNotFoundError;
			}

			throw new Error("Profile update target not found.");
		}

		const updated = unwrapSingle(payload);
		if (updated) {
			profile.value = mapProfile(updated, sourceCollection);
		} else {
			profile.value = {
				...profile.value,
				...preparedUpdates
			};
		}

		setProfileCollection(sourceCollection);
		persistProfileId(profile.value.id);
		return profile.value;
	}

	async function loadVolunteerReviews(targetVolunteerProfileId: number): Promise<VolunteerReview[]> {
		const normalizedProfileId = Math.floor(Number(targetVolunteerProfileId));
		if (!Number.isFinite(normalizedProfileId) || normalizedProfileId <= 0) {
			return [];
		}

		const deduped = new Map<number, VolunteerReview>();
		let hadRequestError = false;

		for (const relationField of REVIEW_RELATION_FIELD_CANDIDATES) {
			const path = `/review-valonteers?populate=*&sort=createdAt:desc&filters[${relationField}][id][$eq]=${normalizedProfileId}`;
			try {
				const entries = await requestListWithPublicationFallback(path);
				for (const entry of entries) {
					const reviewId = toNumber(entry?.id, 0);
					const text = normalizeReviewText(entry?.text);
					if (!reviewId || !text) {
						continue;
					}

					deduped.set(reviewId, {
						id: reviewId,
						text,
						createdAt: String(entry?.createdAt || "")
					});
				}
			} catch (error) {
				if (isUnknownFieldError(error)) {
					continue;
				}
				hadRequestError = true;
			}
		}

		if (!deduped.size && hadRequestError) {
			return [];
		}

		const sortedByDate = [...deduped.values()].sort((a, b) => {
			const left = Date.parse(a.createdAt || "") || 0;
			const right = Date.parse(b.createdAt || "") || 0;
			return right - left;
		});

		// Some users send the same review multiple times; keep only the newest unique text.
		const uniqueByText = new Set<string>();
		const result: VolunteerReview[] = [];
		for (const review of sortedByDate) {
			const textKey = normalizeReviewText(review.text).toLowerCase();
			if (!textKey || uniqueByText.has(textKey)) {
				continue;
			}
			uniqueByText.add(textKey);
			result.push(review);
		}

		return result;
	}

	async function resolveVolunteerProfileForReview(targetVolunteerProfileId: number): Promise<{ id: number, documentId: string } | null> {
		if (!Number.isFinite(targetVolunteerProfileId) || targetVolunteerProfileId <= 0) {
			return null;
		}

		const resolvedCurrentProfileDocumentId = String(profile.value?.documentId || "").trim();
		if (
			profileCollection.value === "volunteer-profiles"
			&& profile.value?.id === targetVolunteerProfileId
			&& resolvedCurrentProfileDocumentId
		) {
			return {
				id: profile.value.id,
				documentId: resolvedCurrentProfileDocumentId
			};
		}

		const lookupPaths = [
			`/volunteer-profiles?filters[id][$eq]=${targetVolunteerProfileId}&populate=*`,
			`/volunteer-profiles?filters[user][id][$eq]=${targetVolunteerProfileId}&populate=*`,
			"/volunteer-profiles?populate=*"
		];

		const toResolvedProfile = (entry: any): { id: number, documentId: string } | null => {
			const resolvedId = toNumber(entry?.id, 0);
			const resolvedDocumentId = String(entry?.documentId || "").trim();
			if (resolvedId <= 0 || !resolvedDocumentId) {
				return null;
			}

			return {
				id: resolvedId,
				documentId: resolvedDocumentId
			};
		};

		for (const path of lookupPaths) {
			try {
				const entries = await requestListWithPublicationFallback(path);
				if (!entries.length) {
					continue;
				}

				const byId = entries.find(entry => toNumber(entry?.id, 0) === targetVolunteerProfileId);
				const byUserId = entries.find(entry => extractProfileUserId(entry, "volunteer-profiles") === targetVolunteerProfileId);

				const resolvedById = toResolvedProfile(byId);
				if (resolvedById) {
					return resolvedById;
				}

				const resolvedByUserId = toResolvedProfile(byUserId);
				if (resolvedByUserId) {
					return resolvedByUserId;
				}

				if (path !== "/volunteer-profiles?populate=*") {
					const resolvedFirst = toResolvedProfile(entries[0]);
					if (resolvedFirst) {
						return resolvedFirst;
					}
				}
			} catch (error) {
				if (isNotFoundError(error) || isUnknownFieldError(error)) {
					continue;
				}
			}
		}

		return null;
	}

	function buildReviewRelationPayloadCandidates(profileDocumentId: string): any[] {
		const normalizedDocumentId = String(profileDocumentId || "").trim();
		if (!normalizedDocumentId) {
			return [];
		}

		const candidates: any[] = [
			normalizedDocumentId,
			{
				connect: [normalizedDocumentId]
			},
			{
				connect: [{ documentId: normalizedDocumentId }]
			}
		];

		const deduped = new Map<string, any>();
		for (const candidate of candidates) {
			const key = JSON.stringify(candidate);
			if (!deduped.has(key)) {
				deduped.set(key, candidate);
			}
		}

		return [...deduped.values()];
	}

	async function submitVolunteerReview(
		targetVolunteerProfileId: number | null,
		reviewText: string,
		targetVolunteerProfileDocumentId = ""
	): Promise<void> {
		const normalizedProfileId = Math.floor(Number(targetVolunteerProfileId));
		const hasValidProfileId = Number.isFinite(normalizedProfileId) && normalizedProfileId > 0;
		const normalizedTargetProfileDocumentId = String(targetVolunteerProfileDocumentId || "").trim();
		if (!hasValidProfileId && !normalizedTargetProfileDocumentId) {
			throw new Error("Не удалось определить профиль волонтера для отзыва.");
		}

		const normalizedReview = normalizeReviewText(reviewText).slice(0, 1000);
		if (!normalizedReview) {
			throw new Error("Введите текст отзыва перед отправкой.");
		}

		let resolvedVolunteerProfileDocumentId = normalizedTargetProfileDocumentId;
		if (!resolvedVolunteerProfileDocumentId && hasValidProfileId) {
			const resolvedVolunteerProfile = await resolveVolunteerProfileForReview(normalizedProfileId);
			if (resolvedVolunteerProfile?.documentId) {
				resolvedVolunteerProfileDocumentId = resolvedVolunteerProfile.documentId;
			}
		}

		if (!resolvedVolunteerProfileDocumentId) {
			throw new Error("Не удалось определить профиль волонтера для привязки отзыва.");
		}

		const relationPayloadCandidates = buildReviewRelationPayloadCandidates(resolvedVolunteerProfileDocumentId);

		let lastWriteError: unknown = null;

		for (const relationField of REVIEW_RELATION_FIELD_CANDIDATES) {
			let unknownField = false;
			for (const relationPayload of relationPayloadCandidates) {
				try {
					await strapiRequest<any>("/review-valonteers", {
						method: "POST",
						body: {
							data: {
								text: normalizedReview,
								[relationField]: relationPayload
							}
						}
					});
					return;
				} catch (error) {
					if (isUnknownFieldError(error)) {
						unknownField = true;
						break;
					}
					lastWriteError = error;
					continue;
				}
			}

			if (unknownField) {
				continue;
			}
		}

		if (lastWriteError) {
			throw lastWriteError;
		}

		throw new Error("Не удалось сохранить отзыв: проверь поле связи с волонтером в review-valonteers.");
	}

	async function restoreSession(): Promise<void> {
		if (initialized.value) {
			return;
		}

		if (import.meta.client) {
			token.value = localStorage.getItem(TOKEN_KEY);
			profileCollection.value = readPersistedProfileCollection();

			const rawUser = localStorage.getItem(USER_KEY);
			if (rawUser) {
				try {
					user.value = JSON.parse(rawUser);
				} catch {
					user.value = null;
				}
			}

			const rawName = localStorage.getItem(ONBOARDING_NAME_KEY);
			if (rawName) {
				onboardingName.value = rawName;
			}
		}

		const restoredFromYandex = await restoreFromYandexSession();

		if (!restoredFromYandex && token.value && user.value) {
			try {
				await refreshDashboard();
			} catch {
				token.value = null;
				user.value = null;
				profile.value = null;
				achievements.value = [];
				clearSessionStorage();
			}
		}

		initialized.value = true;
	}

	async function logout(): Promise<void> {
		try {
			await $fetch("/api/auth/yandex/logout", {
				method: "POST",
				credentials: "include"
			});
		} catch {
			// noop
		}

		token.value = null;
		user.value = null;
		profile.value = null;
		profileCollection.value = "volunteer-profiles";
		achievements.value = [];
		setOnboardingName("");
		clearSessionStorage();
	}

	async function deleteAccount(): Promise<void> {
		if (!user.value?.id) {
			throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ.");
		}

		try {
			await strapiRequest<any>(buildDeleteOwnAccountPath(), {
				method: "POST"
			});

			await logout();
			return;
		} catch (error) {
			if (!isNotFoundError(error) && !isMethodNotAllowedError(error)) {
				throw new Error(`Failed to delete account. ${normalizeError(error)}`);
			}
		}

		try {
			await strapiRequest<any>(buildDeleteOwnAccountLegacyPath(), {
				method: "DELETE"
			});

			await logout();
			return;
		} catch (error) {
			if (!isNotFoundError(error) && !isMethodNotAllowedError(error)) {
				throw new Error(`Failed to delete account. ${normalizeError(error)}`);
			}
		}

		const userId = user.value.id;
		const profileRefsToDelete = new Map<ProfileCollection, Set<string>>([
			["volunteer-profiles", new Set<string>()],
			["profiles", new Set<string>()]
		]);

		const currentCollection = profileCollection.value;
		if (profile.value?.documentId?.trim()) {
			profileRefsToDelete.get(currentCollection)?.add(profile.value.documentId.trim());
		}
		if ((profile.value?.id || 0) > 0) {
			profileRefsToDelete.get(currentCollection)?.add(String(profile.value?.id || 0));
		}

		for (const sourceCollection of ["volunteer-profiles", "profiles"] as ProfileCollection[]) {
			try {
				const profiles = await requestListWithPublicationFallback(buildProfileByUserPath(userId, sourceCollection));
				const refs = profileRefsToDelete.get(sourceCollection);
				if (!refs) {
					continue;
				}

				for (const entry of profiles) {
					const documentId = String(entry?.documentId || "").trim();
					const profileId = toNumber(entry?.id, 0);
					if (documentId) {
						refs.add(documentId);
					}
					if (profileId > 0) {
						refs.add(String(profileId));
					}
				}
			} catch (error) {
				if (!isForbiddenError(error) && !isUserFieldError(error)) {
					throw error;
				}
			}

			try {
				const profiles = await requestListWithPublicationFallback(buildProfileByEmailPath(user.value.email, sourceCollection));
				const refs = profileRefsToDelete.get(sourceCollection);
				if (!refs) {
					continue;
				}

				for (const entry of profiles) {
					const documentId = String(entry?.documentId || "").trim();
					const profileId = toNumber(entry?.id, 0);
					if (documentId) {
						refs.add(documentId);
					}
					if (profileId > 0) {
						refs.add(String(profileId));
					}
				}
			} catch (error) {
				if (!isForbiddenError(error)) {
					throw error;
				}
			}
		}

		for (const sourceCollection of ["volunteer-profiles", "profiles"] as ProfileCollection[]) {
			const refs = profileRefsToDelete.get(sourceCollection) || new Set<string>();
			for (const profileRef of refs) {
				try {
					await strapiRequest<any>(buildProfileDeleteByRefPath(profileRef, sourceCollection), {
						method: "DELETE"
					});
				} catch (error) {
					if (isNotFoundError(error)) {
						continue;
					}
					throw error;
				}
			}
		}

		try {
			await strapiRequest<any>(buildUserByIdPath(userId), {
				method: "DELETE"
			});
		} catch (error) {
			if (!isNotFoundError(error)) {
				throw new Error(`РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚. ${normalizeError(error)}`);
			}
		}

		await logout();
	}

	return {
		token,
		user,
		profile,
		profileCollection,
		achievements,
		onboardingName,
		isLoggedIn,
		restoreSession,
		register,
		login,
		logout,
		deleteAccount,
		refreshDashboard,
		loadAchievementById,
		syncCallAchievementProgress,
		restoreFromYandexSession,
		updateProfile,
		loadVolunteerReviews,
		submitVolunteerReview,
		setOnboardingName,
		normalizeError
	};
}

