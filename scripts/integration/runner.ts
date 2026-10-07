import { spawn } from "node:child_process";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { settingsSchema } from "../../electron/core/settings";
import { redact } from "../../electron/core/redact";
import {
  fixtureCredentials,
  fixtureSettings,
  integrationPaths,
  integrationProject,
  integrationDebugArguments,
  endpointsFromCompose,
  providerIds,
  type Endpoints,
  type FixtureState,
} from "./config";
import { setupServers } from "./servers";
import { verifyServers } from "./verify";

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function command(
  root: string,
  executable: string,
  args: string[],
  capture = false,
  env = process.env,
): Promise<string> {
  const child = spawn(executable, args, {
    cwd: root,
    env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  let stdout = "",
    stderr = "";
  if (capture) {
    child.stdout!.on("data", (value: Buffer) => {
      stdout += value.toString();
    });
    child.stderr!.on("data", (value: Buffer) => {
      stderr += value.toString();
    });
  }
  const forward = (signal: NodeJS.Signals) => child.kill(signal);
  const interrupt = () => forward("SIGINT"),
    terminate = () => forward("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `${executable} ${args[0] ?? ""} failed (${signal ?? code}). ${redact(stderr)}`,
              ),
            ),
      );
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
  return stdout;
}

async function saveJson(path: string, input: unknown) {
  await mkdir(join(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(input, null, 2), { mode: 0o600 });
  const { rename } = await import("node:fs/promises");
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function loadState(
  path: string,
  project: string,
  endpoints: Endpoints,
): Promise<FixtureState> {
  if (!(await exists(path)))
    throw new Error("Run pnpm integration:up before integration verification or app startup.");
  const state = JSON.parse(await readFile(path, "utf8")) as FixtureState;
  if (
    state.project !== project ||
    providerIds.some((id) => state.servers?.[id]?.baseUrl !== endpoints[id])
  )
    throw new Error(
      "Fixture state does not match this Compose project/ports. Run pnpm integration:up again.",
    );
  return state;
}

export async function run(root: string, action: string) {
  if (!["up", "verify", "app", "down", "reset", "status"].includes(action))
    throw new Error("Integration action: up | verify | app | down | reset | status");
  const file = join(root, "integration/compose.yaml");
  const envFile = join(root, "integration/.env");
  const args = ["compose", "-f", file, ...((await exists(envFile)) ? ["--env-file", envFile] : [])];
  try {
    const compose = JSON.parse(
      await command(root, "docker", [...args, "config", "--format", "json"], true),
    ) as { name: string; services: Parameters<typeof endpointsFromCompose>[0]["services"] };
    const project = integrationProject(compose.name);
    const endpoints = endpointsFromCompose(compose);
    const paths = integrationPaths(root, project);
    if (action === "down" || action === "reset") {
      await command(root, "docker", [
        ...args,
        "down",
        "--remove-orphans",
        ...(action === "reset" ? ["--volumes"] : []),
      ]);
      if (action === "reset") await rm(paths.directory, { recursive: true, force: true });
      return;
    }
    if (action === "status") {
      await command(root, "docker", [...args, "ps", "-a"]);
      return;
    }
    if (action === "up") {
      await command(root, "docker", [...args, "up", "-d", "--remove-orphans"]);
      const state = await setupServers(project, endpoints);
      await saveJson(paths.state, state);
      console.log(
        `Test account (Emby/Jellyfin): ${fixtureCredentials.username} / ${fixtureCredentials.password}`,
      );
      for (const id of providerIds) console.log(`${id}: ${endpoints[id]}`);
      console.log(
        "Next: pnpm test:integration; pnpm integration:app for Electron/player acceptance.",
      );
      return;
    }
    const state = await loadState(paths.state, project, endpoints);
    if (action === "verify") {
      await saveJson(paths.report, await verifyServers(state));
      console.log(`Integration report: ${paths.report}`);
      return;
    }
    await mkdir(paths.app, { recursive: true });
    const settings = join(paths.app, "settings.json");
    const previous = (await exists(settings))
      ? settingsSchema.parse(JSON.parse(await readFile(settings, "utf8")))
      : undefined;
    await saveJson(settings, fixtureSettings(endpoints, previous));
    const debug = integrationDebugArguments(process.env.FREEBO_INTEGRATION_DEBUG_PORT);
    const vite = await import("vite");
    await vite.build({ root });
    await import(pathToFileURL(join(root, "scripts/build-electron.mjs")).href);
    const electron: unknown = (await import("electron")).default;
    if (typeof electron !== "string")
      throw new Error(
        "integration:app must run in Node.js, where the Electron package provides its executable path.",
      );
    console.log(`Isolated Freebo profile: ${paths.app}`);
    const environment: NodeJS.ProcessEnv = { ...process.env, FREEBO_USER_DATA_DIR: paths.app };
    delete environment.FREEBO_DEV_URL;
    await command(root, electron, [root, ...debug], false, environment);
  } catch (error) {
    if (error instanceof AggregateError)
      for (const cause of error.errors)
        console.error(redact(cause instanceof Error ? cause.message : cause));
    console.error(redact(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  }
}
