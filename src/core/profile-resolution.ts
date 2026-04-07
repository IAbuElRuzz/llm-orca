import { getConfig, getProjectConfig } from "./config.js";
import type { ApprovalPolicy, ProviderName, SandboxMode } from "../types/provider.js";

export interface ResolvedProfile {
  name?: string;
  provider?: ProviderName;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  extraArgs?: string[];
  includeFiles?: string[];
  template?: string;
  json?: boolean;
  source: "project" | "global" | "none";
}

export async function resolveProfile(cwd: string, requestedProfile?: string): Promise<ResolvedProfile> {
  const project = await getProjectConfig(cwd);
  const globalConfig = await getConfig();

  if (project) {
    const projectProfileName = requestedProfile ?? project.config.defaultProfile ?? globalConfig.defaultProfile;
    if (projectProfileName && project.config.profiles[projectProfileName]) {
      return {
        ...project.config.profiles[projectProfileName],
        source: "project",
      };
    }
  }

  return {
    name: requestedProfile ?? globalConfig.defaultProfile,
    source: "none",
  };
}
