import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type { DigestOutput } from "../functions/lib/schemas/digest";
import type { Summary } from "../functions/lib/types";

interface WeeklyDigestEmailProps {
  summary: Summary;
}

export const WeeklyDigestEmail = ({ summary }: WeeklyDigestEmailProps) => {
  const digest = summary.digest as DigestOutput;

  if (!digest || typeof digest === "string") {
    return <FallbackEmail summary={summary} />;
  }

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Html>
      <Head />
      <Preview>{digest.headline || "Your Weekly AI Digest"}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: "#0F172A",
                primary: "#3B82F6",
                secondary: "#8B5CF6",
                accent: "#EC4899",
                success: "#10B981",
                warning: "#F59E0B",
                danger: "#EF4444",
                muted: "#64748B",
                background: "#F8FAFC",
                card: "#FFFFFF",
                border: "#E2E8F0",
              },
              fontFamily: {
                sans: [
                  "-apple-system",
                  "BlinkMacSystemFont",
                  '"Segoe UI"',
                  "Roboto",
                  '"Helvetica Neue"',
                  "Arial",
                  "sans-serif",
                ],
              },
            },
          },
        }}
      >
        <Body className="bg-background font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            {/* Header */}
            <Section className="mb-8">
              <div className="bg-gradient-to-r from-primary to-secondary rounded-t-2xl p-8 text-center">
                <Heading className="text-white text-4xl font-bold m-0 mb-2">AI Weekly</Heading>
                <Text className="text-white/90 text-sm m-0">{currentDate}</Text>
              </div>
              <div className="bg-card rounded-b-2xl shadow-lg p-6 -mt-4">
                <Heading as="h2" className="text-2xl font-bold text-brand mb-2">
                  {digest.headline}
                </Heading>
                <Text className="text-muted text-base leading-relaxed">{digest.summary}</Text>
              </div>
            </Section>

            {/* Competitive Intelligence */}
            {digest.competitiveIntel && digest.competitiveIntel.length > 0 && (
              <Section className="mb-10">
                <Heading as="h2" className="text-xl font-bold text-brand mb-4">
                  🎯 Competitive Intel
                </Heading>
                {digest.competitiveIntel.map((intel, i) => (
                  <div
                    key={i}
                    className="bg-warning/10 p-4 rounded-lg mb-3 border-l-4 border-warning"
                  >
                    <Text className="font-semibold text-brand mb-2">{intel.insight}</Text>
                    <Text className="text-sm text-muted mb-1">
                      Players: {intel.players.join(", ")}
                    </Text>
                    <Text className="text-sm italic text-brand">→ {intel.implication}</Text>
                  </div>
                ))}
              </Section>
            )}

            {/* Key Themes */}
            {digest.keyThemes && digest.keyThemes.length > 0 && (
              <Section className="mb-8">
                <div className="flex flex-wrap gap-2 justify-center">
                  {digest.keyThemes.map((theme, i) => (
                    <span
                      key={i}
                      className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* What Actually Happened */}
            {digest.whatHappened && digest.whatHappened.length > 0 && (
              <Section className="mb-10">
                <div className="flex items-center mb-4">
                  <div className="bg-primary/10 p-2 rounded-lg mr-3">
                    <Text className="text-2xl m-0">📰</Text>
                  </div>
                  <Heading as="h2" className="text-xl font-bold text-brand m-0">
                    What Actually Happened
                  </Heading>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  {Array.isArray(digest.whatHappened) && digest.whatHappened.map((item, i) => (
                    <div
                      key={i}
                      className={`${
                        i < digest.whatHappened.length - 1 ? "mb-4 pb-4 border-b border-border" : ""
                      }`}
                    >
                      <Text className="font-semibold text-brand text-base mb-1">{item.title}</Text>
                      <Text className="text-sm text-primary mb-2">
                        {item.source}
                        {item.category && (
                          <span className="ml-2 text-xs bg-primary/10 px-2 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                      </Text>
                      <Text className="text-muted text-sm leading-relaxed">{item.description}</Text>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Takeaways */}
            {digest.takeaways && digest.takeaways.length > 0 && (
              <Section className="mb-10">
                <div className="flex items-center mb-4">
                  <div className="bg-success/10 p-2 rounded-lg mr-3">
                    <Text className="text-2xl m-0">🎯</Text>
                  </div>
                  <Heading as="h2" className="text-xl font-bold text-brand m-0">
                    TL;DR for You
                  </Heading>
                </div>
                <Row>
                  {Array.isArray(digest.takeaways) && digest.takeaways.map((takeaway, i) => {
                    const colors = {
                      technical: {
                        bg: "bg-primary/10",
                        text: "text-primary",
                        icon: "⚙️",
                      },
                      business: {
                        bg: "bg-success/10",
                        text: "text-success",
                        icon: "💼",
                      },
                      risk: {
                        bg: "bg-danger/10",
                        text: "text-danger",
                        icon: "⚠️",
                      },
                    };
                    const style = colors[takeaway.category];

                    return (
                      <Column key={i} className="w-full mb-4">
                        <div className={`${style.bg} rounded-xl p-4`}>
                          <div className="flex items-start">
                            <Text className="text-xl mr-3 mt-1">{style.icon}</Text>
                            <div className="flex-1">
                              <Text
                                className={`${style.text} font-semibold text-sm uppercase tracking-wide mb-1`}
                              >
                                {takeaway.category}
                              </Text>
                              <Text className="font-semibold text-brand mb-2">
                                {takeaway.title}
                              </Text>
                              <Text className="text-muted text-sm leading-relaxed">
                                {takeaway.description}
                              </Text>
                              {takeaway.actionable && (
                                <span className="inline-block mt-2 bg-white px-2 py-1 rounded text-xs font-medium text-success">
                                  Action Required
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Column>
                    );
                  })}
                </Row>
              </Section>
            )}

            {/* Product Plays */}
            {digest.productPlays && digest.productPlays.length > 0 && (
              <Section className="mb-10">
                <div className="flex items-center mb-4">
                  <div className="bg-secondary/10 p-2 rounded-lg mr-3">
                    <Text className="text-2xl m-0">🚀</Text>
                  </div>
                  <Heading as="h2" className="text-xl font-bold text-brand m-0">
                    Product Plays for Your Apps
                  </Heading>
                </div>
                <div>
                  {digest.productPlays.map((play, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-r from-secondary/5 to-primary/5 rounded-xl p-5 border border-secondary/20 mb-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Text className="font-bold text-lg text-brand m-0">{play.appName}</Text>
                        <div className="flex gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              play.effort === "quick-win"
                                ? "bg-success/10 text-success"
                                : play.effort === "1-2-days"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-primary/10 text-primary"
                            }`}
                          >
                            {play.effort}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              play.impact === "high"
                                ? "bg-accent/10 text-accent"
                                : play.impact === "medium"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted/10 text-muted"
                            }`}
                          >
                            {play.impact} impact
                          </span>
                        </div>
                      </div>
                      <Text className="font-semibold text-secondary mb-2">{play.feature}</Text>
                      <Text className="text-muted text-sm leading-relaxed">{play.description}</Text>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Role-Based Plays */}
            {digest.rolePlays && digest.rolePlays.length > 0 && (
              <Section className="mb-10">
                <div className="flex items-center mb-4">
                  <div className="bg-warning/10 p-2 rounded-lg mr-3">
                    <Text className="text-2xl m-0">💼</Text>
                  </div>
                  <Heading as="h2" className="text-xl font-bold text-brand m-0">
                    Role-Based Plays
                  </Heading>
                </div>
                <div>
                  {digest.rolePlays.map((role, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-5 mb-4">
                      <Text className="font-bold text-lg text-brand mb-3">{role.role}</Text>
                      {role.plays.map((play, j) => (
                        <div
                          key={j}
                          className={`${
                            j < role.plays.length - 1 ? "mb-3 pb-3 border-b border-border" : ""
                          }`}
                        >
                          <Text className="font-semibold text-primary text-sm mb-1">
                            {play.title}
                          </Text>
                          <Text className="text-muted text-sm leading-relaxed">
                            {play.description}
                          </Text>
                          {play.timeframe && (
                            <Text className="text-xs text-warning mt-1">⏰ {play.timeframe}</Text>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Tools & Opportunities */}
            {digest.tools && digest.tools.length > 0 && (
              <Section className="mb-10">
                <div className="flex items-center mb-4">
                  <div className="bg-accent/10 p-2 rounded-lg mr-3">
                    <Text className="text-2xl m-0">🛠️</Text>
                  </div>
                  <Heading as="h2" className="text-xl font-bold text-brand m-0">
                    Tools & Opportunities
                  </Heading>
                </div>
                <div className="grid gap-3">
                  {digest.tools.map((tool, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Text className="font-semibold text-brand mb-1">
                            {tool.name}
                            <span className="ml-2 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                              {tool.category}
                            </span>
                          </Text>
                          <Text className="text-muted text-sm mb-2">{tool.description}</Text>
                          <Text className="text-primary text-sm font-medium">
                            💡 {tool.useCase}
                          </Text>
                        </div>
                        {tool.link && (
                          <Button
                            href={tool.link}
                            className="bg-primary text-white px-3 py-1 rounded text-xs ml-4"
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Short Message */}
            {digest.shortMessage && (
              <Section className="mb-10">
                <div className="bg-gradient-to-r from-primary to-secondary p-6 rounded-xl">
                  <div className="flex items-center mb-3">
                    <Text className="text-2xl mr-3">📱</Text>
                    <Text className="text-white font-bold text-lg">Share This Week</Text>
                  </div>
                  <div className="bg-white/95 rounded-lg p-4">
                    <Text className="text-brand font-mono text-sm whitespace-pre-wrap leading-relaxed">
                      {digest.shortMessage}
                    </Text>
                  </div>
                </div>
              </Section>
            )}

            <Hr className="border-border my-8" />

            {/* Email Sources */}
            {summary.items && summary.items.length > 0 && (
              <Section className="mb-8">
                <details>
                  <summary className="cursor-pointer">
                    <Text className="inline font-semibold text-muted text-sm">
                      📧 View {summary.items.length} source emails
                    </Text>
                  </summary>
                  <div className="mt-4 bg-background rounded-lg p-4">
                    {summary.items.map((item, i) => (
                      <div
                        key={i}
                        className={`${
                          i < summary.items.length - 1 ? "mb-2 pb-2 border-b border-border" : ""
                        }`}
                      >
                        {item.gmailLink ? (
                          <Link
                            href={item.gmailLink}
                            className="text-primary text-xs"
                            style={{ textDecoration: "underline" }}
                          >
                            {item.subject}
                          </Link>
                        ) : (
                          <Text className="text-muted text-xs">{item.subject}</Text>
                        )}
                        <Text className="text-muted text-xs">
                          {item.sender}
                          {item.date && ` • ${new Date(item.date).toLocaleDateString()}`}
                        </Text>
                      </div>
                    ))}
                  </div>
                </details>
              </Section>
            )}

            {/* Footer */}
            <Section className="text-center">
              <Text className="text-xs text-muted">
                AI Weekly Digest • Generated{" "}
                {new Date(summary.generatedAt || Date.now()).toLocaleString()}
              </Text>
              <Text className="text-xs text-muted mt-2">
                <Link href="mailto:digest@bhekani.com" className="text-primary">
                  Contact
                </Link>
                {" • "}
                <Link href="https://bhekani.com" className="text-primary">
                  Blog
                </Link>
                {" • "}
                <Link href="#" className="text-muted">
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

// Fallback for old string-based digest format
function FallbackEmail({ summary }: { summary: Summary }) {
  const digestText = typeof summary.digest === "string" ? summary.digest : "";

  return (
    <Html>
      <Head />
      <Preview>Weekly AI Digest</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <Heading>Weekly AI Digest</Heading>
          <Text style={{ whiteSpace: "pre-wrap" }}>{digestText}</Text>
          <Hr />
          <Text style={{ fontSize: "12px", color: "#666" }}>
            Generated {new Date(summary.generatedAt || Date.now()).toLocaleString()}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyDigestEmail;
