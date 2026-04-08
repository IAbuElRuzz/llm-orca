import readline from "node:readline";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import {
  getActiveModel,
  getConfig,
  setActiveModel,
  setActiveProvider,
  setDefaultApprovalPolicy,
  setDefaultSandboxMode,
  setHistoryEnabled,
} from "../core/config.js";
import { appendHistory, previewText, writeTranscript } from "../core/history.js";
import { runCapturedStreaming } from "../core/process.js";
import { listSessions, loadSession, saveSession } from "../core/session.js";
import { getAllProviders, getProvider, isProviderName } from "../providers/index.js";
import type { ApprovalPolicy, ProviderName, SandboxMode } from "../types/provider.js";
import { openProvider } from "./open.js";

type SidebarKey =
  | "provider"
  | "model"
  | "compareMode"
  | "compareProviders"
  | "approval"
  | "sandbox"
  | "history"
  | "save"
  | "load"
  | "open"
  | "clear"
  | "quit";

type FocusArea = "sidebar" | "input";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  provider?: string;
  content: string;
  timestamp: string;
};

type SidebarItem = {
  key: SidebarKey;
  label: string;
  detail?: string;
};

type UiState = {
  activeProvider: ProviderName;
  activeModel?: string;
  approvalPolicy: ApprovalPolicy;
  sandboxMode: SandboxMode;
  historyEnabled: boolean;
};

const APPROVAL_POLICIES: ApprovalPolicy[] = ["ask", "auto", "never"];
const PROVIDER_NAMES = getAllProviders().map((provider) => provider.name);
const SIDEBAR_KEYS: SidebarKey[] = [
  "provider",
  "model",
  "compareMode",
  "compareProviders",
  "approval",
  "sandbox",
  "history",
  "save",
  "load",
  "open",
  "clear",
  "quit",
];

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[0f");
}

async function askLine(prompt: string): Promise<string> {
  process.stdin.setRawMode?.(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => rl.question(prompt, (answer) => {
    rl.close();
    process.stdin.setRawMode?.(true);
    resolve(answer);
  }));
}

function cycleValue<T>(values: T[], current: T, direction: 1 | -1): T {
  const index = values.indexOf(current);
  const nextIndex = index === -1 ? 0 : (index + direction + values.length) % values.length;
  return values[nextIndex];
}

function wrapText(text: string, width: number): string[] {
  if (width <= 1) return [text];
  const output: string[] = [];

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    if (!rawLine.length) {
      output.push("");
      continue;
    }
    let remaining = rawLine;
    while (remaining.length > width) {
      const slice = remaining.slice(0, width);
      const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\t"));
      if (breakIndex > Math.floor(width / 3)) {
        output.push(slice.slice(0, breakIndex).trimEnd());
        remaining = remaining.slice(breakIndex + 1);
      } else {
        output.push(slice);
        remaining = remaining.slice(width);
      }
    }
    output.push(remaining);
  }

  return output.length ? output : [""];
}

function padRight(value: string, width: number): string {
  const clipped = value.length > width ? value.slice(0, Math.max(width - 1, 0)) : value;
  return clipped + " ".repeat(Math.max(width - clipped.length, 0));
}

