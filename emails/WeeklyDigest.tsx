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
import { DigestSection } from "./components/DigestSection";
import { EmailFooter } from "./components/EmailFooter";
import { EmailHeader, getWeekDescription } from "./components/EmailHeader";
import { MarkdownRenderer } from "./components/MarkdownRenderer";

interface WeeklyDigestEmailProps {
  summary: Summary;
}

export const WeeklyDigestEmail = ({ summary }: WeeklyDigestEmailProps) => {
  // Parse markdown sections from the digest
  const digestString =
    typeof summary.digest === "string" ? summary.digest : JSON.stringify(summary.digest);
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
            <EmailHeader title="AI Digest" subtitle={getWeekDescription()} />

            {/* What Actually Happened */}
            {sections.whatHappened && (
              <DigestSection title="What Actually Happened" icon="📰">
                <MarkdownRenderer content={sections.whatHappened} />
              </DigestSection>
            )}

            {/* TL;DR for You */}
            {sections.tldr && (
              <DigestSection title="TL;DR for You" icon="🎯" borderColor="border-accent">
                <MarkdownRenderer content={sections.tldr} />
              </DigestSection>
            )}

            {/* Role-Based Plays */}
            {sections.roleBasedPlays && (
              <DigestSection title="Role-Based Plays" icon="💼">
                <MarkdownRenderer content={sections.roleBasedPlays} />
              </DigestSection>
            )}

            {/* Product Plays */}
            {sections.productPlays && (
              <DigestSection title="Product Plays for Your Apps" icon="🚀">
                <MarkdownRenderer content={sections.productPlays} />
              </DigestSection>
            )}

            {/* Tools & Opportunities */}
            {sections.tools && (
              <DigestSection title="Tools & Opportunities" icon="🛠️">
                <MarkdownRenderer content={sections.tools} />
              </DigestSection>
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
                  This digest was generated from {summary.items.length} AI newsletters. Click any
                  email below to view it in Gmail:
                </Text>
                <div>
                  {summary.items.map((item, i) => (
                    <div
                      key={i}
                      className={
                        i < summary.items.length - 1 ? "border-b border-gray-200 pb-2 mb-2" : "pb-2"
                      }
                    >
                      <Text className="text-xs mb-1">
                        {item.gmailLink ? (
                          <Link
                            href={item.gmailLink}
                            className="text-accent font-medium"
                            style={{ textDecoration: "underline" }}
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
                    Note: All {summary.items.length} source emails have been archived in Gmail for
                    your reference.
                  </Text>
                )}
              </div>
            </Section>

            <Hr className="my-8" />

            <EmailFooter />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

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

export default WeeklyDigestEmail;
