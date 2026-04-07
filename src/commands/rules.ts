import chalk from "chalk";
import { getProjectConfig, writeProjectConfig } from "../core/config.js";
import { assertProviderName } from "../core/provider-resolution.js";

export async function listRules(cwd: string): Promise<void> {
  const project = await getProjectConfig(cwd);
  if (!project?.config.routingRules?.length) {
    console.log(chalk.yellow("No routing rules found."));
    return;
  }

  console.log(chalk.bold(`Routing rules in ${project.path}`));
  for (const rule of project.config.routingRules) {
    console.log(`- ${rule.name}: matchAny=[${(rule.matchAny ?? []).join(", ")}] provider=${rule.provider ?? "-"} profile=${rule.profile ?? "-"}`);
  }
}

export async function addRule(cwd: string, name: string, terms: string[], provider?: string, profile?: string): Promise<void> {
  const existing = await getProjectConfig(cwd);
  const config = existing?.config ?? { profiles: {}, routingRules: [], templates: {} };
  config.routingRules = config.routingRules ?? [];
  config.routingRules = config.routingRules.filter((rule) => rule.name !== name);
  config.routingRules.push({
    name,
    matchAny: terms,
    provider: provider ? assertProviderName(provider) : undefined,
    profile,
  });
  const target = await writeProjectConfig(existing?.dir ?? cwd, config);
  console.log(chalk.green(`Rule '${name}' written to ${target}`));
}
