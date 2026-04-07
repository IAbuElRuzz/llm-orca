import chalk from "chalk";
import { getProjectConfig, writeProjectConfig } from "../core/config.js";
import { assertProviderName } from "../core/provider-resolution.js";
import type { ApprovalPolicy, SandboxMode } from "../types/provider.js";

export interface ProfileCreateInput {
  cwd: string;
  name: string;
  provider?: string;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  json?: boolean;
  extraArgs?: string[];
  includeFiles?: string[];
  template?: string;
  setDefault?: boolean;
}

export async function listProfiles(cwd: string): Promise<void> {
  const project = await getProjectConfig(cwd);
  if (!project) {
    console.log(chalk.yellow("No project profile file found. Run 'llm-router profile init <name>' to create one."));
    return;
  }

  console.log(chalk.bold(`Profiles in ${project.path}`));
  for (const [name, profile] of Object.entries(project.config.profiles)) {
    const marker = project.config.defaultProfile === name ? chalk.green(" (default)") : "";
    console.log(`- ${name}${marker}`);
    console.log(`  provider=${profile.provider ?? "inherit"} model=${profile.model ?? "-"} approval=${profile.approvalPolicy ?? "-"} sandbox=${profile.sandboxMode ?? "-"}`);
    console.log(`  json=${profile.json ? "yes" : "no"} template=${profile.template ?? "-"} includeFiles=${profile.includeFiles?.join(",") ?? "-"}`);
  }
}

export async function initProfile(input: ProfileCreateInput): Promise<void> {
  const project = await getProjectConfig(input.cwd);
  const config = project?.config ?? { profiles: {}, routingRules: [], templates: {} };

  config.profiles[input.name] = {
    name: input.name,
    provider: input.provider ? assertProviderName(input.provider) : undefined,
    model: input.model,
    approvalPolicy: input.approvalPolicy,
    sandboxMode: input.sandboxMode,
    json: input.json,
    extraArgs: input.extraArgs ?? [],
    includeFiles: input.includeFiles ?? [],
    template: input.template,
  };

  if (input.setDefault) {
    config.defaultProfile = input.name;
  }

  const target = await writeProjectConfig(project?.dir ?? input.cwd, config);
  console.log(chalk.green(`Profile '${input.name}' written to ${target}`));
}
