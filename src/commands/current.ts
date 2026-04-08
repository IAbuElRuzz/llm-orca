import chalk from "chalk";
import { getActiveModel, getConfig } from "../core/config.js";

export async function showCurrentProvider(): Promise<void> {
  const config = await getConfig();
  const model = await getActiveModel(config.activeProvider);
  if (model) {
    console.log(chalk.green(`${config.activeProvider} (${model})`));
    return;
  }
  console.log(chalk.green(config.activeProvider));
}
