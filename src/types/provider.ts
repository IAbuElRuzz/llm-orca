export type ProviderName = "claude" | "codex" | "gemini";
export type ApprovalPolicy = "ask" | "auto" | "never";
export type SandboxMode = "read-only" | "workspace" | "full";

export interface RunOptions {
  prompt: string;
  cwd: string;
  json?: boolean;
  model?: string;
  extraArgs?: string[];
  approvalPolicy?: ApprovalPolicy;
  profileName?: string;
  sandboxMode?: SandboxMode;
}

export interface ProviderStatus {
  name: ProviderName;
  binary: string;
  installed: boolean;
  resolvedPath?: string;
  notes?: string[];
}

export interface ProviderCapabilities {
  interactive: boolean;
  oneShot: boolean;
  jsonOutput: boolean;
  modelSelection: boolean;
  approvalPolicyHints: boolean;
  sandboxModes: SandboxMode[];
  contextFiles: boolean;
}

export interface PackedContextItem {
  path: string;
  bytes: number;
  content: string;
}
