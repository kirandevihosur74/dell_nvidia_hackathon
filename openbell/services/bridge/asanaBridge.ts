import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { api } from "@/services/apiClient";
import type { GatewayMessage } from "@/types/gateway";
import type { AsanaTask } from "@/types/asana";

/** Activity event emitted by the bridge for the unified activity feed. */
export interface BridgeActivity {
  id: string;
  source: "agent" | "user";
  type: "task_created" | "task_completed" | "task_updated" | "task_deleted" | "agent_action" | "delegation";
  title: string;
  detail: string;
  taskGid?: string;
  timestamp: string;
}

type ActivityHandler = (activity: BridgeActivity) => void;
type BoardRefreshHandler = () => void;

/**
 * AsanaBridge — bidirectional integration between OpenClaw agent and the Asana board.
 *
 * Direction 1 (Agent → Board): Listens for tool call results from the Gateway
 * that represent task operations, then triggers board refreshes.
 *
 * Direction 2 (Board → Agent): Provides methods to send task context
 * to the agent (ask about, delegate).
 */
class AsanaBridge {
  private activityHandlers = new Set<ActivityHandler>();
  private refreshHandlers = new Set<BoardRefreshHandler>();
  private unsubMessage: (() => void) | null = null;

  /** Start listening to Gateway messages for task-related tool calls. */
  start(): void {
    this.stop();
    this.unsubMessage = gatewayClient.onMessage(this.handleMessage);
  }

  stop(): void {
    this.unsubMessage?.();
    this.unsubMessage = null;
  }

  /** Subscribe to bridge activity events (for unified activity feed). */
  onActivity(handler: ActivityHandler): () => void {
    this.activityHandlers.add(handler);
    return () => this.activityHandlers.delete(handler);
  }

  /** Subscribe to board refresh events (board should re-fetch tasks). */
  onBoardRefresh(handler: BoardRefreshHandler): () => void {
    this.refreshHandlers.add(handler);
    return () => this.refreshHandlers.delete(handler);
  }

  // --- Board → Agent Actions ---

