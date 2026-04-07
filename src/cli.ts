#!/usr/bin/env node
import { Command } from "commander";
import { listProviders } from "./commands/list.js";
import { showCurrentProvider } from "./commands/current.js";
import { switchProvider } from "./commands/switch.js";
import { openProvider } from "./commands/open.js";
import { runPrompt } from "./commands/run.js";
import { runDoctor } from "./commands/doctor.js";
import { compareProviders } from "./commands/compare.js";
import { showHistory } from "./commands/history.js";
import { openMenu } from "./commands/menu.js";
import { openTui } from "./commands/tui.js";
import { initProfile, listProfiles } from "./commands/profile.js";
import { addProjectTemplate, listPromptTemplates, renderPromptTemplate, showPromptTemplate } from "./commands/template.js";
import { addRule, listRules } from "./commands/rules.js";
import { packFiles } from "./commands/pack.js";

const program = new Command();

program
  .name("llm-router")
  .description("Route local terminal LLM CLIs like Claude Code, Codex, and Gemini")
  .version("0.3.0");

program.command("doctor").description("Check config, project profiles, and provider binaries").action(async () => {
  await runDoctor();
});

program.command("list").description("List supported providers").action(async () => {
  await listProviders();
});

program.command("current").description("Show the active provider").action(async () => {
  await showCurrentProvider();
});

program.command("switch").description("Switch the active provider").argument("<provider>", "claude | codex | gemini").action(async (provider: string) => {
  await switchProvider(provider);
});

program.command("open").description("Open a provider in interactive mode").argument("[provider]", "defaults to the active provider").action(async (provider: string | undefined) => {
  await openProvider(provider, process.cwd());
});

program.command("run")
  .description("Run a one-shot prompt against a provider")
  .argument("[provider]", "defaults to the active provider, profile, or routing rule")
  .requiredOption("-p, --prompt <prompt>", "prompt to send")
  .option("--json", "request JSON output where supported")
  .option("-m, --model <model>", "optional provider model name")
  .option("--approval <policy>", "ask | auto | never")
  .option("--sandbox <mode>", "read-only | workspace | full")
  .option("--profile <profile>", "project profile name")
  .option("--template <template>", "prompt template name")
  .option("--with <paths>", "comma-separated files or folders to pack into the prompt")
  .allowUnknownOption(true)
  .action(async (provider: string | undefined, options, command) => {
    const extraArgs = command.args.slice(provider ? 1 : 0).filter((value: string) => value !== provider);
    const contextFiles = options.with ? String(options.with).split(",").map((value) => value.trim()).filter(Boolean) : [];
    await runPrompt({
      provider,
      prompt: options.prompt,
      cwd: process.cwd(),
      json: Boolean(options.json),
      model: options.model,
      extraArgs,
      approvalPolicy: options.approval,
      sandboxMode: options.sandbox,
      profile: options.profile,
      template: options.template,
      contextFiles,
    });
  });

program.command("compare")
  .description("Run the same prompt across multiple providers in parallel with consensus synthesis")
  .requiredOption("-p, --prompt <prompt>", "prompt to send")
  .requiredOption("--providers <providers>", "comma-separated provider names")
  .option("--json", "request JSON output where supported")
  .option("--approval <policy>", "ask | auto | never")
  .option("--sandbox <mode>", "read-only | workspace | full")
  .option("--with <paths>", "comma-separated files or folders to pack into the prompt")
  .action(async (options) => {
    await compareProviders({
      prompt: options.prompt,
      providers: String(options.providers).split(",").map((value) => value.trim()).filter(Boolean),
      cwd: process.cwd(),
      json: Boolean(options.json),
      approvalPolicy: options.approval,
      sandboxMode: options.sandbox,
      contextFiles: options.with ? String(options.with).split(",").map((value) => value.trim()).filter(Boolean) : [],
    });
  });

program.command("history").description("Show recent transcript/history metadata").option("-n, --limit <limit>", "number of entries", "20").action(async (options) => {
  await showHistory(Number(options.limit));
});

program.command("menu").description("Open a simple terminal menu").action(async () => {
  await openMenu(process.cwd());
});

program.command("tui").description("Open the full-screen-ish V3 TUI").action(async () => {
  await openTui(process.cwd());
});

const profileCommand = program.command("profile").description("Manage project profiles in .llm-router.json");
profileCommand.command("list").description("List profiles for the current project").action(async () => {
  await listProfiles(process.cwd());
});
profileCommand.command("init")
  .description("Create or update a project profile")
  .argument("<name>", "profile name")
  .option("--provider <provider>", "claude | codex | gemini")
  .option("--model <model>", "provider model")
  .option("--approval <policy>", "ask | auto | never")
  .option("--sandbox <mode>", "read-only | workspace | full")
  .option("--json", "default to JSON output")
  .option("--template <template>", "template name")
  .option("--with <paths>", "comma-separated files or folders")
  .option("--default", "set as default profile")
  .allowUnknownOption(true)
  .action(async (name: string, options, command) => {
    const extraArgs = command.args.slice(1);
    await initProfile({
      cwd: process.cwd(),
      name,
      provider: options.provider,
      model: options.model,
      approvalPolicy: options.approval,
      sandboxMode: options.sandbox,
      json: Boolean(options.json),
      extraArgs,
      includeFiles: options.with ? String(options.with).split(",").map((value) => value.trim()).filter(Boolean) : [],
      template: options.template,
      setDefault: Boolean(options.default),
    });
  });

const templateCommand = program.command("template").description("Manage prompt templates");
templateCommand.command("list").description("List templates").action(async () => {
  await listPromptTemplates(process.cwd());
});
templateCommand.command("show").description("Show template body").argument("<name>").action(async (name: string) => {
  await showPromptTemplate(process.cwd(), name);
});
templateCommand.command("add").description("Add a project template").argument("<name>").requiredOption("-b, --body <body>", "template body").action(async (name: string, options) => {
  await addProjectTemplate(process.cwd(), name, options.body);
});
templateCommand.command("render").description("Render a template with input").argument("<name>").requiredOption("-i, --input <input>", "input body").action(async (name: string, options) => {
  await renderPromptTemplate(process.cwd(), name, options.input);
});

const rulesCommand = program.command("rules").description("Manage prompt routing rules");
rulesCommand.command("list").description("List rules").action(async () => {
  await listRules(process.cwd());
});
rulesCommand.command("add").description("Add or replace a routing rule")
  .argument("<name>")
  .requiredOption("--terms <terms>", "comma-separated terms to match")
  .option("--provider <provider>", "claude | codex | gemini")
  .option("--profile <profile>", "project profile name")
  .action(async (name: string, options) => {
    await addRule(process.cwd(), name, String(options.terms).split(",").map((v) => v.trim()).filter(Boolean), options.provider, options.profile);
  });

program.command("pack").description("Pack files into a prompt-friendly context bundle")
  .requiredOption("--with <paths>", "comma-separated files or folders")
  .action(async (options) => {
    await packFiles(process.cwd(), String(options.with).split(",").map((v) => v.trim()).filter(Boolean));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
