import { ClaudeProvider } from "./claude.js";
import { CodexProvider } from "./codex.js";
import { GeminiProvider } from "./gemini.js";
import type { ProviderName } from "../types/provider.js";

const providers = {
  claude: new ClaudeProvider(),
  codex: new CodexProvider(),
  gemini: new GeminiProvider(),
};

export function getProvider(name: ProviderName) {
  return providers[name];
}

export function getAllProviders() {
  return Object.values(providers);
}

export function isProviderName(value: string): value is ProviderName {
  return value === "claude" || value === "codex" || value === "gemini";
}
