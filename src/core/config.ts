import fs from "fs-extra";
import path from "node:path";
import {
  APP_DIR,
  CONFIG_PATH,
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_PROVIDER,
  DEFAULT_SANDBOX_MODE,
  PROJECT_CONFIG_NAME,
} from "./constants.js";
import type { ApprovalPolicy, ProviderName, SandboxMode } from "../types/provider.js";

export interface AppConfig {
  activeProvider: ProviderName;
  defaultApprovalPolicy: ApprovalPolicy;
  defaultSandboxMode: SandboxMode;
  historyEnabled: boolean;
  defaultProfile?: string;
}

export interface ProjectProfile {
  name: string;
  provider?: ProviderName;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  extraArgs?: string[];
  json?: boolean;
  includeFiles?: string[];
  template?: string;
}

export interface RoutingRule {
  name: string;
  matchAny?: string[];
  provider?: ProviderName;
  profile?: string;
}

export interface TemplateMap {
  [name: string]: string;
}

export interface ProjectConfig {
  defaultProfile?: string;
  profiles: Record<string, ProjectProfile>;
  routingRules?: RoutingRule[];
  templates?: TemplateMap;
}

export async function ensureConfig(): Promise<AppConfig> {
  await fs.ensureDir(APP_DIR);

  if (!(await fs.pathExists(CONFIG_PATH))) {
    const initial: AppConfig = {
      activeProvider: DEFAULT_PROVIDER as ProviderName,
      defaultApprovalPolicy: DEFAULT_APPROVAL_POLICY as ApprovalPolicy,
      defaultSandboxMode: DEFAULT_SANDBOX_MODE as SandboxMode,
      historyEnabled: true,
    };
    await fs.writeJson(CONFIG_PATH, initial, { spaces: 2 });
    return initial;
  }

  const config = (await fs.readJson(CONFIG_PATH)) as Partial<AppConfig>;
  const normalized: AppConfig = {
    activeProvider: (config.activeProvider ?? DEFAULT_PROVIDER) as ProviderName,
    defaultApprovalPolicy: (config.defaultApprovalPolicy ?? DEFAULT_APPROVAL_POLICY) as ApprovalPolicy,
    defaultSandboxMode: (config.defaultSandboxMode ?? DEFAULT_SANDBOX_MODE) as SandboxMode,
    historyEnabled: config.historyEnabled ?? true,
    defaultProfile: config.defaultProfile,
  };
  await fs.writeJson(CONFIG_PATH, normalized, { spaces: 2 });
  return normalized;
}

export async function getConfig(): Promise<AppConfig> {
  return ensureConfig();
}

export async function setActiveProvider(provider: ProviderName): Promise<void> {
  const config = await ensureConfig();
  config.activeProvider = provider;
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function setDefaultApprovalPolicy(policy: ApprovalPolicy): Promise<void> {
  const config = await ensureConfig();
  config.defaultApprovalPolicy = policy;
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function setDefaultSandboxMode(mode: SandboxMode): Promise<void> {
  const config = await ensureConfig();
  config.defaultSandboxMode = mode;
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function setHistoryEnabled(enabled: boolean): Promise<void> {
  const config = await ensureConfig();
  config.historyEnabled = enabled;
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function setDefaultProfile(profileName?: string): Promise<void> {
  const config = await ensureConfig();
  config.defaultProfile = profileName;
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function getProjectConfig(startDir: string): Promise<{ path: string; dir: string; config: ProjectConfig } | null> {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, PROJECT_CONFIG_NAME);
    if (await fs.pathExists(candidate)) {
      const raw = (await fs.readJson(candidate)) as Partial<ProjectConfig>;
      return {
        path: candidate,
        dir: current,
        config: {
          defaultProfile: raw.defaultProfile,
          profiles: raw.profiles ?? {},
          routingRules: raw.routingRules ?? [],
          templates: raw.templates ?? {},
        },
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

export async function writeProjectConfig(dir: string, config: ProjectConfig): Promise<string> {
  const target = path.join(path.resolve(dir), PROJECT_CONFIG_NAME);
  await fs.writeJson(target, config, { spaces: 2 });
  return target;
}
