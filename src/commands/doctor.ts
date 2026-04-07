import chalk from "chalk";
import { getAllProviders } from "../providers/index.js";
import { getConfig, getProjectConfig } from "../core/config.js";

export async function runDoctor(cwd = process.cwd()): Promise<void> {
  const config = await getConfig();
  const project = await getProjectConfig(cwd);

  console.log(chalk.bold("LLM Router Doctor"));
  console.log(`Active provider: ${config.activeProvider}`);
  console.log(`Default approval policy: ${config.defaultApprovalPolicy}`);
  console.log(`Default sandbox mode: ${config.defaultSandboxMode}`);
  console.log(`History enabled: ${config.historyEnabled ? "yes" : "no"}`);
  console.log(`Project profiles: ${project ? project.path : "not found"}`);
  console.log("");

  for (const provider of getAllProviders()) {
    const status = provider.getStatus();
    const caps = provider.getCapabilities();

    console.log(chalk.bold(provider.name));
    console.log(`  Binary:       ${status.binary}`);
    console.log(`  Installed:    ${status.installed ? chalk.green("yes") : chalk.red("no")}`);
    console.log(`  Path:         ${status.resolvedPath ?? "not found"}`);
    console.log(`  Interactive:  ${caps.interactive ? "yes" : "no"}`);
    console.log(`  One-shot:     ${caps.oneShot ? "yes" : "no"}`);
    console.log(`  JSON output:  ${caps.jsonOutput ? "yes" : "no"}`);
    console.log(`  Sandbox:      ${caps.sandboxModes.join(", ")}`);

    if (!status.installed) {
      console.log(`  Action:       Install '${status.binary}' and ensure it is in PATH.`);
    } else {
      console.log(`  Action:       Launch '${status.binary}' once and complete local login if required.`);
    }

    for (const note of status.notes ?? []) {
      console.log(`  Note:         ${note}`);
    }

    console.log("");
  }
}
