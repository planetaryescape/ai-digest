import { Text } from "@react-email/components";

interface Tool {
  name: string;
  description: string;
  link?: string;
}

interface ToolCardProps {
  tool: Tool;
  className?: string;
}

export const ToolCard = ({ tool, className = "mb-3" }: ToolCardProps) => {
  return (
    <div className={`bg-gray-50 p-3 rounded ${className}`}>
      <Text className="font-semibold text-sm mb-1">
        {tool.link ? (
          <a href={tool.link} className="text-blue-600 no-underline">
            {tool.name}
          </a>
        ) : (
          tool.name
        )}
      </Text>
      <Text className="text-xs text-gray-600 m-0">{tool.description}</Text>
    </div>
  );
};

interface ToolListProps {
  tools: Tool[];
  className?: string;
}

export const ToolList = ({ tools, className }: ToolListProps) => {
  if (!tools || tools.length === 0) return null;

  return (
    <div className={className}>
      {tools.map((tool, index) => (
        <ToolCard key={`${tool.name}-${index}`} tool={tool} />
      ))}
    </div>
  );
};
