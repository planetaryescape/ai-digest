import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type { Summary } from "../functions/lib/types";

interface WeeklyDigestEmailProps {
  summary: Summary;
}

export const WeeklyDigestEmail = ({ summary }: WeeklyDigestEmailProps) => {
  // Parse markdown sections from the digest
  const digestString = typeof summary.digest === 'string' ? summary.digest : JSON.stringify(summary.digest);
  const sections = parseDigestSections(digestString);

  return (
    <Html>
      <Head />
      <Preview>AI Digest - {getWeekDescription()}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: "hsl(228 73% 13%)",
                offwhite: "hsl(210 36% 96%)",
                accent: "hsl(217 91% 60%)",
                success: "hsl(142 71% 45%)",
                warning: "hsl(38 92% 50%)",
              },
              spacing: {
                0: "0px",
                20: "20px",
                45: "45px",
              },
            },
          },
        }}
      >
        <Body className="bg-offwhite font-sans text-base text-brand">
          <Container className="p-45 bg-[hsl(210, 36%, 96%)]">
            <Section className="text-center mb-8">
              <Heading className="my-0 text-3xl font-bold">AI Digest</Heading>
              <Text className="text-sm text-gray-600 mt-2">{getWeekDescription()}</Text>
            </Section>

            {/* What Actually Happened */}
            {sections.whatHappened && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  📰 What Actually Happened
                </Heading>
                <div className="bg-white p-4 rounded-lg">
                  <MarkdownContent content={sections.whatHappened} />
                </div>
              </Section>
            )}

            {/* TL;DR for You */}
            {sections.tldr && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  🎯 TL;DR for You
                </Heading>
                <div className="bg-white p-4 rounded-lg border-l-4 border-accent">
                  <MarkdownContent content={sections.tldr} />
                </div>
              </Section>
            )}

            {/* Role-Based Plays */}
            {sections.roleBasedPlays && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  💼 Role-Based Plays
                </Heading>
                <div className="bg-white p-4 rounded-lg">
                  <MarkdownContent content={sections.roleBasedPlays} />
                </div>
              </Section>
            )}

            {/* Product Plays */}
            {sections.productPlays && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  🚀 Product Plays for Your Apps
                </Heading>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-accent">
                  <MarkdownContent content={sections.productPlays} />
                </div>
              </Section>
            )}

            {/* Tools & Opportunities */}
            {sections.tools && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  🛠️ Tools & Opportunities
                </Heading>
                <div className="bg-white p-4 rounded-lg">
                  <MarkdownContent content={sections.tools} />
                </div>
              </Section>
            )}

            {/* Postable Message */}
            {summary.message && (
              <Section className="mb-8">
                <Heading as="h2" className="text-xl font-semibold mb-4 text-brand">
                  📱 One Short Message
                </Heading>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                  <Text className="font-mono text-sm whitespace-pre-wrap">{summary.message}</Text>
                </div>
              </Section>
            )}

            <Hr className="my-8" />

            {/* Sources */}
            <Section>
              <Heading as="h2" className="text-lg font-semibold mb-4 text-brand">
                📧 Email Sources
              </Heading>
              <div className="bg-gray-50 p-4 rounded-lg">
                <Text className="text-sm text-gray-600 mb-3">
                  This digest was generated from {summary.items.length} AI newsletters. Click any email below to view it in Gmail:
                </Text>
                <div>
                  {summary.items.map((item, i) => (
                    <div key={i} className={i < summary.items.length - 1 ? "border-b border-gray-200 pb-2 mb-2" : "pb-2"}>
                      <Text className="text-xs mb-1">
                        {item.gmailLink ? (
                          <Link 
                            href={item.gmailLink} 
                            className="text-accent font-medium"
                            style={{ textDecoration: 'underline' }}
                          >
                            {item.subject}
                          </Link>
                        ) : (
                          <span className="font-medium">{item.subject}</span>
                        )}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        From: {item.sender}
                        {item.date && ` • ${new Date(item.date).toLocaleDateString()}`}
                      </Text>
                    </div>
                  ))}
                </div>
                {summary.items.length > 10 && (
                  <Text className="text-xs text-gray-500 italic mt-3">
                    Note: All {summary.items.length} source emails have been archived in Gmail for your reference.
                  </Text>
                )}
              </div>
            </Section>

            <Hr className="my-8" />

            {/* Footer */}
            <Section className="text-center">
              <Text className="text-xs text-gray-500">
                Generated {new Date(summary.generatedAt || Date.now()).toLocaleString()}
                <br />
                <Link href="mailto:digest@bhekani.com" className="text-accent">
                  Contact
                </Link>
                {" | "}
                <Link href="https://bhekani.com" className="text-accent">
                  Blog
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

// Helper component to render markdown-style content
function MarkdownContent({ content }: { content: string }) {
  // Simple markdown to React conversion
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <Text key={i} className="font-semibold mt-3 mb-1 text-sm">
              {line.replace("### ", "")}
            </Text>
          );
        }
        // Bullets
        if (line.startsWith("- ")) {
          return (
            <Text key={i} className="ml-4 mb-1 text-sm">
              • {line.replace("- ", "")}
            </Text>
          );
        }
        // Regular text
        if (line.trim()) {
          return (
            <Text key={i} className="mb-2 text-sm">
              {line}
            </Text>
          );
        }
        return null;
      })}
    </>
  );
}

// Parse the digest into sections
function parseDigestSections(digest: string) {
  const sections: any = {};

  // Extract each section using regex
  const whatHappenedMatch = digest.match(/## What Actually Happened\s*\n([\s\S]*?)(?=\n##|$)/);
  if (whatHappenedMatch) {
    sections.whatHappened = whatHappenedMatch[1].trim();
  }

  const tldrMatch = digest.match(/## TL;DR for You\s*\n([\s\S]*?)(?=\n##|$)/);
  if (tldrMatch) {
    sections.tldr = tldrMatch[1].trim();
  }

  const roleMatch = digest.match(/## Role-Based Plays\s*\n([\s\S]*?)(?=\n##|$)/);
  if (roleMatch) {
    sections.roleBasedPlays = roleMatch[1].trim();
  }

  const productMatch = digest.match(/## Product Plays for Your Apps\s*\n([\s\S]*?)(?=\n##|$)/);
  if (productMatch) {
    sections.productPlays = productMatch[1].trim();
  }

  const toolsMatch = digest.match(/## Tools & Opportunities\s*\n([\s\S]*?)(?=\n##|$)/);
  if (toolsMatch) {
    sections.tools = toolsMatch[1].trim();
  }

  return sections;
}

// Get week description
function getWeekDescription(): string {
  const now = new Date();
  const weekNumber = Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 +
      new Date(now.getFullYear(), 0, 1).getDay() +
      1) /
      7
  );
  return `Week ${weekNumber}, ${now.getFullYear()}`;
}

export default WeeklyDigestEmail;
