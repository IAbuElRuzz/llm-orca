import chalk from "chalk";
import { getAllProviders } from "../providers/index.js";

export async function listProviders(): Promise<void> {
  console.log(chalk.bold("Supported providers"));
  for (const provider of getAllProviders()) {
    const caps = provider.getCapabilities();
    console.log(`- ${provider.name} (${provider.binary})`);
    console.log(`  interactive=${caps.interactive} oneShot=${caps.oneShot} json=${caps.jsonOutput} sandbox=${caps.sandboxModes.join(",")}`);
  }
}
