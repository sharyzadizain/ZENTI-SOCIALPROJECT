import process from "node:process";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineNuxtConfig({
	runtimeConfig: {
		yandexClientId: process.env.NUXT_YANDEX_CLIENT_ID || "",
		yandexClientSecret: process.env.NUXT_YANDEX_CLIENT_SECRET || "",
		yandexRedirectUri: process.env.NUXT_YANDEX_REDIRECT_URI || "http://localhost:3000/api/auth/yandex/callback",
		strapiOauthPasswordSalt: process.env.NUXT_STRAPI_OAUTH_PASSWORD_SALT || "dev-oauth-salt",
		langflowBaseUrl: process.env.NUXT_LANGFLOW_BASE_URL || "",
		langflowApiKey: process.env.NUXT_LANGFLOW_API_KEY || "",
		langflowTimeoutMs: Number.parseInt(process.env.NUXT_LANGFLOW_TIMEOUT_MS || "30000", 10),
		langflowCallAssistant1FlowId: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_1_FLOW_ID || "",
		langflowCallAssistant2FlowId: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_2_FLOW_ID || "",
		langflowCallAssistant3FlowId: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_3_FLOW_ID || "",
		langflowCallAssistant4FlowId: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_4_FLOW_ID || "",
		langflowCallAssistant1Name: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_1_NAME || "Олеся AI",
		langflowCallAssistant2Name: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_2_NAME || "Олеся AI",
		langflowCallAssistant3Name: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_3_NAME || "Assistant 3",
		langflowCallAssistant4Name: process.env.NUXT_LANGFLOW_CALL_ASSISTANT_4_NAME || "Assistant 4",
		public: {
			strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || "http://localhost:1337",
			callAssistant1Name: process.env.NUXT_PUBLIC_CALL_ASSISTANT_1_NAME || "Олеся AI",
			callAssistant2Name: process.env.NUXT_PUBLIC_CALL_ASSISTANT_2_NAME || "Олеся AI",
			callAssistant3Name: process.env.NUXT_PUBLIC_CALL_ASSISTANT_3_NAME || "Assistant 3",
			callAssistant4Name: process.env.NUXT_PUBLIC_CALL_ASSISTANT_4_NAME || "Assistant 4"
		}
	},
	modules: [
		"nuxt-auth-utils",
		"@nuxt/eslint"
	],
	css: [
		"@/assets/css/main.css"
	],
	ssr: false,
	vite: {
		clearScreen: false,
		envPrefix: ["VITE_", "TAURI_"],
		plugins: [
			tailwindcss()
		],
		server: {
			strictPort: true,
			hmr: host
				? {
					protocol: "ws",
					host,
					port: 3001
				}
				: undefined,
			watch: {
				ignored: ["**/src-tauri/**"]
			}
		}
	},
	devServer: {
		host: host || "0.0.0.0"
	},
	eslint: {
		config: {
			standalone: false
		}
	},
	devtools: {
		enabled: true
	},
	compatibilityDate: "2026-01-01"
});
