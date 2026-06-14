#!/usr/bin/env node
/**
 * Parses all .toml subagent files from awesome-codex-subagents
 * and generates a TypeScript registry module.
 */
const fs = require("fs");
const path = require("path");

const TOML_ROOT = path.resolve(__dirname, "../../../../awesome-codex-subagents/categories");
const OUT_FILE = path.resolve(__dirname, "../services/openclaw/subagentRegistry.ts");

// Category metadata: directory name → display info
const CATEGORIES = {
  "01-core-development":     { id: "core-development",     label: "Core Development",     icon: "Code2" },
  "02-language-specialists":  { id: "language-specialists",  label: "Language Specialists",  icon: "FileCode" },
  "03-infrastructure":        { id: "infrastructure",        label: "Infrastructure",        icon: "Server" },
  "04-quality-security":      { id: "quality-security",      label: "Quality & Security",    icon: "ShieldCheck" },
  "05-data-ai":               { id: "data-ai",               label: "Data & AI",             icon: "Brain" },
  "06-developer-experience":  { id: "developer-experience",  label: "Developer Experience",  icon: "Wrench" },
  "07-specialized-domains":   { id: "specialized-domains",   label: "Specialized Domains",   icon: "Layers" },
  "08-business-product":      { id: "business-product",      label: "Business & Product",    icon: "Briefcase" },
  "09-meta-orchestration":    { id: "meta-orchestration",    label: "Meta & Orchestration",  icon: "GitBranch" },
  "10-research-analysis":     { id: "research-analysis",     label: "Research & Analysis",   icon: "Search" },
};

function parseToml(content) {
  const agent = {};
  // Extract simple key = "value" fields
  for (const key of ["name", "description", "model", "model_reasoning_effort", "sandbox_mode"]) {
    const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
    if (match) agent[key] = match[1];
  }
  // Extract developer_instructions (triple-quoted)
  const instrMatch = content.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""/);
  if (instrMatch) {
    agent.developer_instructions = instrMatch[1].trim();
  }
  return agent;
}

function escapeTs(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

// Gather all agents
const allAgents = [];
const categoryDirs = fs.readdirSync(TOML_ROOT).filter(d =>
  fs.statSync(path.join(TOML_ROOT, d)).isDirectory()
).sort();

for (const dir of categoryDirs) {
  const catMeta = CATEGORIES[dir];
  if (!catMeta) continue;

  const dirPath = path.join(TOML_ROOT, dir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".toml")).sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
    const parsed = parseToml(content);
    if (!parsed.name) continue;

    allAgents.push({
      id: parsed.name,
      categoryId: catMeta.id,
      name: parsed.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      description: parsed.description || "",
      sandboxMode: parsed.sandbox_mode || "read-only",
      systemPrompt: parsed.developer_instructions || "",
    });
  }
}

// Generate TypeScript
const ts = `// Auto-generated from awesome-codex-subagents — do not edit manually.
// Run: node scripts/generateSubagentRegistry.js

// ─── Types ─────────────────────────────────────────────────────────

export interface SubagentCategory {
  id: string;
  label: string;
  icon: string;
}

export interface Subagent {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  sandboxMode: "read-only" | "workspace-write";
  systemPrompt: string;
}

// ─── Categories ────────────────────────────────────────────────────

export const SUBAGENT_CATEGORIES: SubagentCategory[] = [
${Object.values(CATEGORIES).map(c =>
  `  { id: "${c.id}", label: "${c.label}", icon: "${c.icon}" },`
).join("\n")}
];

// ─── Agents (${allAgents.length} total) ────────────────────────────

export const SUBAGENTS: Subagent[] = [
${allAgents.map(a => `  {
    id: "${a.id}",
    categoryId: "${a.categoryId}",
    name: "${a.name}",
    description: "${escapeTs(a.description)}",
    sandboxMode: "${a.sandboxMode}",
    systemPrompt: \`${escapeTs(a.systemPrompt)}\`,
  },`).join("\n")}
];

// ─── Helpers ───────────────────────────────────────────────────────

export function getSubagentsByCategory(categoryId: string): Subagent[] {
  return SUBAGENTS.filter(a => a.categoryId === categoryId);
}

export function getSubagent(id: string): Subagent | undefined {
  return SUBAGENTS.find(a => a.id === id);
}

export function searchSubagents(query: string): Subagent[] {
  const q = query.toLowerCase();
  return SUBAGENTS.filter(
    a => a.name.toLowerCase().includes(q) ||
         a.description.toLowerCase().includes(q) ||
         a.id.toLowerCase().includes(q)
  );
}
`;

fs.writeFileSync(OUT_FILE, ts, "utf-8");
console.log("Generated " + OUT_FILE + " with " + allAgents.length + " subagents across " + Object.keys(CATEGORIES).length + " categories.");
