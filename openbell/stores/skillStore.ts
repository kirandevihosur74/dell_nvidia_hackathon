import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OpenClawSkill, SkillInvocation, SkillCategory } from "@/types/skills";

const FAVORITES_KEY = "openclaw_skill_favorites";
const RECENTS_KEY = "openclaw_skill_recents";

interface SkillState {
  skills: OpenClawSkill[];
  filteredSkills: OpenClawSkill[];
  favorites: string[];
  recentInvocations: SkillInvocation[];
  searchQuery: string;
  activeCategory: SkillCategory;
  loading: boolean;

  setSkills: (skills: OpenClawSkill[]) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: SkillCategory) => void;
  toggleFavorite: (skillId: string) => void;
  addRecentInvocation: (invocation: SkillInvocation) => void;
  setLoading: (loading: boolean) => void;
  loadPersisted: () => Promise<void>;
}

// Classify skills into our filter categories by name, description, and raw category
function classifySkill(skill: OpenClawSkill): SkillCategory {
  const raw = skill.category.toLowerCase().trim();
  const name = skill.name.toLowerCase();
  const desc = skill.description.toLowerCase();
  const text = `${raw} ${name} ${desc}`;

  // Exact category matches first
  if (raw === "automation" || raw === "workflow" || raw === "ci" || raw === "ci/cd") return "automation";
  if (raw === "development" || raw === "dev" || raw === "code" || raw === "coding") return "development";
  if (raw === "communication" || raw === "comms" || raw === "messaging") return "communication";
  if (raw === "productivity" || raw === "notes" || raw === "calendar" || raw === "tasks") return "productivity";
  if (raw === "system" || raw === "utility" || raw === "admin" || raw === "data" || raw === "database") return "system";

  // Keyword-based classification from name + description
  if (/\b(git|github|deploy|build|docker|npm|yarn|test|lint|compile|debug|code|pr|merge|branch|commit|ci)\b/.test(text)) return "development";
  if (/\b(slack|discord|telegram|email|mail|sms|notify|notification|message|chat|send)\b/.test(text)) return "communication";
  if (/\b(automat|workflow|cron|schedule|trigger|pipeline|hook|webhook|zapier|ifttt)\b/.test(text)) return "automation";
  if (/\b(note|reminder|calendar|todo|task|bookmark|journal|memo|apple.?notes|apple.?reminders)\b/.test(text)) return "productivity";
  if (/\b(system|cli|shell|terminal|file|disk|process|network|dns|ssh|curl|api|database|db|sql|query|search|monitor|log|backup|security|password|1password|auth|key|secret|encrypt)\b/.test(text)) return "system";

  return "custom";
}

function filterSkills(
  skills: OpenClawSkill[],
  query: string,
  category: SkillCategory,
  favorites: string[]
): OpenClawSkill[] {
  let result = skills.map((s) => ({ ...s, isFavorite: favorites.includes(s.id) }));

  if (category !== "all") {
    result = result.filter((s) => classifySkill(s) === category);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }

  // Favorites first, then alphabetical
  result.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  filteredSkills: [],
  favorites: [],
  recentInvocations: [],
  searchQuery: "",
  activeCategory: "all",
  loading: false,

  setSkills: (skills) => {
    const { searchQuery, activeCategory, favorites } = get();
    set({
      skills,
      filteredSkills: filterSkills(skills, searchQuery, activeCategory, favorites),
    });
  },

  setSearchQuery: (query) => {
    const { skills, activeCategory, favorites } = get();
    set({
      searchQuery: query,
      filteredSkills: filterSkills(skills, query, activeCategory, favorites),
    });
  },

  setActiveCategory: (category) => {
    const { skills, searchQuery, favorites } = get();
    set({
      activeCategory: category,
      filteredSkills: filterSkills(skills, searchQuery, category, favorites),
    });
  },

  toggleFavorite: (skillId) => {
    const { favorites, skills, searchQuery, activeCategory } = get();
    const updated = favorites.includes(skillId)
      ? favorites.filter((id) => id !== skillId)
      : [...favorites, skillId];

    set({
      favorites: updated,
      filteredSkills: filterSkills(skills, searchQuery, activeCategory, updated),
    });

    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  },

  addRecentInvocation: (invocation) => {
    const { recentInvocations } = get();
    const updated = [invocation, ...recentInvocations].slice(0, 20);
    set({ recentInvocations: updated });
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  },

  setLoading: (loading) => set({ loading }),

  loadPersisted: async () => {
    try {
      const [favJson, recentsJson] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(RECENTS_KEY),
      ]);
      const favorites = favJson ? JSON.parse(favJson) : [];
      const recentInvocations = recentsJson ? JSON.parse(recentsJson) : [];
      set({ favorites, recentInvocations });
    } catch {
      // ignore
    }
  },
}));
