# terminal-llm-router V3

A local terminal router/orchestrator for:

- Claude Code
- Codex
- Gemini
- future provider adapters

This project does **not** use API keys directly. It shells out to the locally installed binaries and relies on each CLI's own login/auth flow.

## What's new in V3

- richer keyboard-driven TUI: `llm-router tui`
- provider capability reporting in `doctor` and `list`
- full transcript storage under `~/.llm-router/transcripts`
- prompt templates, both global and project-scoped
- project routing rules based on prompt keywords
- consensus synthesis after `compare`
- file-aware context packing with `--with`
- sandbox modes at the wrapper level: `read-only`, `workspace`, `full`

## Install

```bash
npm install
npm run build
npm link
```

Then:

```bash
llm-router doctor
```

## Expected local binaries

Make sure these are already installed and authenticated locally:

```bash
claude
codex
gemini
```

## Basic usage

```bash
llm-router list
llm-router current
llm-router switch claude
llm-router open
llm-router run -p "summarize this repo"
llm-router compare --providers claude,codex,gemini -p "find design flaws in this architecture"
llm-router history
llm-router tui
```

## TUI

```bash
llm-router tui
```

Controls:

- Up/Down arrows to move
- Enter to select
- `q` to quit

## Templates

List templates:

```bash
llm-router template list
```

Add a project template:

```bash
llm-router template add repo-audit -b "Audit this repository for architecture, risks, and next steps.

{{input}}"
```

Render a template:

```bash
llm-router template render repo-audit -i "Focus on auth and CI/CD"
```

Use it while running:

```bash
llm-router run -p "Review the backend" --template repo-audit
```

## File-aware context packing

Pack files or folders into the prompt:

```bash
llm-router run -p "Review these files" --with src,README.md
llm-router compare --providers claude,codex -p "Find bugs" --with src/services,package.json
llm-router pack --with src,README.md
```

The wrapper reads a limited number of text files, truncates by byte budget, and appends them to the final prompt.

## Profiles

Create a project profile file:

```bash
llm-router profile init default --provider claude --model sonnet --approval ask --sandbox workspace --default
llm-router profile init fast-json --provider gemini --json --approval auto
llm-router profile init repo-review --provider codex --template repo-audit --with src,README.md
llm-router profile list
```

This writes `.llm-router.json` in the current directory.

## Routing rules

Add rules that route prompts automatically:

```bash
llm-router rules add code-review --terms review,refactor,best-practices --provider claude
llm-router rules add bug-fix --terms bug,error,crash,race --profile fast-json
llm-router rules list
```

When you run:

```bash
llm-router run -p "find a race condition in this worker"
```

the wrapper can resolve the provider/profile from the first matching rule.

## Compare and consensus

```bash
llm-router compare   --providers claude,codex,gemini   -p "Design a local tool to orchestrate multiple coding agents"   --with src,README.md
```

V3 keeps the V2 heuristic score, but also prints a consensus synthesis based on the successful outputs.

## History and transcripts

Metadata history is stored in:

```bash
~/.llm-router/history
```

Full transcripts are stored in:

```bash
~/.llm-router/transcripts
```

View recent metadata:

```bash
llm-router history
llm-router history --limit 50
```

## Sandbox modes

```bash
llm-router run claude -p "review this repo" --sandbox read-only
llm-router run codex -p "refactor this module" --sandbox full
llm-router run gemini -p "analyze this file" --sandbox workspace
```

These are wrapper-level hints. Exact flags vary by provider version, so review the provider adapters.

## Important note on provider flags

CLI flags evolve. You may need to adjust:

- `src/providers/claude.ts`
- `src/providers/codex.ts`
- `src/providers/gemini.ts`

Especially for:

- one-shot run flags
- model selection flags
- approval/full-auto flags
- sandbox flags

## Example `.llm-router.json`

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "name": "default",
      "provider": "claude",
      "model": "sonnet",
      "approvalPolicy": "ask",
      "sandboxMode": "workspace",
      "json": false,
      "extraArgs": [],
      "includeFiles": ["README.md"],
      "template": "repo-audit"
    },
    "fast-json": {
      "name": "fast-json",
      "provider": "gemini",
      "approvalPolicy": "auto",
      "sandboxMode": "workspace",
      "json": true,
      "extraArgs": []
    }
  },
  "routingRules": [
    {
      "name": "bug-fix",
      "matchAny": ["bug", "error", "crash", "race"],
      "profile": "fast-json"
    },
    {
      "name": "architecture",
      "matchAny": ["architecture", "design", "trade-off"],
      "provider": "claude"
    }
  ],
  "templates": {
    "repo-audit": "Audit this repository for architecture, risks, and next steps.

{{input}}"
  }
}
```

## Recommended next V4 ideas

- provider auto-discovery from PATH
- JSON-normalized compare output
- resumable sessions
- better terminal layout with panes
- fuzzy file picking
- provider-specific policy enforcement
- MCP tool routing
