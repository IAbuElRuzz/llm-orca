import chalk from "chalk";
import { setActiveProvider } from "../core/config.js";
import { assertProviderName } from "../core/provider-resolution.js";

export async function switchProvider(provider: string): Promise<void> {
  const resolved = assertProviderName(provider);
  await setActiveProvider(resolved);
  console.log(chalk.green(`Active provider set to ${resolved}`));
}
