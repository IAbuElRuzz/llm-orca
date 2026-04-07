import { runCaptured, runInherited, which } from "../core/process.js";
import type { ProviderCapabilities, ProviderName, ProviderStatus, RunOptions } from "../types/provider.js";

export abstract class BaseProvider {
  abstract readonly name: ProviderName;
  abstract readonly binary: string;

  getStatus(): ProviderStatus {
    const resolvedPath = which(this.binary);

    return {
      name: this.name,
      binary: this.binary,
      installed: Boolean(resolvedPath),
      resolvedPath,
      notes: this.getNotes(),
    };
  }

  getNotes(): string[] {
    return [];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      interactive: true,
      oneShot: true,
      jsonOutput: false,
      modelSelection: true,
      approvalPolicyHints: false,
      sandboxModes: ["workspace"],
      contextFiles: true,
    };
  }

  abstract buildInteractiveArgs(): string[];
  abstract buildRunArgs(options: RunOptions): string[];

  async openInteractive(cwd: string): Promise<number> {
    return runInherited(this.binary, this.buildInteractiveArgs(), cwd);
  }

  async runOnce(options: RunOptions) {
    return runCaptured(this.binary, this.buildRunArgs(options), options.cwd);
  }

  protected mapApprovalArgs(policy?: RunOptions["approvalPolicy"]): string[] {
    if (!policy) return [];
    if (policy === "auto") {
      return ["--dangerously-skip-permissions"];
    }
    return [];
  }

  protected mapSandboxArgs(mode?: RunOptions["sandboxMode"]): string[] {
    if (!mode) return [];
    if (mode === "read-only") return ["--read-only"];
    if (mode === "full") return ["--dangerously-skip-permissions"];
    return [];
  }
}
