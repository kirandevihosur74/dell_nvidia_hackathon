/**
 * Unified agent lookup — checks built-in subagents first, then custom agents.
 */
import { getSubagent, type Subagent } from "./subagentRegistry";
import { useCustomAgentStore } from "@/stores/customAgentStore";

export function findAgent(id: string): Subagent | undefined {
  // Check built-in agents first
  const builtIn = getSubagent(id);
  if (builtIn) return builtIn;

  // Check custom agents
  const custom = useCustomAgentStore.getState().getAgent(id);
  if (custom) {
    return {
      id: custom.id,
      categoryId: custom.categoryId,
      name: custom.name,
      description: custom.description,
      sandboxMode: custom.sandboxMode,
      systemPrompt: custom.systemPrompt,
    };
  }

  return undefined;
}
