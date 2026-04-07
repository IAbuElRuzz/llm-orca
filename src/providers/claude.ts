import { BaseProvider } from "./base.js";
import type { ProviderCapabilities, RunOptions } from "../types/provider.js";

export class ClaudeProvider extends BaseProvider {
  readonly name = "claude" as const;
  readonly binary = "claude";

  getNotes(): string[] {
    return [
      "Interactive mode is the default pass-through.",
      "V3 adds sandbox and context-packing support at the wrapper level.",
      "Verify flags against your installed Claude Code version."
    ];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      interactive: true,
      oneShot: true,
      jsonOutput: false,
      modelSelection: true,
      approvalPolicyHints: true,
      sandboxModes: ["read-only", "workspace", "full"],
      contextFiles: true,
    };
  }

  buildInteractiveArgs(): string[] {
    return [];
  }

  buildRunArgs(options: RunOptions): string[] {
    const args = ["-p", options.prompt];

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...this.mapApprovalArgs(options.approvalPolicy));
    args.push(...this.mapSandboxArgs(options.sandboxMode));

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }

    return args;
  }
}
