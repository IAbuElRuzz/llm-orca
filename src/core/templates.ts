import fs from "fs-extra";
import { TEMPLATES_PATH } from "./constants.js";
import { getProjectConfig, writeProjectConfig } from "./config.js";

export interface TemplateStore {
  templates: Record<string, string>;
}

async function ensureGlobalTemplates(): Promise<TemplateStore> {
  if (!(await fs.pathExists(TEMPLATES_PATH))) {
    const initial: TemplateStore = {
      templates: {
        "repo-review": "Review this repository. Focus on architecture, risks, and next steps.\n\n{{input}}",
        "bug-hunt": "Find likely bugs, race conditions, or error handling gaps.\n\n{{input}}",
        "plan": "Create a concrete implementation plan with milestones and trade-offs.\n\n{{input}}"
      }
    };
    await fs.writeJson(TEMPLATES_PATH, initial, { spaces: 2 });
    return initial;
  }
  const raw = await fs.readJson(TEMPLATES_PATH) as Partial<TemplateStore>;
  const normalized: TemplateStore = { templates: raw.templates ?? {} };
  await fs.writeJson(TEMPLATES_PATH, normalized, { spaces: 2 });
  return normalized;
}

export async function listTemplates(cwd: string): Promise<{ source: "project" | "global"; name: string; body: string }[]> {
  const project = await getProjectConfig(cwd);
  const global = await ensureGlobalTemplates();
  const items: { source: "project" | "global"; name: string; body: string }[] = [];
  if (project) {
    for (const [name, body] of Object.entries(project.config.templates ?? {})) {
      items.push({ source: "project", name, body });
    }
  }
  for (const [name, body] of Object.entries(global.templates)) {
    if (!items.find((item) => item.name === name)) {
      items.push({ source: "global", name, body });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplate(cwd: string, name: string): Promise<string | undefined> {
  const items = await listTemplates(cwd);
  return items.find((item) => item.name === name)?.body;
}

export async function saveProjectTemplate(cwd: string, name: string, body: string): Promise<string> {
  const existing = await getProjectConfig(cwd);
  const config = existing?.config ?? { profiles: {}, routingRules: [], templates: {} };
  config.templates = config.templates ?? {};
  config.templates[name] = body;
  return writeProjectConfig(existing?.dir ?? cwd, config);
}

export function renderTemplate(template: string, input: string, vars: Record<string, string> = {}): string {
  let output = template.replace(/\{\{\s*input\s*\}\}/g, input);
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    output = output.replace(pattern, value);
  }
  return output;
}
