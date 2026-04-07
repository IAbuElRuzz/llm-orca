import { spawn, spawnSync } from "node:child_process";

export function which(binary: string): string | undefined {
  const command = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(command, [binary], { encoding: "utf8" });

  if (result.status !== 0) {
    return undefined;
  }

  const first = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return first || undefined;
}

export async function runInherited(
  command: string,
  args: string[],
  cwd: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export interface CapturedResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCaptured(
  command: string,
  args: string[],
  cwd: string,
): Promise<CapturedResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}
