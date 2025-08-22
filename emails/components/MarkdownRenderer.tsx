import { Text } from "@react-email/components";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown-like content renderer for email templates
 */
export const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  if (!content) {
    return null;
  }

  const lines = content.split("\n").filter((line) => line.trim());

  return (
    <>
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <Text key={`h3-${i}`} className="font-semibold mt-3 mb-1 text-sm">
              {line.replace("### ", "")}
            </Text>
          );
        }

        // Bullet points
        if (line.startsWith("- ")) {
          return (
            <Text key={`li-${i}`} className="ml-4 mb-1 text-sm">
              • {line.replace("- ", "")}
            </Text>
          );
        }

        // Regular paragraphs
        if (line.trim()) {
          return (
            <Text key={`p-${i}`} className={`mb-2 text-sm ${className || ""}`}>
              {line}
            </Text>
          );
        }

        return null;
      })}
    </>
  );
};