  /**
   * Ask the agent about a specific task.
   * Sends task context to the active session as a chat message.
   */
  askAgentAboutTask(task: AsanaTask, sessionId: string, question?: string): void {
    const prompt = question
      ? `Regarding task "${task.name}" (${task.gid}): ${question}`
      : `Tell me about this task: "${task.name}" (ID: ${task.gid})${task.notes ? `\nNotes: ${task.notes}` : ""}${task.due_on ? `\nDue: ${task.due_on}` : ""}${task.assignee ? `\nAssignee: ${task.assignee.name}` : ""}`;

    gatewayClient.request("chat.send", { sessionKey: sessionId, message: prompt, deliver: false, idempotencyKey: makeIdempotencyKey() }).catch(() => {});

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "user",
      type: "agent_action",
      title: "Asked Agent About Task",
      detail: `Asked about "${task.name}"`,
      taskGid: task.gid,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Delegate a task to the agent for autonomous work.
   * Sends a delegation prompt with full task context.
   */
  delegateTaskToAgent(task: AsanaTask, sessionId: string, instructions?: string): void {
    const prompt = [
      `I'm delegating this task to you for autonomous work:`,
      ``,
      `Task: ${task.name}`,
      `ID: ${task.gid}`,
      task.notes ? `Notes: ${task.notes}` : null,
      task.due_on ? `Due: ${task.due_on}` : null,
      task.assignee ? `Assignee: ${task.assignee.name}` : null,
      task.projects?.length ? `Project: ${task.projects.map((p) => p.name).join(", ")}` : null,
      ``,
      instructions ? `Instructions: ${instructions}` : `Please work on this task and update me on progress.`,
    ]
      .filter(Boolean)
      .join("\n");

    gatewayClient.request("chat.send", { sessionKey: sessionId, message: prompt, deliver: false, idempotencyKey: makeIdempotencyKey() }).catch(() => {});

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "user",
      type: "delegation",
      title: "Delegated Task to Agent",
      detail: `Delegated "${task.name}"${instructions ? ` with instructions` : ""}`,
      taskGid: task.gid,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify the agent about a board change made by the user.
   */
  notifyAgentOfBoardChange(action: string, task: AsanaTask, sessionId: string): void {
    const msg = `[Board Update] Task "${task.name}" was ${action} by user.`;
    gatewayClient.request("chat.send", { sessionKey: sessionId, message: msg, deliver: false, idempotencyKey: makeIdempotencyKey() }).catch(() => {});
  }

  // --- Internal: Agent → Board ---

  private handleMessage = (msg: GatewayMessage): void => {
    if (msg.type !== "chat_tool_result") return;

    const payload = msg.payload;
    if (!payload) return;

    const toolName = (payload.tool_name as string) || (payload.toolName as string) || "";
    const result = payload.output || payload.result;

    if (!result || typeof result !== "object") return;

    const resultObj = result as Record<string, unknown>;

    // Detect task operations from tool results
    if (this.isTaskCreateResult(toolName, resultObj)) {
      this.handleTaskCreated(resultObj);
    } else if (this.isTaskCompleteResult(toolName, resultObj)) {
      this.handleTaskCompleted(resultObj);
    } else if (this.isTaskUpdateResult(toolName, resultObj)) {
      this.handleTaskUpdated(resultObj);
    } else if (this.isTaskDeleteResult(toolName, resultObj)) {
      this.handleTaskDeleted(resultObj);
    }
  };

  private isTaskCreateResult(toolName: string, result: Record<string, unknown>): boolean {
    return (
      toolName.includes("create_task") ||
      toolName.includes("add_task") ||
      (!!result.gid && !!result.name && toolName.includes("task"))
    );
  }

  private isTaskCompleteResult(toolName: string, result: Record<string, unknown>): boolean {
    return (
      toolName.includes("complete_task") ||
      toolName.includes("close_task") ||
      (!!result.completed && toolName.includes("task"))
    );
  }

  private isTaskUpdateResult(toolName: string, result: Record<string, unknown>): boolean {
    return toolName.includes("update_task") || toolName.includes("edit_task");
  }

  private isTaskDeleteResult(toolName: string, result: Record<string, unknown>): boolean {
    return toolName.includes("delete_task") || toolName.includes("remove_task");
  }

  private handleTaskCreated(result: Record<string, unknown>): void {
    const taskName = (result.name as string) || "Unknown task";
    const taskGid = result.gid as string;

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "agent",
      type: "task_created",
      title: "Agent Created Task",
      detail: taskName,
      taskGid,
      timestamp: new Date().toISOString(),
    });

    this.triggerBoardRefresh();
  }

  private handleTaskCompleted(result: Record<string, unknown>): void {
    const taskName = (result.name as string) || "Unknown task";
    const taskGid = result.gid as string;

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "agent",
      type: "task_completed",
      title: "Agent Completed Task",
      detail: taskName,
      taskGid,
      timestamp: new Date().toISOString(),
    });

    this.triggerBoardRefresh();
  }

  private handleTaskUpdated(result: Record<string, unknown>): void {
    const taskName = (result.name as string) || "Unknown task";
    const taskGid = result.gid as string;

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "agent",
      type: "task_updated",
      title: "Agent Updated Task",
      detail: taskName,
      taskGid,
      timestamp: new Date().toISOString(),
    });

    this.triggerBoardRefresh();
  }

  private handleTaskDeleted(result: Record<string, unknown>): void {
    const taskName = (result.name as string) || "Unknown task";
    const taskGid = result.gid as string;

    this.emitActivity({
      id: `bridge_${Date.now()}`,
      source: "agent",
      type: "task_deleted",
      title: "Agent Deleted Task",
      detail: taskName,
      taskGid,
      timestamp: new Date().toISOString(),
    });

    this.triggerBoardRefresh();
  }

  private emitActivity(activity: BridgeActivity): void {
    for (const handler of this.activityHandlers) {
      try {
        handler(activity);
      } catch {
        // ignore
      }
    }
  }

  private triggerBoardRefresh(): void {
    for (const handler of this.refreshHandlers) {
      try {
        handler();
      } catch {
        // ignore
      }
    }
  }
}

export const asanaBridge = new AsanaBridge();
