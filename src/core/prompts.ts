import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ApprovalPolicy } from "../types/provider.js";

export async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

export async function enforceApprovalPolicy(policy: ApprovalPolicy, prompt: string): Promise<void> {
  if (policy === "auto") return;
  if (policy === "never") {
    throw new Error("Execution blocked by approval policy 'never'. Switch policy to 'ask' or 'auto' to run prompts.");
  }
  const accepted = await confirmAction(`Approve execution for prompt: ${prompt.slice(0, 160)}`);
  if (!accepted) {
    throw new Error("Execution cancelled by user.");
  }
}
