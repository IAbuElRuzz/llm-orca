import chalk from "chalk";
import path from "node:path";
import { getConfig } from "../core/config.js";
import { appendHistory, previewText, writeTranscript } from "../core/history.js";
import { enforceApprovalPolicy } from "../core/prompts.js";
import { resolveProfile } from "../core/profile-resolution.js";
import { collectContextFiles, packContext, attachPackedContext } from "../core/context.js";
import { resolveProvider, matchRoutingRule } from "../core/provider-resolution.js";
import { getTemplate, renderTemplate } from "../core/templates.js";
import type { ApprovalPolicy, SandboxMode } from "../types/provider.js";

export interface RunCommandInput {
  provider?: string;
  prompt: string;
  cwd: string;
  json?: boolean;
  model?: string;
  extraArgs?: string[];
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  profile?: string;
  template?: string;
  contextFiles?: string[];
}

export async function runPrompt(input: RunCommandInput): Promise<void> {
  const config = await getConfig();
  const rule = await matchRoutingRule(input.cwd, input.prompt);
  const profile = await resolveProfile(input.cwd, input.profile ?? rule.profile);

  const provider = await resolveProvider(input.provider ?? rule.provider ?? profile.provider);
  const status = provider.getStatus();

  if (!status.installed) {
    throw new Error(`Provider binary '${status.binary}' is not installed or not in PATH.`);
  }

  const approvalPolicy = input.approvalPolicy ?? profile.approvalPolicy ?? config.defaultApprovalPolicy;
  const sandboxMode = input.sandboxMode ?? profile.sandboxMode ?? config.defaultSandboxMode;
  const model = input.model ?? profile.model;
  const json = input.json ?? profile.json;
  const extraArgs = [...(profile.extraArgs ?? []), ...(input.extraArgs ?? [])];

  const files = await collectContextFiles(input.cwd, [...(profile.includeFiles ?? []), ...(input.contextFiles ?? [])]);
  const packedContext = await packContext(files, input.cwd);

  let finalPrompt = input.prompt;
  const templateName = input.template ?? profile.template;
  if (templateName) {
    const template = await getTemplate(input.cwd, templateName);
    if (!template) throw new Error(`Template '${templateName}' not found.`);
    finalPrompt = renderTemplate(template, finalPrompt, { cwd: input.cwd });
  }
  finalPrompt = attachPackedContext(finalPrompt, packedContext.packed);

  await enforceApprovalPolicy(approvalPolicy, finalPrompt);

  console.log(chalk.cyan(`Running prompt with ${provider.name}...`));
  if (profile.name) {
    console.log(chalk.gray(`Profile: ${profile.name} (${profile.source})`));
  }
  if (rule.ruleName) {
    console.log(chalk.gray(`Routing rule: ${rule.ruleName}`));
  }
  console.log(chalk.gray(`Approval policy: ${approvalPolicy}`));
  console.log(chalk.gray(`Sandbox mode: ${sandboxMode}`));
  if (files.length) {
    console.log(chalk.gray(`Context files: ${files.map((file) => path.relative(input.cwd, file)).join(", ")}`));
  }

  const result = await provider.runOnce({
    prompt: finalPrompt,
    cwd: input.cwd,
    json,
    model,
    extraArgs,
    approvalPolicy,
    profileName: profile.name,
    sandboxMode,
  });

  let transcriptPath: string | undefined;
  if (config.historyEnabled) {
    const tempId = `${Date.now()}-${provider.name}`;
    transcriptPath = await writeTranscript(tempId, {
      provider: provider.name,
      cwd: input.cwd,
      originalPrompt: input.prompt,
      finalPrompt,
      contextFiles: files,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });

    await appendHistory({
      provider: provider.name,
      mode: "run",
      cwd: input.cwd,
      prompt: input.prompt,
      promptPreview: previewText(input.prompt),
      exitCode: result.exitCode,
      model,
      approvalPolicy,
      sandboxMode,
      profileName: profile.name,
      transcriptPath,
      contextFiles: files.map((file) => path.relative(input.cwd, file)),
      results: [
        {
          provider: provider.name,
          exitCode: result.exitCode,
          stdoutPreview: previewText(result.stdout) ?? "",
          stderrPreview: previewText(result.stderr) ?? "",
          transcriptPath,
        },
      ],
    });
  }

  if (result.exitCode !== 0) {
    console.error(chalk.red(`\n${provider.name} exited with code ${result.exitCode}`));
  }

  process.exitCode = result.exitCode;
}
