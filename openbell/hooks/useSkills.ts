import { useEffect, useCallback } from "react";
import { useSkillStore } from "@/stores/skillStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import type { GatewayMessage } from "@/types/gateway";
import type { OpenClawSkill, SkillInvocation } from "@/types/skills";

/**
 * Hook for browsing and invoking OpenClaw skills.
 */
export function useSkills() {
  const {
    filteredSkills,
    searchQuery,
    activeCategory,
    favorites,
    recentInvocations,
    loading,
    setSkills,
    setSearchQuery,
    setActiveCategory,
    toggleFavorite,
    addRecentInvocation,
    setLoading,
    loadPersisted,
  } = useSkillStore();

  const { connectionStatus, activeSessionId } = useGatewayStore();

  // Load persisted favorites/recents
  useEffect(() => {
    loadPersisted();
  }, [loadPersisted]);

  // Listen for skill list responses from Gateway
  useEffect(() => {
    const unsub = gatewayClient.onMessage((msg: GatewayMessage) => {
      if (msg.type === "node_list" || msg.type === "chat_done") {
        const payload = msg.payload;
        if (payload?.skills && Array.isArray(payload.skills)) {
          const skills: OpenClawSkill[] = (payload.skills as Record<string, unknown>[]).map(
            (s) => ({
              id: (s.id as string) || (s.name as string) || "",
              name: (s.name as string) || "",
              description: (s.description as string) || "",
              category: (s.category as string) || "custom",
              parameters: Array.isArray(s.parameters)
                ? (s.parameters as OpenClawSkill["parameters"])
                : [],
              examples: Array.isArray(s.examples) ? (s.examples as string[]) : [],
              isFavorite: false,
            })
          );
          setSkills(skills);
          setLoading(false);
        }
      }
    });

    return unsub;
  }, [setSkills, setLoading]);

  /** Fetch skills from the Gateway. */
  const fetchSkills = useCallback(() => {
    if (connectionStatus !== "connected") return;
    setLoading(true);

    // Try skills.status first, fall back to node.list
    gatewayClient.request("skills.status").then((result) => {
      const res = result as Record<string, unknown> | undefined;
      if (res?.skills && Array.isArray(res.skills)) {
        const categories = new Set((res.skills as Record<string, unknown>[]).map((s) => s.category as string));
        console.log("[Skills] gateway categories:", Array.from(categories));
        const skills: OpenClawSkill[] = (res.skills as Record<string, unknown>[]).map(
          (s) => ({
            id: (s.id as string) || (s.name as string) || "",
            name: (s.name as string) || "",
            description: (s.description as string) || "",
            category: (s.category as string) || "custom",
            parameters: Array.isArray(s.parameters)
              ? (s.parameters as OpenClawSkill["parameters"])
              : [],
            examples: Array.isArray(s.examples) ? (s.examples as string[]) : [],
            isFavorite: false,
          })
        );
        setSkills(skills);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [connectionStatus, setLoading, setSkills]);

  /** Invoke a skill by sending it as a chat command. */
  const invokeSkill = useCallback(
    (skill: OpenClawSkill, params: Record<string, unknown>) => {
      if (connectionStatus !== "connected") return;

      const sessionKey = activeSessionId || "main";

      // Build the invocation command
      const paramStr = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ");

      const command = paramStr
        ? `/${skill.name} ${paramStr}`
        : `/${skill.name}`;

      gatewayClient.request("chat.send", { sessionKey, message: command, deliver: false, idempotencyKey: makeIdempotencyKey() }).catch(() => {});

      const invocation: SkillInvocation = {
        skillId: skill.id,
        parameters: params,
        timestamp: new Date().toISOString(),
      };
      addRecentInvocation(invocation);
    },
    [activeSessionId, connectionStatus, addRecentInvocation]
  );

  return {
    skills: filteredSkills,
    searchQuery,
    activeCategory,
    favorites,
    recentInvocations,
    loading,
    isConnected: connectionStatus === "connected",
    setSearchQuery,
    setActiveCategory,
    toggleFavorite,
    fetchSkills,
    invokeSkill,
  };
}
