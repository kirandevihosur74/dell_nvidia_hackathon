import { Text, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

interface Props {
  children: string;
  selectable?: boolean;
  style?: {
    body?: TextStyle;
    strong?: TextStyle;
    em?: TextStyle;
    code?: TextStyle;
    codeBlock?: ViewStyle & TextStyle;
    listItem?: TextStyle;
    heading1?: TextStyle;
    heading2?: TextStyle;
    heading3?: TextStyle;
    hr?: ViewStyle;
    paragraph?: ViewStyle;
  };
}

type InlineSegment =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "bolditalic"; text: string }
  | { type: "code"; text: string };

function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Match: ***bold italic***, **bold**, *italic*, `code`
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      segments.push({ type: "bolditalic", text: match[2] });
    } else if (match[3]) {
      segments.push({ type: "bold", text: match[3] });
    } else if (match[4]) {
      segments.push({ type: "italic", text: match[4] });
    } else if (match[5]) {
      segments.push({ type: "code", text: match[5] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push({ type: "text", text: line.slice(lastIndex) });
  }

  return segments;
}

function renderInline(segments: InlineSegment[], baseStyle: TextStyle, styles: Props["style"], selectable?: boolean) {
  return segments.map((seg, i) => {
    switch (seg.type) {
      case "bold":
        return <Text key={i} selectable={selectable} style={[baseStyle, { fontWeight: "700" }, styles?.strong]}>{seg.text}</Text>;
      case "italic":
        return <Text key={i} selectable={selectable} style={[baseStyle, { fontStyle: "italic" }, styles?.em]}>{seg.text}</Text>;
      case "bolditalic":
        return <Text key={i} selectable={selectable} style={[baseStyle, { fontWeight: "700", fontStyle: "italic" }, styles?.strong, styles?.em]}>{seg.text}</Text>;
      case "code":
        return (
          <Text key={i} selectable={selectable} style={[baseStyle, {
            fontFamily: "monospace",
            backgroundColor: "rgba(128,128,128,0.15)",
            borderRadius: 3,
            paddingHorizontal: 4,
            fontSize: (baseStyle.fontSize ?? 15) - 1,
          }, styles?.code]}>
            {seg.text}
          </Text>
        );
      default:
        return <Text key={i} selectable={selectable} style={baseStyle}>{seg.text}</Text>;
    }
  });
}

export function MarkdownText({ children, selectable, style }: Props) {
  const lines = children.split("\n");
  const baseStyle: TextStyle = { fontSize: 15, lineHeight: 22, ...style?.body };
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <View key={`code-${i}`} style={[{
          backgroundColor: "rgba(128,128,128,0.12)",
          borderRadius: 8,
          padding: 10,
          marginVertical: 4,
        }, style?.codeBlock]}>
          <Text selectable={selectable} style={[baseStyle, { fontFamily: "monospace", fontSize: 13 }, style?.codeBlock]}>
            {codeLines.join("\n")}
          </Text>
        </View>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(
        <View key={`hr-${i}`} style={[{
          height: 1,
          backgroundColor: "rgba(128,128,128,0.3)",
          marginVertical: 8,
        }, style?.hr]} />
      );
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingStyle = level === 1 ? style?.heading1 : level === 2 ? style?.heading2 : style?.heading3;
      const fontSize = level === 1 ? 20 : level === 2 ? 18 : 16;
      elements.push(
        <Text key={`h-${i}`} selectable={selectable} style={[baseStyle, { fontSize, fontWeight: "700", marginBottom: 4 }, headingStyle]}>
          {renderInline(parseInline(text), { ...baseStyle, fontSize, fontWeight: "700" }, style, selectable)}
        </Text>
      );
      i++;
      continue;
    }

    // Unordered list item (- or *)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (ulMatch) {
      const indent = Math.floor((ulMatch[1]?.length || 0) / 2);
      elements.push(
        <View key={`li-${i}`} style={{ flexDirection: "row", paddingLeft: indent * 16, marginVertical: 1 }}>
          <Text selectable={selectable} style={[baseStyle, style?.listItem]}>{"  \u2022  "}</Text>
          <Text selectable={selectable} style={[baseStyle, { flex: 1 }, style?.listItem]}>
            {renderInline(parseInline(ulMatch[2]), baseStyle, style, selectable)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
    if (olMatch) {
      const indent = Math.floor((olMatch[1]?.length || 0) / 2);
      elements.push(
        <View key={`ol-${i}`} style={{ flexDirection: "row", paddingLeft: indent * 16, marginVertical: 1 }}>
          <Text selectable={selectable} style={[baseStyle, style?.listItem]}>{`  ${olMatch[2]}.  `}</Text>
          <Text selectable={selectable} style={[baseStyle, { flex: 1 }, style?.listItem]}>
            {renderInline(parseInline(olMatch[3]), baseStyle, style, selectable)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === "") {
      elements.push(<View key={`br-${i}`} style={[{ height: 8 }, style?.paragraph]} />);
      i++;
      continue;
    }

    // Regular text
    elements.push(
      <Text key={`p-${i}`} selectable={selectable} style={baseStyle}>
        {renderInline(parseInline(line), baseStyle, style, selectable)}
      </Text>
    );
    i++;
  }

  return <View>{elements}</View>;
}
