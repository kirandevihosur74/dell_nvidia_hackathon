import { useSettingsStore } from "@/stores/settingsStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { CronJob } from "@/types/gateway";

function getBaseUrl(): string {
  const nerveUrl = useSettingsStore.getState().nerveUrl;

  if (nerveUrl && nerveUrl !== "http://localhost:3080") {
    return nerveUrl.replace(/\/$/, "");
  }

  // In dev (simulator), localhost works
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
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Nerve cron job shape from the API */
interface NerveCronJob {
  id?: string;
  jobId?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind: string; expr?: string; everyMs?: number; at?: string };
  payload?: { kind: string; message?: string; text?: string };
  state?: { lastRunAtMs?: number; nextRunAtMs?: number };
  agentId?: string;
  sessionKey?: string;
  createdAt?: number;
}

function mapJob(j: NerveCronJob): CronJob {
  const id = j.id || j.jobId || "";
  const schedule = j.schedule;
  let scheduleStr = "";
  if (schedule?.kind === "cron" && schedule.expr) scheduleStr = schedule.expr;
  else if (schedule?.kind === "every" && schedule.everyMs) scheduleStr = `every ${Math.round(schedule.everyMs / 60000)}m`;
  else if (schedule?.kind === "at" && schedule.at) scheduleStr = `at ${schedule.at}`;

  const payload = j.payload;
  let command = "";
  if (payload?.kind === "agentTurn" && payload.message) command = payload.message;
  else if (payload?.kind === "systemEvent" && payload.text) command = payload.text;

  return {
    id,
    schedule: scheduleStr,
    command,
    agentId: j.agentId || "",
    enabled: j.enabled !== false,
    lastRun: j.state?.lastRunAtMs,
    nextRun: j.state?.nextRunAtMs,
    createdAt: j.createdAt || 0,
  };
}

export async function listCrons(): Promise<CronJob[]> {
  const data = await request<{ ok: boolean; result: unknown }>("/api/crons");
  if (!data.ok) throw new Error("Failed to list crons");

  const result = data.result as Record<string, unknown>;
  let jobs: NerveCronJob[] = [];
  if (Array.isArray(result)) jobs = result;
  else if (Array.isArray((result as any)?.jobs)) jobs = (result as any).jobs;
  else if (Array.isArray((result as any)?.details?.jobs)) jobs = (result as any).details.jobs;

  return jobs.map(mapJob);
}

export async function createCron(job: {
  schedule: string;
  command: string;
  agentId: string;
}): Promise<CronJob> {
  const body = {
    job: {
      name: job.command.slice(0, 100),
      schedule: { kind: "cron", expr: job.schedule },
      payload: { kind: "agentTurn", message: job.command },
      sessionTarget: "isolated",
      agentId: job.agentId || undefined,
      enabled: true,
    },
  };
  const data = await request<{ ok: boolean; result: unknown }>("/api/crons", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data.ok) throw new Error("Failed to create cron");
  return mapJob(data.result as NerveCronJob);
}

export async function toggleCron(id: string, enabled: boolean): Promise<void> {
  const data = await request<{ ok: boolean }>(`/api/crons/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  if (!data.ok) throw new Error("Failed to toggle cron");
}

export async function deleteCron(id: string): Promise<void> {
  const data = await request<{ ok: boolean }>(`/api/crons/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!data.ok) throw new Error("Failed to delete cron");
}

export async function runCron(id: string): Promise<void> {
  const data = await request<{ ok: boolean }>(`/api/crons/${encodeURIComponent(id)}/run`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!data.ok) throw new Error("Failed to run cron");
}
