import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { getConfig } from "../core/config.js";
import { getAllProviders } from "../providers/index.js";
import { runPrompt } from "./run.js";
import { compareProviders } from "./compare.js";
import { switchProvider } from "./switch.js";
import { showHistory } from "./history.js";
import { listPromptTemplates } from "./template.js";

export async function openMenu(cwd: string): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const config = await getConfig();
      console.log(chalk.bold("\nLLM Router V3 Menu"));
      console.log(`Active provider: ${config.activeProvider}`);
      console.log("1) Switch provider");
      console.log("2) Run prompt with active provider");
      console.log("3) Compare providers");
      console.log("4) Show history");
      console.log("5) List templates");
      console.log("6) Exit");

      const choice = (await rl.question("Choose an option: ")).trim();

      if (choice === "1") {
        const providers = getAllProviders().map((provider) => provider.name).join(", ");
        const next = (await rl.question(`Provider (${providers}): `)).trim();
        await switchProvider(next);
      } else if (choice === "2") {
        const prompt = await rl.question("Prompt: ");
        await runPrompt({ cwd, prompt });
      } else if (choice === "3") {
        const prompt = await rl.question("Prompt: ");
        const providers = (await rl.question("Providers (comma separated): ")).trim();
        await compareProviders({ cwd, prompt, providers: providers.split(",").map((value) => value.trim()) });
      } else if (choice === "4") {
        await showHistory(15);
      } else if (choice === "5") {
        await listPromptTemplates(cwd);
      } else if (choice === "6") {
        return;
      } else {
        console.log(chalk.red("Invalid option."));
      }
    }
  } finally {
    rl.close();
  }
}