function formatMessage(message: ChatMessage, width: number): string[] {
  const label = message.role === "user"
    ? "You"
    : message.role === "assistant"
      ? `Assistant${message.provider ? ` (${message.provider})` : ""}`
      : "System";
  const prefix = `${label}: `;
  const lines = wrapText(message.content, Math.max(width - prefix.length, 12));
  return lines.map((line, index) => index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`);
}

function buildConversationPrompt(messages: ChatMessage[]): string {
  const relevant = messages.filter((message) => message.role !== "system").slice(-12);
  const lines = [
    "Continue this terminal chat. Answer the latest user message directly and naturally.",
    "",
  ];

  for (const message of relevant) {
    const role = message.role === "user" ? "USER" : `ASSISTANT${message.provider ? ` (${message.provider})` : ""}`;
    lines.push(`${role}: ${message.content}`);
    lines.push("");
  }

  lines.push("ASSISTANT:");
  return lines.join("\n");
}

function normalizeProviders(input: string): ProviderName[] {
  const values = input.split(",").map((value) => value.trim()).filter(Boolean);
  const providers = values.filter(isProviderName);
  return [...new Set(providers)];
}

export async function openTui(cwd: string): Promise<void> {
  let focus: FocusArea = "input";
  let selected = 0;
  let draft = "";
  let busy = false;
  let compareMode = false;
  let compareProviders: ProviderName[] = ["claude", "codex"];
  let sessionId: string | undefined;
  let sessionName = "scratch";
  let status = "Type a message or use slash commands like /provider codex, /model gpt-5.4, /compare on.";
  const initialConfig = await getConfig();
  let uiState: UiState = {
    activeProvider: initialConfig.activeProvider,
    activeModel: await getActiveModel(initialConfig.activeProvider),
    approvalPolicy: initialConfig.defaultApprovalPolicy,
    sandboxMode: initialConfig.defaultSandboxMode,
    historyEnabled: initialConfig.historyEnabled,
  };
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Unified chat mode active. Provider and model changes apply to the next turn.",
      timestamp: new Date().toISOString(),
    },
  ];

  const pauseInput = (onData: (key: string) => Promise<void>) => {
    process.stdin.removeListener("data", onData);
    process.stdin.setRawMode?.(false);
  };

  const resumeInput = (onData: (key: string) => Promise<void>) => {
    process.stdin.setRawMode?.(true);
    process.stdin.on("data", onData);
  };

  let renderTimer: NodeJS.Timeout | undefined;
  let onDataRef: ((key: string) => Promise<void>) | undefined;

  const getState = async () => {
    const provider = getProvider(uiState.activeProvider);
    const statusInfo = provider.getStatus();
    const capabilities = provider.getCapabilities();
    const activeModel = uiState.activeModel;
    return { uiState, provider, statusInfo, capabilities, activeModel };
  };

  const syncProvider = async (provider: ProviderName) => {
    await setActiveProvider(provider);
    uiState.activeProvider = provider;
    uiState.activeModel = await getActiveModel(provider);
  };

  const syncModel = async (provider: ProviderName, model?: string) => {
    await setActiveModel(provider, model);
    if (uiState.activeProvider === provider) {
      uiState.activeModel = model?.trim() ? model.trim() : undefined;
    }
  };

  const syncApproval = async (policy: ApprovalPolicy) => {
    await setDefaultApprovalPolicy(policy);
    uiState.approvalPolicy = policy;
  };

  const syncSandbox = async (mode: SandboxMode) => {
    await setDefaultSandboxMode(mode);
    uiState.sandboxMode = mode;
  };

  const syncHistory = async (enabled: boolean) => {
    await setHistoryEnabled(enabled);
    uiState.historyEnabled = enabled;
  };

  const scheduleRender = async () => {
    if (renderTimer) return;
    renderTimer = setTimeout(async () => {
      renderTimer = undefined;
      if (!busy || onDataRef) {
        await render();
      }
    }, 100);
  };

  const getSidebarItems = async (): Promise<SidebarItem[]> => {
    const state = await getState();
    return [
      { key: "provider", label: "Provider", detail: state.uiState.activeProvider },
      { key: "model", label: "Model", detail: state.activeModel ?? "(default)" },
      { key: "compareMode", label: "Compare Mode", detail: compareMode ? "on" : "off" },
      { key: "compareProviders", label: "Compare Providers", detail: compareProviders.join(",") || "(none)" },
      { key: "approval", label: "Approval", detail: state.uiState.approvalPolicy },
      { key: "sandbox", label: "Sandbox", detail: state.uiState.sandboxMode },
      { key: "history", label: "History", detail: state.uiState.historyEnabled ? "on" : "off" },
      { key: "save", label: "Save Session", detail: sessionName },
      { key: "load", label: "Load Session", detail: sessionId ? "current saved" : "choose file" },
      { key: "open", label: "Open CLI", detail: "interactive" },
      { key: "clear", label: "Clear Chat", detail: `${Math.max(messages.length - 1, 0)} msgs` },
      { key: "quit", label: "Quit" },
    ];
  };

  const render = async () => {
    const state = await getState();
    const sidebarItems = await getSidebarItems();
    const totalWidth = Math.max(process.stdout.columns ?? 100, 80);
    const totalHeight = Math.max(process.stdout.rows ?? 30, 20);
    const sidebarWidth = Math.min(38, Math.max(28, Math.floor(totalWidth * 0.30)));
    const gap = 3;
    const chatWidth = totalWidth - sidebarWidth - gap;
    const headerLines = 4;
    const footerLines = 6;
    const chatHeight = Math.max(totalHeight - headerLines - footerLines, 8);

    const sidebarLines: string[] = [
      chalk.bold("Controls"),
      chalk.gray(focus === "sidebar" ? "Focus: sidebar" : "Tab to sidebar"),
      "",
    ];

    sidebarItems.forEach((item, index) => {
      const active = focus === "sidebar" && index === selected;
      const prefix = active ? chalk.cyan(">") : " ";
      const label = active ? chalk.cyan(item.label) : item.label;
      const detail = item.detail ? chalk.gray(item.detail) : "";
      sidebarLines.push(`${prefix} ${label}${detail ? `  ${detail}` : ""}`);
    });

    sidebarLines.push("");
    sidebarLines.push(chalk.gray(`Session: ${sessionName}${sessionId ? ` (${sessionId})` : ""}`));
    sidebarLines.push(chalk.gray(`Installed: ${state.statusInfo.installed ? "yes" : "no"}`));
    sidebarLines.push(chalk.gray(`Mode: ${compareMode ? "compare" : "single"}`));

    const formattedMessages = messages.flatMap((message) => [...formatMessage(message, Math.max(chatWidth - 2, 20)), ""]);
    const visibleChat = formattedMessages.slice(-chatHeight);
    const draftLines = wrapText(draft, Math.max(totalWidth - 4, 20));

    clearScreen();
    console.log(chalk.bold("LLM Router Chat TUI"));
    console.log(chalk.gray("Tab = focus switch | Enter = send/activate | arrows = move/change | q = quit"));
    console.log(chalk.gray(`Provider: ${state.uiState.activeProvider} | Model: ${state.activeModel ?? "(default)"} | Approval: ${state.uiState.approvalPolicy} | Sandbox: ${state.uiState.sandboxMode}`));
    console.log(chalk.gray(`Compare: ${compareMode ? `on (${compareProviders.join(", ")})` : "off"}`));
    console.log("");

    for (let row = 0; row < chatHeight; row += 1) {
      const left = sidebarLines[row] ?? "";
      const right = visibleChat[row] ?? "";
      console.log(`${padRight(left, sidebarWidth)}${" ".repeat(gap)}${right}`);
    }

    console.log("");
    console.log(`${focus === "input" ? chalk.cyan("Composer") : "Composer"} ${chalk.gray("(supports slash commands)")}`);
    console.log(`> ${draftLines[0] ?? ""}`);
    for (const line of draftLines.slice(1, 3)) {
      console.log(`  ${line}`);
    }
    console.log(chalk.gray(status));
  };

  const confirmApproval = async (policy: ApprovalPolicy, prompt: string): Promise<void> => {
    if (policy === "never") {
      throw new Error("Execution blocked by approval policy 'never'.");
    }
    status = policy === "ask"
      ? `Running approved prompt: ${previewText(prompt, 80) ?? ""}`
      : `Running prompt: ${previewText(prompt, 80) ?? ""}`;
  };

  const pushSystem = (content: string) => {
    messages.push({
      role: "system",
      content,
      timestamp: new Date().toISOString(),
    });
  };

  const persistSession = async () => {
    const state = await getState();
    const session = await saveSession({
      id: sessionId,
      name: sessionName,
      cwd,
      createdAt: undefined,
      activeProvider: state.uiState.activeProvider,
      activeModel: state.activeModel,
      approvalPolicy: state.uiState.approvalPolicy,
      sandboxMode: state.uiState.sandboxMode,
      compareProviders,
      messages,
    });
    sessionId = session.id;
  };

  const executeProvider = async (providerName: ProviderName, prompt: string, conversationPrompt: string) => {
    const state = await getState();
    const provider = getProvider(providerName);
    const providerModel = await getActiveModel(providerName);
    const message: ChatMessage = {
      role: "assistant",
      provider: providerName,
      content: "",
      timestamp: new Date().toISOString(),
    };
    messages.push(message);
    await scheduleRender();

    const codexOutputFile = providerName === "codex"
      ? path.join(os.tmpdir(), `llm-router-codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
      : undefined;
    const extraArgs = providerName === "codex"
      ? [
          "--skip-git-repo-check",
          "--color",
          "never",
          "--output-last-message",
          codexOutputFile!,
        ]
      : [];

    const result = await runCapturedStreaming(
      provider.binary,
      provider.buildRunArgs({
        prompt: conversationPrompt,
        cwd,
        model: providerModel,
        approvalPolicy: state.uiState.approvalPolicy,
        sandboxMode: state.uiState.sandboxMode,
        extraArgs,
      }),
      cwd,
      {
        onStdout: (chunk) => {
          if (providerName !== "codex") {
            message.content += chunk;
          }
          void scheduleRender();
        },
        onStderr: (chunk) => {
          if (providerName !== "codex") {
            if (!message.content) {
              message.content = "";
            }
            message.content += chunk;
          }
          void scheduleRender();
        },
      },
    );

    if (codexOutputFile) {
      try {
        const lastMessage = (await fs.readFile(codexOutputFile, "utf8")).trim();
        if (lastMessage) {
          message.content = lastMessage;
        }
      } catch {
        // Fall back to stdout/stderr below.
      } finally {
        await fs.remove(codexOutputFile).catch(() => undefined);
      }
    }

    message.content = message.content.trim() || (result.stderr.trim() || `[${providerName}] exited with no output.`);
    message.timestamp = new Date().toISOString();

    const transcriptPath = await writeTranscript(`${Date.now()}-${providerName}`, {
      provider: providerName,
      cwd,
      mode: compareMode ? "compare-chat" : "chat",
      model: providerModel,
      originalPrompt: prompt,
      finalPrompt: conversationPrompt,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      messages,
    });

    return {
      provider: providerName,
      model: providerModel,
      result,
      transcriptPath,
      content: message.content,
    };
  };

  const sendMessage = async (prompt: string) => {
    const targets = compareMode
      ? (compareProviders.length ? compareProviders : [uiState.activeProvider])
      : [uiState.activeProvider];

    for (const target of targets) {
      const targetStatus = getProvider(target).getStatus();
      if (!targetStatus.installed) {
        throw new Error(`Provider binary '${targetStatus.binary}' is not installed or not in PATH.`);
      }
    }

    messages.push({
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    });
    draft = "";
    busy = true;
    status = compareMode
      ? `Running compare across ${targets.join(", ")}...`
      : `Running ${uiState.activeProvider}${uiState.activeModel ? ` (${uiState.activeModel})` : ""}...`;
    await render();

    await confirmApproval(uiState.approvalPolicy, prompt);
    const conversationPrompt = buildConversationPrompt(messages);
    const results = await Promise.all(targets.map((target) => executeProvider(target, prompt, conversationPrompt)));

    if (uiState.historyEnabled) {
      await appendHistory({
        provider: compareMode ? "multi" : uiState.activeProvider,
        mode: compareMode ? "compare" : "chat",
        cwd,
        prompt,
        promptPreview: previewText(prompt),
        exitCode: results.some((item) => item.result.exitCode !== 0) ? 1 : 0,
        model: uiState.activeModel,
        approvalPolicy: uiState.approvalPolicy,
        sandboxMode: uiState.sandboxMode,
        results: results.map((item) => ({
          provider: item.provider,
          exitCode: item.result.exitCode,
          model: item.model,
          stdoutPreview: previewText(item.result.stdout) ?? "",
          stderrPreview: previewText(item.result.stderr) ?? "",
          transcriptPath: item.transcriptPath,
        })),
      });
    }

    if (compareMode && results.length > 1) {
      const summary = results.map((item) => `${item.provider}: ${previewText(item.content, 100) ?? ""}`).join(" | ");
      pushSystem(`Compare complete. ${summary}`);
    }

    await persistSession();
    busy = false;
    status = compareMode ? `Compare complete for ${targets.join(", ")}.` : `Completed with ${uiState.activeProvider}.`;
  };

  const listSavedSessionsMessage = async () => {
    const sessions = await listSessions();
    if (!sessions.length) {
      pushSystem("No saved sessions found.");
      return;
    }
    pushSystem(sessions.slice(0, 8).map((session) => `${session.name} (${session.id}) ${session.activeProvider}${session.activeModel ? `/${session.activeModel}` : ""}`).join("\n"));
  };

  const loadSavedSession = async (idOrName: string) => {
    const session = await loadSession(idOrName);
    if (!session) {
      throw new Error(`Session '${idOrName}' not found.`);
    }

    sessionId = session.id;
    sessionName = session.name;
    compareProviders = session.compareProviders?.filter(isProviderName) ?? compareProviders;
    messages.splice(0, messages.length, ...session.messages);
    await syncProvider(session.activeProvider);
    await syncApproval(session.approvalPolicy);
    await syncSandbox(session.sandboxMode);
    await syncModel(session.activeProvider, session.activeModel);
    uiState.historyEnabled = uiState.historyEnabled;
    status = `Loaded session ${session.name}.`;
  };

  const handleSlashCommand = async (line: string): Promise<boolean> => {
    if (!line.startsWith("/")) return false;
    const parts = line.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    if (command === "/clear") {
      messages.splice(1);
      draft = "";
      status = "Conversation cleared.";
      await persistSession();
      return true;
    }

    if (command === "/provider") {
      const next = parts[1];
      if (!next || !isProviderName(next)) {
        throw new Error("Usage: /provider claude|codex|gemini");
      }
      await syncProvider(next);
      status = `Active provider set to ${next}.`;
      return true;
    }

    if (command === "/model") {
      const value = parts.slice(1).join(" ").trim();
      await syncModel(uiState.activeProvider, value);
      status = value ? `Model override set to ${value}.` : "Model override cleared.";
      return true;
    }

    if (command === "/compare") {
      const sub = parts[1]?.toLowerCase();
      if (sub === "on" || sub === "off") {
        compareMode = sub === "on";
        status = `Compare mode ${compareMode ? "enabled" : "disabled"}.`;
        return true;
      }
      if (sub === "providers") {
        const providers = normalizeProviders(parts.slice(2).join(" "));
        if (!providers.length) {
          throw new Error("Usage: /compare providers claude,codex");
        }
        compareProviders = providers;
        status = `Compare providers set to ${providers.join(", ")}.`;
        return true;
      }
      throw new Error("Usage: /compare on|off or /compare providers claude,codex");
    }

    if (command === "/approval") {
      const next = parts[1] as ApprovalPolicy | undefined;
      if (!next || !APPROVAL_POLICIES.includes(next)) {
        throw new Error("Usage: /approval ask|auto|never");
      }
      await syncApproval(next);
      status = `Approval policy set to ${next}.`;
      return true;
    }

    if (command === "/sandbox") {
      const state = await getState();
      const next = parts[1] as SandboxMode | undefined;
      if (!next || !state.capabilities.sandboxModes.includes(next)) {
        throw new Error(`Usage: /sandbox ${state.capabilities.sandboxModes.join("|")}`);
      }
      await syncSandbox(next);
      status = `Sandbox mode set to ${next}.`;
      return true;
    }

    if (command === "/save") {
      const name = parts.slice(1).join(" ").trim();
      if (name) {
        sessionName = name;
      }
      await persistSession();
      status = `Session saved as ${sessionName}.`;
      return true;
    }

    if (command === "/load") {
      const target = parts.slice(1).join(" ").trim();
      if (!target) {
        throw new Error("Usage: /load <session-name-or-id>");
      }
      await loadSavedSession(target);
      return true;
    }

    if (command === "/sessions") {
      await listSavedSessionsMessage();
      status = "Saved sessions listed in chat.";
      return true;
    }

    throw new Error(`Unknown slash command: ${command}`);
  };

  const cycleProvider = async (direction: 1 | -1) => {
    const nextProvider = cycleValue(PROVIDER_NAMES, uiState.activeProvider, direction);
    await syncProvider(nextProvider);
    const modes = getProvider(nextProvider).getCapabilities().sandboxModes;
    if (!modes.includes(uiState.sandboxMode)) {
      await syncSandbox(modes[0]);
    }
    status = `Active provider set to ${nextProvider}.`;
  };

  const cycleApproval = async (direction: 1 | -1) => {
    const next = cycleValue(APPROVAL_POLICIES, uiState.approvalPolicy, direction);
    await syncApproval(next);
    status = `Approval policy set to ${next}.`;
  };

  const cycleSandbox = async (direction: 1 | -1) => {
    const state = await getState();
    const modes = state.capabilities.sandboxModes;
    const current = modes.includes(uiState.sandboxMode) ? uiState.sandboxMode : modes[0];
    const next = cycleValue(modes, current, direction);
    await syncSandbox(next);
    status = `Sandbox mode set to ${next}.`;
  };

  const runSidebarAction = async (key: SidebarKey) => {
    if (key === "provider" || key === "approval" || key === "sandbox" || key === "history" || key === "compareMode") {
      return;
    }

    if (key === "model") {
      const answer = await askLine(`Model override for ${uiState.activeProvider} (blank = default): `);
      await syncModel(uiState.activeProvider, answer);
      status = answer.trim() ? `Model override saved for ${uiState.activeProvider}.` : "Model override cleared.";
      return;
    }

    if (key === "compareProviders") {
      const answer = await askLine(`Compare providers (${compareProviders.join(", ")}): `);
      const providers = normalizeProviders(answer);
      if (!providers.length) {
        throw new Error("At least one valid provider is required.");
      }
      compareProviders = providers;
      status = `Compare providers set to ${providers.join(", ")}.`;
      return;
    }

    if (key === "save") {
      const answer = await askLine(`Session name (${sessionName}): `);
      if (answer.trim()) {
        sessionName = answer.trim();
      }
      await persistSession();
      status = `Session saved as ${sessionName}.`;
      return;
    }

    if (key === "load") {
      const sessions = await listSessions();
      if (!sessions.length) {
        pushSystem("No saved sessions found.");
        status = "No saved sessions available.";
        return;
      }
      pushSystem(sessions.slice(0, 8).map((session) => `${session.name} (${session.id})`).join("\n"));
      const answer = await askLine("Load session by name or id: ");
      if (!answer.trim()) {
        status = "Load cancelled.";
        return;
      }
      await loadSavedSession(answer.trim());
      return;
    }

    if (key === "open") {
      await openProvider(uiState.activeProvider, cwd);
      status = `Returned from ${uiState.activeProvider} interactive mode.`;
      return;
    }

    if (key === "clear") {
      messages.splice(1);
      draft = "";
      status = "Conversation cleared.";
      await persistSession();
      return;
    }

    if (key === "quit") {
      throw new Error("__QUIT__");
    }
  };

  clearScreen();
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  await render();

  await new Promise<void>((resolve) => {
    const onData = async (key: string) => {
      onDataRef = onData;

      if (busy) {
        if (key === "\u0003") {
          cleanup();
          resolve();
        }
        return;
      }

      if (key === "\u0003") {
        cleanup();
        resolve();
        return;
      }

      if (key === "\t") {
        focus = focus === "input" ? "sidebar" : "input";
        await render();
        return;
      }

      if (focus === "input") {
        if (key === "\u001b") {
          draft = "";
          status = "Draft cleared.";
          await render();
          return;
        }
        if (key === "\u007f") {
          draft = draft.slice(0, -1);
          await render();
          return;
        }
        if (key === "\r") {
          const line = draft.trim();
          if (!line) {
            status = "Draft is empty.";
            await render();
            return;
          }
          pauseInput(onData);
          try {
            const handled = await handleSlashCommand(line);
            draft = "";
            if (!handled) {
              await sendMessage(line);
            }
          } catch (error) {
            status = error instanceof Error ? error.message : String(error);
          } finally {
            busy = false;
            resumeInput(onData);
          }
          await render();
          return;
        }
        if (key >= " " && key !== "\u007f") {
          draft += key;
          await render();
        }
        return;
      }

      if (key === "\u001B[A") {
        selected = selected === 0 ? SIDEBAR_KEYS.length - 1 : selected - 1;
        await render();
        return;
      }
      if (key === "\u001B[B") {
        selected = selected === SIDEBAR_KEYS.length - 1 ? 0 : selected + 1;
        await render();
        return;
      }

      const currentKey = SIDEBAR_KEYS[selected];

      if (key === "\u001B[C" || key === "\u001B[D") {
        const direction: 1 | -1 = key === "\u001B[C" ? 1 : -1;
        pauseInput(onData);
        try {
          if (currentKey === "provider") {
            await cycleProvider(direction);
          } else if (currentKey === "approval") {
            await cycleApproval(direction);
          } else if (currentKey === "sandbox") {
            await cycleSandbox(direction);
          } else if (currentKey === "history") {
            await syncHistory(!uiState.historyEnabled);
            status = `History recording ${uiState.historyEnabled ? "enabled" : "disabled"}.`;
          } else if (currentKey === "compareMode") {
            compareMode = !compareMode;
            status = `Compare mode ${compareMode ? "enabled" : "disabled"}.`;
          }
        } catch (error) {
          status = error instanceof Error ? error.message : String(error);
        } finally {
          resumeInput(onData);
        }
        await render();
        return;
      }

      if (key === "\r") {
        pauseInput(onData);
        try {
          await runSidebarAction(currentKey);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message === "__QUIT__") {
            cleanup();
            resolve();
            return;
          }
          status = message;
        } finally {
          resumeInput(onData);
        }
        await render();
        return;
      }

      if (key === "q" && focus === "sidebar") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode?.(false);
      clearScreen();
    };

    process.stdin.on("data", onData);
  });
}
