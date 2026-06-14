import type { ToolResultCard } from "@/types/cards";
import { WebPreviewCard } from "./WebPreviewCard";
import { GitHubPRCard } from "./GitHubPRCard";
import { GitHubIssueCard } from "./GitHubIssueCard";
import { CalendarCard } from "./CalendarCard";
import { EmailCard } from "./EmailCard";
import { FileCard } from "./FileCard";
import { TerminalCard } from "./TerminalCard";
import { DiffCard } from "./DiffCard";
import { TableCard } from "./TableCard";
import { GenericCard } from "./GenericCard";

interface CardRendererProps {
  card: ToolResultCard;
}

/**
 * Routes a ToolResultCard to the appropriate card component based on its type.
 */
export function CardRenderer({ card }: CardRendererProps) {
  switch (card.type) {
    case "web_preview":
      return <WebPreviewCard card={card} />;
    case "github_pr":
      return <GitHubPRCard card={card} />;
    case "github_issue":
      return <GitHubIssueCard card={card} />;
    case "calendar_event":
      return <CalendarCard card={card} />;
    case "email":
      return <EmailCard card={card} />;
    case "file":
      return <FileCard card={card} />;
    case "terminal":
      return <TerminalCard card={card} />;
    case "diff":
      return <DiffCard card={card} />;
    case "table":
      return <TableCard card={card} />;
    default:
      return <GenericCard card={card} />;
  }
}
