import { spawn } from "node:child_process";
import { createServer } from "node:net";

const DEFAULT_PORT = 3000;

function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => {
			server.close(() => resolve(true));
		});
		server.listen(port, "0.0.0.0");
	});
}

async function findAvailablePort(startPort: number): Promise<number> {
	for (let port = startPort; port < startPort + 100; port++) {
		if (await isPortAvailable(port)) {
			return port;
		}
	}
	throw new Error(`No available port found in range ${startPort}-${startPort + 99}`);
}

async function main(): Promise<void> {
	const port = await findAvailablePort(DEFAULT_PORT);

	if (port !== DEFAULT_PORT) {
		console.log(`Port ${DEFAULT_PORT} is busy, using port ${port}`);
	}

	const tauriConfig = JSON.stringify({
		build: {
			devUrl: `http://localhost:${port}`,
			beforeDevCommand: `npm run dev -- --port ${port}`
		}
	});

	const npmExecPath = process.env.npm_execpath;
	const command = npmExecPath ? process.execPath : "npm";
	const args = npmExecPath
		? [npmExecPath, "run", "tauri", "--", "dev", "--config", tauriConfig]
		: ["run", "tauri", "--", "dev", "--config", tauriConfig];

	const tauri = spawn(command, args, {
		stdio: "inherit",
		cwd: process.cwd(),
		shell: !npmExecPath && process.platform === "win32"
	});

	tauri.on("error", (error) => {
		console.error(`Failed to start Tauri dev command: ${error.message}`);
		process.exit(1);
	});

	tauri.on("close", (code) => {
		process.exit(code ?? 0);
	});
}

main();
