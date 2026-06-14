export type CardType =
  | "web_preview"
  | "github_pr"
  | "github_issue"
  | "github_commit"
  | "calendar_event"
  | "email"
  | "file"
  | "terminal"
  | "diff"
  | "table"
  | "image"
  | "generic";

export interface CardAction {
  label: string;
  type: "open_url" | "copy" | "share" | "reply" | "run_skill" | "download";
  payload: string;
  icon?: string;
}

export interface ToolResultCard {
  type: CardType;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  actions?: CardAction[];
  data: Record<string, unknown>;
}

// Specific card data shapes

export interface WebPreviewData {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
}

export interface GitHubPRData {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  repo: string;
  additions: number;
  deletions: number;
  reviewStatus?: "approved" | "changes_requested" | "pending";
  labels?: string[];
  url: string;
}

export interface GitHubIssueData {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  repo: string;
  labels?: string[];
  assignees?: string[];
  url: string;
}

export interface CalendarEventData {
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  url?: string;
}

export interface EmailData {
  subject: string;
  from: string;
  to?: string[];
  preview: string;
  date: string;
  isRead?: boolean;
  url?: string;
}

export interface FileData {
  name: string;
  path?: string;
  size?: number;
  mimeType?: string;
  url?: string;
}

export interface TerminalData {
  command?: string;
  output: string;
  exitCode?: number;
  cwd?: string;
}

export interface DiffData {
  filename: string;
  language?: string;
  additions: string[];
  deletions: string[];
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface MediaAttachment {
  id: string;
  type: "image" | "video" | "audio" | "file";
  uri: string;
  mimeType: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
  uploadProgress?: number;
}
