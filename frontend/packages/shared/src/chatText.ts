export type ChatTextBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "code"; text: string };

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>+\s?/, "")
    .trim();
}

function pushParagraph(blocks: ChatTextBlock[], lines: string[]) {
  if (lines.length === 0) {
    return;
  }
  const text = cleanInlineMarkdown(lines.join("\n"));
  if (text) {
    blocks.push({ type: "paragraph", text });
  }
  lines.length = 0;
}

function pushList(blocks: ChatTextBlock[], type: "bullet" | "numbered", items: string[]) {
  if (items.length === 0) {
    return;
  }
  blocks.push({ type, items: items.map(cleanInlineMarkdown).filter(Boolean) });
  items.length = 0;
}

export function formatChatText(content: string): ChatTextBlock[] {
  const blocks: ChatTextBlock[] = [];
  const paragraphLines: string[] = [];
  const bulletItems: string[] = [];
  const numberedItems: string[] = [];
  const codeLines: string[] = [];
  let inCodeBlock = false;

  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, "bullet", bulletItems);
      pushList(blocks, "numbered", numberedItems);
      if (inCodeBlock) {
        blocks.push({ type: "code", text: codeLines.join("\n").trimEnd() });
        codeLines.length = 0;
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, "bullet", bulletItems);
      pushList(blocks, "numbered", numberedItems);
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, "bullet", bulletItems);
      pushList(blocks, "numbered", numberedItems);
      blocks.push({ type: "heading", text: cleanInlineMarkdown(headingMatch[1]) });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, "numbered", numberedItems);
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, "bullet", bulletItems);
      numberedItems.push(numberedMatch[1]);
      continue;
    }

    pushList(blocks, "bullet", bulletItems);
    pushList(blocks, "numbered", numberedItems);
    paragraphLines.push(trimmed);
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n").trimEnd() });
  }
  pushParagraph(blocks, paragraphLines);
  pushList(blocks, "bullet", bulletItems);
  pushList(blocks, "numbered", numberedItems);

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: content }];
}
