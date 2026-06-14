import { Platform } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { KanbanTask, KanbanProposal, KanbanStatus } from "@/types/gateway";

function getBaseUrl(): string {
  const nerveUrl = useSettingsStore.getState().nerveUrl;

  // If user set a custom URL (not the default), always use it
  if (nerveUrl && nerveUrl !== "http://localhost:3080") {
    return nerveUrl.replace(/\/$/, "");
  }

  // On iOS simulator (__DEV__ is true), localhost works — don't override
  if (__DEV__) {
    return nerveUrl.replace(/\/$/, "");
  }

  // On real devices, derive from Gateway host
  const gateways = useGatewayStore.getState().gateways;
  const activeId = useGatewayStore.getState().activeGatewayId;
  const gw = gateways.find((g) => g.id === activeId);
  if (gw?.host && gw.host !== "localhost" && gw.host !== "127.0.0.1") {
    return `http://${gw.host}:3080`;
  }

  return nerveUrl.replace(/\/$/, "");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// --- Task CRUD ---

interface TaskListResponse {
  items: NerveTask[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Nerve uses a richer task model — map to our mobile type */
interface NerveTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdBy?: string;
  assignee?: string;
  labels?: string[];
  version: number;
  createdAt: number;
  updatedAt: number;
  run?: { status: string };
  result?: string;
}

/** Normalize backend status strings to the 5 canonical KanbanStatus values */
function normalizeStatus(raw: string): KanbanStatus {
  const s = raw.toLowerCase().replace(/[_\s]+/g, "-").trim();
  switch (s) {
    case "backlog":
      return "backlog";
    case "todo":
    case "to-do":
    case "new":
    case "open":
    case "pending":
    case "created":
      return "todo";
    case "in-progress":
    case "in-prog":
    case "active":
    case "running":
    case "started":
      return "in-progress";
    case "review":
    case "in-review":
    case "reviewing":
      return "review";
    case "done":
    case "complete":
    case "completed":
    case "closed":
    case "resolved":
    case "finished":
      return "done";
    default:
      return "backlog";
  }
}

function mapTask(t: NerveTask): KanbanTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: normalizeStatus(t.status),
    priority: mapPriority(t.priority),
    agentId: t.assignee,
    version: t.version || 1,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function mapPriority(p: string): KanbanTask["priority"] {
  if (p === "critical" || p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}

function unmapPriority(p?: string): string {
  if (p === "high") return "high";
  if (p === "low") return "low";
  return "normal";
}

export async function listTasks(status?: KanbanStatus): Promise<KanbanTask[]> {
  const allTasks: KanbanTask[] = [];
  let offset = 0;
  const limit = 50;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    const query = `?${params.toString()}`;

    const data = await request<TaskListResponse>(`/api/kanban/tasks${query}`);
    allTasks.push(...(data.items || []).map(mapTask));

    if (!data.hasMore) break;
    offset += limit;
  }

  return allTasks;
}

export async function createTask(task: {
  title: string;
  description?: string;
  status: KanbanStatus;
  priority?: string;
}): Promise<KanbanTask> {
  const body = {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: unmapPriority(task.priority),
    createdBy: "operator",
  };
  const created = await request<NerveTask>("/api/kanban/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapTask(created);
}

export async function updateTask(
  id: string,
  version: number,
  updates: Partial<Pick<KanbanTask, "title" | "description" | "status" | "priority">>
): Promise<KanbanTask> {
  const body: Record<string, unknown> = { version };
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.priority !== undefined) body.priority = unmapPriority(updates.priority);

  const updated = await request<NerveTask>(`/api/kanban/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return mapTask(updated);
}

export async function deleteTask(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/kanban/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function reorderTask(
  id: string,
  version: number,
  targetStatus: KanbanStatus,
  targetIndex: number
): Promise<KanbanTask> {
  const body = { version, targetStatus, targetIndex };
  const updated = await request<NerveTask>(
    `/api/kanban/tasks/${encodeURIComponent(id)}/reorder`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return mapTask(updated);
}

// --- Proposals ---

interface NerveProposal {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  proposedBy: string;
  proposedAt: number;
  status: string;
  version: number;
  reason?: string;
}

function mapProposal(p: NerveProposal): KanbanProposal {
  return {
    id: p.id,
    taskId: p.payload.taskId as string | undefined,
    action: p.type as KanbanProposal["action"],
    payload: p.payload as Partial<KanbanTask>,
    reason: p.reason || `${p.type} proposed by ${p.proposedBy}`,
    agentId: p.proposedBy,
    createdAt: p.proposedAt,
  };
}

export async function listProposals(): Promise<KanbanProposal[]> {
  const data = await request<{ items: NerveProposal[] }>("/api/kanban/proposals?status=pending");
  return (data.items || []).map(mapProposal);
}

export async function approveProposal(id: string): Promise<{ task: KanbanTask }> {
  const data = await request<{ proposal: NerveProposal; task: NerveTask }>(
    `/api/kanban/proposals/${encodeURIComponent(id)}/approve`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return { task: mapTask(data.task) };
}

export async function rejectProposal(id: string, reason?: string): Promise<void> {
  await request<{ proposal: NerveProposal }>(
    `/api/kanban/proposals/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}
