import chalk from "chalk";
import { getTemplate, listTemplates, renderTemplate, saveProjectTemplate } from "../core/templates.js";

export async function listPromptTemplates(cwd: string): Promise<void> {
  const templates = await listTemplates(cwd);
  if (!templates.length) {
    console.log(chalk.yellow("No templates found."));
    return;
  }
  for (const item of templates) {
    console.log(chalk.bold(`${item.name} (${item.source})`));
    console.log(`  ${item.body.replace(/\s+/g, " ").slice(0, 120)}${item.body.length > 120 ? "..." : ""}`);
  }
}

export async function showPromptTemplate(cwd: string, name: string): Promise<void> {
  const template = await getTemplate(cwd, name);
  if (!template) {
    throw new Error(`Template '${name}' not found.`);
  }
  console.log(template);
}

export async function addProjectTemplate(cwd: string, name: string, body: string): Promise<void> {
  const target = await saveProjectTemplate(cwd, name, body);
  console.log(chalk.green(`Template '${name}' written to ${target}`));
}

export async function renderPromptTemplate(cwd: string, name: string, input: string): Promise<void> {
  const template = await getTemplate(cwd, name);
  if (!template) {
    throw new Error(`Template '${name}' not found.`);
  }
  console.log(renderTemplate(template, input));
}
