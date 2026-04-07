import chalk from "chalk";
import { readRecentHistory } from "../core/history.js";

export async function showHistory(limit = 20): Promise<void> {
  const entries = await readRecentHistory(limit);

  if (entries.length === 0) {
    console.log(chalk.yellow("No history entries yet."));
    return;
  }

  for (const entry of entries) {
    console.log(chalk.bold(`${entry.timestamp}  ${entry.provider}  ${entry.mode}`));
    console.log(`  cwd: ${entry.cwd}`);
    if (entry.promptPreview) {
      console.log(`  prompt: ${entry.promptPreview}`);
    }
    if (entry.profileName) {
      console.log(`  profile: ${entry.profileName}`);
    }
    if (entry.approvalPolicy) {
      console.log(`  approval: ${entry.approvalPolicy}`);
    }
    if (entry.sandboxMode) {
      console.log(`  sandbox: ${entry.sandboxMode}`);
    }
    if (entry.contextFiles?.length) {
      console.log(`  context: ${entry.contextFiles.join(", ")}`);
    }
    if (entry.transcriptPath) {
      console.log(`  transcript: ${entry.transcriptPath}`);
    }
    if (entry.results?.length) {
      for (const result of entry.results) {
        console.log(`  - ${result.provider}: exit=${result.exitCode}${result.score !== undefined ? ` score=${result.score}` : ""}`);
        if (result.transcriptPath) {
          console.log(`    transcript: ${result.transcriptPath}`);
        }
      }
    } else if (entry.exitCode !== undefined) {
      console.log(`  exit: ${entry.exitCode}`);
    }
    console.log("");
  }
}
