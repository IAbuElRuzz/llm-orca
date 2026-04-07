import chalk from "chalk";
import path from "node:path";
import { appendHistory, previewText, writeTranscript } from "../core/history.js";
import { enforceApprovalPolicy } from "../core/prompts.js";
import { getConfig } from "../core/config.js";
import { collectContextFiles, packContext, attachPackedContext } from "../core/context.js";
import { getProvider, isProviderName } from "../providers/index.js";
import type { ApprovalPolicy, ProviderName, SandboxMode } from "../types/provider.js";

export interface CompareInput {
  prompt: string;
  providers: string[];
  cwd: string;
  json?: boolean;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  contextFiles?: string[];
}

interface ProviderRunSummary {
  provider: ProviderName;
  exitCode: number;
  stdout: string;
  stderr: string;
  score: number;
  transcriptPath?: string;
}

function scoreResult(stdout: string, stderr: string, exitCode: number): number {
  if (exitCode !== 0) return -100;
  const out = stdout.trim();
  let score = 0;
  score += Math.min(out.length, 5000) / 100;
  if (out.includes("```")) score += 8;
  if (/\b(step|approach|architecture|trade-?off|risk|next|why)\b/i.test(out)) score += 8;
  if (/\b(error|failed|exception)\b/i.test(stderr)) score -= 20;
  return Math.round(score * 10) / 10;
}

function synthesizeConsensus(results: ProviderRunSummary[]): string {
  const successful = results.filter((item) => item.exitCode === 0 && item.stdout.trim());
  if (!successful.length) return "No successful provider outputs to synthesize.";

  const snippets = successful.map((item) => {
    const cleaned = item.stdout.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
    return `${item.provider}: ${cleaned.slice(0, 280)}`;
  });

  const repeatedSignals = [
    "architecture", "trade-off", "risk", "implementation", "plan", "security", "testing", "routing"
  ].filter((term) => snippets.filter((text) => text.toLowerCase().includes(term)).length >= 2);

  return [
    "Consensus synthesis:",
    `- Best scoring provider: ${[...results].sort((a,b)=>b.score-a.score)[0]?.provider ?? "n/a"}`,
    `- Successful providers: ${successful.map((item) => item.provider).join(", ")}`,
    repeatedSignals.length ? `- Shared themes: ${repeatedSignals.join(", ")}` : "- Shared themes: outputs were more divergent than repetitive.",
    ...snippets.map((snippet) => `- ${snippet}`)
  ].join("\n");
}

export async function compareProviders(input: CompareInput): Promise<void> {
  const config = await getConfig();
  const names = input.providers.filter(isProviderName) as ProviderName[];

  if (names.length === 0) {
    throw new Error("No valid providers supplied.");
  }

  const approvalPolicy = input.approvalPolicy ?? config.defaultApprovalPolicy;
  const sandboxMode = input.sandboxMode ?? config.defaultSandboxMode;
  const files = await collectContextFiles(input.cwd, input.contextFiles ?? []);
  const packedContext = await packContext(files, input.cwd);
  const finalPrompt = attachPackedContext(input.prompt, packedContext.packed);

  await enforceApprovalPolicy(approvalPolicy, finalPrompt);

  const tasks = names.map(async (name) => {
    const provider = getProvider(name);
    const status = provider.getStatus();

    if (!status.installed) {
      return {
        provider: name,
        exitCode: 127,
        stdout: "",
        stderr: `Binary '${status.binary}' not found.`,
        score: -100,
      } satisfies ProviderRunSummary;
    }

    console.log(chalk.bold(`\n===== ${name.toUpperCase()} =====`));
    const result = await provider.runOnce({
      prompt: finalPrompt,
      cwd: input.cwd,
      json: input.json,
      approvalPolicy,
      sandboxMode,
    });

    return {
      provider: name,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      score: scoreResult(result.stdout, result.stderr, result.exitCode),
    } satisfies ProviderRunSummary;
  });

  const results = await Promise.all(tasks);
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const consensus = synthesizeConsensus(results);

  console.log(chalk.cyan("\n===== VOTING SUMMARY ====="));
  for (const item of sorted) {
    const color = item.exitCode === 0 ? chalk.green : chalk.red;
    console.log(color(`${item.provider}: score=${item.score}, exit=${item.exitCode}`));
  }
  console.log(chalk.bold(`Winner: ${winner.provider}`));
  console.log(chalk.cyan("\n===== CONSENSUS ====="));
  console.log(consensus);

  if (config.historyEnabled) {
    const resultsWithTranscripts: ProviderRunSummary[] = [];
    for (const item of results) {
      const transcriptPath = await writeTranscript(`${Date.now()}-${item.provider}`, {
        provider: item.provider,
        cwd: input.cwd,
        prompt: input.prompt,
        finalPrompt,
        contextFiles: files.map((file) => path.relative(input.cwd, file)),
        stdout: item.stdout,
        stderr: item.stderr,
        exitCode: item.exitCode,
        score: item.score,
      });
      resultsWithTranscripts.push({ ...item, transcriptPath });
    }

    await appendHistory({
      provider: "multi",
      mode: "compare",
      cwd: input.cwd,
      prompt: input.prompt,
      promptPreview: previewText(input.prompt),
      approvalPolicy,
      sandboxMode,
      contextFiles: files.map((file) => path.relative(input.cwd, file)),
      results: resultsWithTranscripts.map((item) => ({
        provider: item.provider,
        exitCode: item.exitCode,
        stdoutPreview: previewText(item.stdout) ?? "",
        stderrPreview: previewText(item.stderr) ?? "",
        score: item.score,
        transcriptPath: item.transcriptPath,
      })),
    });
  }

  process.exitCode = results.some((item) => item.exitCode !== 0) ? 1 : 0;
}
