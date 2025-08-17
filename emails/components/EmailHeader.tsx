import { Heading, Section, Text } from "@react-email/components";

interface EmailHeaderProps {
  title?: string;
  subtitle?: string;
}

export const EmailHeader = ({ title = "AI Digest", subtitle }: EmailHeaderProps) => {
  return (
    <Section className="text-center mb-8">
      <Heading className="my-0 text-3xl font-bold">{title}</Heading>
      {subtitle && <Text className="text-sm text-gray-600 mt-2">{subtitle}</Text>}
    </Section>
  );
};

/**
 * Get week description for the digest
 */
export const getWeekDescription = () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const formatDate = (date: Date) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  return `${formatDate(weekAgo)} - ${formatDate(now)}`;
};
