import { formatChatText } from "@aegis/shared";

interface ChatTextProps {
  content: string;
}

export function ChatText({ content }: ChatTextProps) {
  const blocks = formatChatText(content);

  return (
    <div className="chat-text">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h4 key={index}>{block.text}</h4>;
        }
        if (block.type === "bullet") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "numbered") {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} className="chat-code-block">
              {block.text}
            </pre>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
