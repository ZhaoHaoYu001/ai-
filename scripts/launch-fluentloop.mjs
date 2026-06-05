import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function isFluentLoopReady(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/health`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    const health = await response.json();
    return health.status === "ok" && health.app === "FluentLoop";
  } catch {
    return false;
  }
}

export async function waitForFluentLoop(url, attempts = 20, intervalMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isFluentLoopReady(url)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

export function startDetachedServer(rootDir = root, env = process.env) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    detached: true,
    env,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child.pid;
}

export function openBrowser(url) {
  if (process.env.FLUENTLOOP_NO_OPEN === "1") return;
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export async function launch({
  host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT) || 4173
} = {}) {
  const url = `http://${host}:${port}`;
  if (await isFluentLoopReady(url)) {
    console.log(`[FluentLoop] Already running at ${url}`);
    openBrowser(url);
    return { status: "existing", url };
  }

  console.log("[FluentLoop] Starting in the background...");
  startDetachedServer(root, { ...process.env, HOST: host, PORT: String(port) });
  if (!(await waitForFluentLoop(url))) {
    throw new Error(`The service did not become healthy at ${url}/health`);
  }

  console.log(`[FluentLoop] Running at ${url}`);
  openBrowser(url);
  return { status: "started", url };
}

const isEntryPoint = process.argv[1] &&
  pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  launch().catch(error => {
    console.error(`[FluentLoop] ${error.message}`);
    process.exitCode = 1;
  });
}
