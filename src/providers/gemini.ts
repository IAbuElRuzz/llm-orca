import { BaseProvider } from "./base.js";
import type { ProviderCapabilities, RunOptions } from "../types/provider.js";

export class GeminiProvider extends BaseProvider {
  readonly name = "gemini" as const;
  readonly binary = "gemini";

  getNotes(): string[] {
    return [
      "Gemini is a good candidate for scripted runs with JSON output.",
      "Interactive mode is plain pass-through to the local Gemini CLI.",
    ];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      interactive: true,
      oneShot: true,
      jsonOutput: true,
      modelSelection: true,
      approvalPolicyHints: false,
      sandboxModes: ["workspace"],
      contextFiles: true,
    };
  }

  buildInteractiveArgs(): string[] {
    return [];
  }

  buildRunArgs(options: RunOptions): string[] {
    const args = ["-p", options.prompt];

    if (options.json) {
      args.push("--output-format", "json");
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }

    return args;
  }
}
