import { Heading, Section } from "@react-email/components";
import type { ReactNode } from "react";

interface DigestSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  borderColor?: string;
}

export const DigestSection = ({
  title,
  icon,
  children,
  className = "mb-8",
  borderColor,
}: DigestSectionProps) => {
  const contentClassName = borderColor
    ? `bg-white p-4 rounded-lg border-l-4 ${borderColor}`
    : "bg-white p-4 rounded-lg";

  return (
    <Section className={className}>
      <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
        {icon && `${icon} `}
        {title}
      </Heading>
      <div className={contentClassName}>{children}</div>
    </Section>
  );
};
