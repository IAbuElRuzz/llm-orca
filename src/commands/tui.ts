import readline from "node:readline";
import chalk from "chalk";
import { getConfig } from "../core/config.js";
import { showHistory } from "./history.js";
import { runPrompt } from "./run.js";
import { compareProviders } from "./compare.js";
import { listPromptTemplates } from "./template.js";

type MenuAction = "run" | "compare" | "history" | "templates" | "quit";

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[0f");
}

async function askLine(prompt: string): Promise<string> {
  process.stdin.setRawMode?.(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => rl.question(prompt, (answer) => {
    rl.close();
    process.stdin.setRawMode?.(true);
    resolve(answer);
  }));
}

export async function openTui(cwd: string): Promise<void> {
  const actions: { label: string; value: MenuAction }[] = [
    { label: "Run prompt with active provider", value: "run" },
    { label: "Compare providers", value: "compare" },
    { label: "Show history", value: "history" },
    { label: "List templates", value: "templates" },
    { label: "Quit", value: "quit" },
  ];

  let selected = 0;
  clearScreen();
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const render = async () => {
    const config = await getConfig();
    clearScreen();
    console.log(chalk.bold("LLM Router V3 TUI"));
    console.log(chalk.gray(`Active provider: ${config.activeProvider} | arrows = move | enter = select | q = quit\n`));
    actions.forEach((action, index) => {
      const prefix = index === selected ? chalk.cyan(">") : " ";
      const line = index === selected ? chalk.cyan(action.label) : action.label;
      console.log(`${prefix} ${line}`);
    });
  };

  await render();

  await new Promise<void>((resolve) => {
    const onData = async (key: string) => {
      if (key === "\u0003" || key === "q") {
        cleanup();
        resolve();
        return;
      }
      if (key === "\u001B[A") {
        selected = selected === 0 ? actions.length - 1 : selected - 1;
        await render();
        return;
      }
      if (key === "\u001B[B") {
        selected = selected === actions.length - 1 ? 0 : selected + 1;
        await render();
        return;
      }
      if (key === "\r") {
        const choice = actions[selected].value;
        if (choice === "quit") {
          cleanup();
          resolve();
          return;
        }
        if (choice === "run") {
          const prompt = await askLine("Prompt: ");
          await runPrompt({ cwd, prompt });
        } else if (choice === "compare") {
          const prompt = await askLine("Prompt: ");
          const providers = await askLine("Providers (comma separated): ");
          await compareProviders({ cwd, prompt, providers: providers.split(",").map((v) => v.trim()).filter(Boolean) });
        } else if (choice === "history") {
          process.stdin.removeListener("data", onData);
          process.stdin.setRawMode?.(false);
          await showHistory(20);
          await askLine("\nPress Enter to return...");
          process.stdin.setRawMode?.(true);
          process.stdin.on("data", onData);
        } else if (choice === "templates") {
          process.stdin.removeListener("data", onData);
          process.stdin.setRawMode?.(false);
          await listPromptTemplates(cwd);
          await askLine("\nPress Enter to return...");
          process.stdin.setRawMode?.(true);
          process.stdin.on("data", onData);
        }
        await render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode?.(false);
      clearScreen();
    };

    process.stdin.on("data", onData);
  });
}
