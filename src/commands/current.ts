import chalk from "chalk";
import { getConfig } from "../core/config.js";

export async function showCurrentProvider(): Promise<void> {
  const config = await getConfig();
  console.log(chalk.green(config.activeProvider));
}
