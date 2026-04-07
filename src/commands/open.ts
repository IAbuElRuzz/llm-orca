import chalk from "chalk";
import { appendHistory } from "../core/history.js";
import { resolveProvider } from "../core/provider-resolution.js";
import { getConfig } from "../core/config.js";

export async function openProvider(providerName: string | undefined, cwd: string): Promise<void> {
  const provider = await resolveProvider(providerName);
  const status = provider.getStatus();
  const config = await getConfig();

  if (!status.installed) {
    throw new Error(`Provider binary '${status.binary}' is not installed or not in PATH.`);
  }

  console.log(chalk.cyan(`Opening ${provider.name}...`));
  const exitCode = await provider.openInteractive(cwd);

  if (config.historyEnabled) {
    await appendHistory({
      provider: provider.name,
      mode: "open",
      cwd,
      exitCode,
    });
  }

  process.exitCode = exitCode;
}
