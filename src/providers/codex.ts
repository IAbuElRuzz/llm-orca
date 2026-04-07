import { BaseProvider } from "./base.js";
import type { ProviderCapabilities, RunOptions } from "../types/provider.js";

export class CodexProvider extends BaseProvider {
  readonly name = "codex" as const;
  readonly binary = "codex";

  getNotes(): string[] {
    return [
      "Codex auth is intentionally delegated to the installed Codex CLI.",
      "Check your local codex version for exact non-interactive flags if needed.",
    ];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      interactive: true,
      oneShot: true,
      jsonOutput: false,
      modelSelection: true,
      approvalPolicyHints: true,
      sandboxModes: ["workspace", "full"],
      contextFiles: true,
    };
  }

  buildInteractiveArgs(): string[] {
    return [];
  }

  buildRunArgs(options: RunOptions): string[] {
    const args = ["exec", options.prompt];

    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.approvalPolicy === "auto" || options.sandboxMode === "full") {
      args.push("--full-auto");
    }

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }

    return args;
  }
}
