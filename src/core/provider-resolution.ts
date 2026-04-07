import { getConfig, getProjectConfig } from "./config.js";
import { getProvider, isProviderName } from "../providers/index.js";
import type { ProviderName } from "../types/provider.js";

export async function resolveProvider(name?: string) {
  if (name) {
    if (!isProviderName(name)) {
      throw new Error(`Unsupported provider: ${name}`);
    }

    return getProvider(name);
  }

  const config = await getConfig();
  return getProvider(config.activeProvider);
}

export function assertProviderName(name: string): ProviderName {
  if (!isProviderName(name)) {
    throw new Error(`Unsupported provider: ${name}`);
  }

  return name;
}

export async function matchRoutingRule(cwd: string, prompt: string): Promise<{provider?: ProviderName; profile?: string; ruleName?: string}> {
  const project = await getProjectConfig(cwd);
  if (!project?.config.routingRules?.length) return {};
  const lowered = prompt.toLowerCase();
  for (const rule of project.config.routingRules) {
    const matches = (rule.matchAny ?? []).some((term) => lowered.includes(term.toLowerCase()));
    if (matches) {
      return { provider: rule.provider, profile: rule.profile, ruleName: rule.name };
    }
  }
  return {};
}
