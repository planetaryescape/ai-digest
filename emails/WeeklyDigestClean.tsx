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

  return (
    <Html>
      <Head />
      <Preview>{digest.headline || "Your Weekly AI Digest"}</Preview>
      <Tailwind>
        <Body
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            margin: 0,
            padding: 0,
            backgroundColor: "#ffffff",
          }}
        >
          <Container
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              padding: "20px",
            }}
          >
            {/* Header */}
            <Section style={{ marginBottom: "32px" }}>
              <Text
                style={{
                  fontSize: "12px",
                  color: "#666",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                AI DIGEST • WEEK {getWeekNumber()}
              </Text>
              <Heading
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#000",
                  margin: "0 0 12px 0",
                  lineHeight: "1.2",
                }}
              >
                {digest.headline}
              </Heading>
              <Text
                style={{
                  fontSize: "16px",
                  color: "#333",
                  margin: "0",
                  lineHeight: "1.5",
                }}
              >
                {digest.summary}
              </Text>
            </Section>

            {/* What Actually Happened */}
            {digest.whatHappened && digest.whatHappened.length > 0 && (
              <Section style={{ marginBottom: "32px" }}>
                <Heading
                  as="h2"
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#000",
                    margin: "0 0 16px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  What Happened
                </Heading>
                {digest.whatHappened.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "16px",
                      paddingBottom: "16px",
                      borderBottom:
                        i < digest.whatHappened.length - 1 ? "1px solid #e5e5e5" : "none",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#000",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        margin: "0 0 8px 0",
                      }}
                    >
                      {item.source} {item.category && `• ${item.category}`}
                    </Text>
                    <Text
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        margin: "0",
                        lineHeight: "1.5",
                      }}
                    >
                      {item.description}
                    </Text>
                  </div>
                ))}
              </Section>
            )}

            {/* Takeaways */}
            {digest.takeaways && digest.takeaways.length > 0 && (
              <Section style={{ marginBottom: "32px" }}>
                <Heading
                  as="h2"
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#000",
                    margin: "0 0 16px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Do This
                </Heading>
                {digest.takeaways.map((takeaway, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "12px",
                      padding: "12px",
                      backgroundColor: takeaway.actionable ? "#fff3cd" : "#f8f9fa",
                      borderLeft: `3px solid ${
                        takeaway.category === "technical"
                          ? "#0066cc"
                          : takeaway.category === "business"
                            ? "#28a745"
                            : "#dc3545"
                      }`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color:
                          takeaway.category === "technical"
                            ? "#0066cc"
                            : takeaway.category === "business"
                              ? "#28a745"
                              : "#dc3545",
                        margin: "0 0 4px 0",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {takeaway.category}
                    </Text>
                    <Text
                      style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "#000",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {takeaway.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        margin: "0",
                        lineHeight: "1.4",
                      }}
                    >
                      {takeaway.description}
                    </Text>
                  </div>
                ))}
              </Section>
            )}

            {/* Product Plays */}
            {digest.productPlays && digest.productPlays.length > 0 && (
              <Section style={{ marginBottom: "32px" }}>
                <Heading
                  as="h2"
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#000",
                    margin: "0 0 16px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Ship This Week
                </Heading>
                {digest.productPlays.map((play, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "16px",
                      padding: "12px",
                      border: "1px solid #e5e5e5",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                          color: "#000",
                          margin: "0",
                        }}
                      >
                        {play.appName}
                      </Text>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            backgroundColor:
                              play.effort === "quick-win"
                                ? "#d4edda"
                                : play.effort === "1-2-days"
                                  ? "#fff3cd"
                                  : "#f8d7da",
                            color:
                              play.effort === "quick-win"
                                ? "#155724"
                                : play.effort === "1-2-days"
                                  ? "#856404"
                                  : "#721c24",
                            borderRadius: "3px",
                          }}
                        >
                          {play.effort}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            backgroundColor:
                              play.impact === "high"
                                ? "#d1ecf1"
                                : play.impact === "medium"
                                  ? "#f8f9fa"
                                  : "#e2e3e5",
                            color:
                              play.impact === "high"
                                ? "#0c5460"
                                : play.impact === "medium"
                                  ? "#383d41"
                                  : "#383d41",
                            borderRadius: "3px",
                          }}
                        >
                          {play.impact}
                        </span>
                      </div>
                    </div>
                    <Text
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#333",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {play.feature}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: "#666",
                        margin: "0",
                        lineHeight: "1.4",
                      }}
                    >
                      {play.description}
                    </Text>
                  </div>
                ))}
              </Section>
            )}

            {/* Tools */}
            {digest.tools && digest.tools.length > 0 && (
              <Section style={{ marginBottom: "32px" }}>
                <Heading
                  as="h2"
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#000",
                    margin: "0 0 16px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  New Tools
                </Heading>
                {digest.tools.map((tool, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "12px",
                      paddingBottom: "12px",
                      borderBottom: i < digest.tools.length - 1 ? "1px solid #e5e5e5" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                          color: "#000",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {tool.name}
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            fontWeight: "400",
                            marginLeft: "8px",
                          }}
                        >
                          {tool.category}
                        </span>
                      </Text>
                      {tool.link && (
                        <Link
                          href={tool.link}
                          style={{
                            fontSize: "12px",
                            color: "#0066cc",
                            textDecoration: "none",
                          }}
                        >
                          →
                        </Link>
                      )}
                    </div>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: "#333",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {tool.description}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: "#666",
                        margin: "0",
                        fontStyle: "italic",
                      }}
                    >
                      Use: {tool.useCase}
                    </Text>
                  </div>
                ))}
              </Section>
            )}

            {/* Role Plays */}
            {digest.rolePlays && digest.rolePlays.length > 0 && (
              <Section style={{ marginBottom: "32px" }}>
                <Heading
                  as="h2"
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#000",
                    margin: "0 0 16px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Role Plays
                </Heading>
                {digest.rolePlays.map((role, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "16px",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#000",
                        margin: "0 0 8px 0",
                      }}
                    >
                      {role.role}
                    </Text>
                    {role.plays.map((play, j) => (
                      <div
                        key={j}
                        style={{
                          marginBottom: "8px",
                          paddingLeft: "16px",
                          borderLeft: "2px solid #e5e5e5",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "#333",
                            margin: "0 0 2px 0",
                          }}
                        >
                          {play.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: "13px",
                            color: "#666",
                            margin: "0",
                          }}
                        >
                          {play.description}
                          {play.timeframe && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#dc3545",
                                marginLeft: "8px",
                              }}
                            >
                              [{play.timeframe}]
                            </span>
                          )}
                        </Text>
                      </div>
                    ))}
                  </div>
                ))}
              </Section>
            )}

            {/* Short Message */}
            {digest.shortMessage && (
              <Section
                style={{
                  marginBottom: "32px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                }}
              >
                <Text
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#666",
                    margin: "0 0 8px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Copy & Paste
                </Text>
                <Text
                  style={{
                    fontSize: "14px",
                    color: "#000",
                    margin: "0",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.4",
                  }}
                >
                  {digest.shortMessage}
                </Text>
              </Section>
            )}

            <Hr
              style={{
                border: "none",
                borderTop: "1px solid #e5e5e5",
                margin: "32px 0",
              }}
            />

            {/* Key Themes */}
            {digest.keyThemes && digest.keyThemes.length > 0 && (
              <Section style={{ marginBottom: "24px" }}>
                <Text
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#666",
                    margin: "0 0 8px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Themes
                </Text>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {digest.keyThemes.map((theme, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "12px",
                        padding: "4px 8px",
                        backgroundColor: "#e9ecef",
                        color: "#495057",
                        borderRadius: "3px",
                      }}
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Email Sources - Collapsed by default */}
            {summary.items && summary.items.length > 0 && (
              <Section style={{ marginBottom: "24px" }}>
                <details>
                  <summary
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      cursor: "pointer",
                      marginBottom: "12px",
                    }}
                  >
                    {summary.items.length} source emails
                  </summary>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#999",
                      paddingTop: "8px",
                    }}
                  >
                    {summary.items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: "4px",
                        }}
                      >
                        {item.gmailLink ? (
                          <Link
                            href={item.gmailLink}
                            style={{
                              color: "#666",
                              textDecoration: "none",
                            }}
                          >
                            {item.subject}
                          </Link>
                        ) : (
                          <span>{item.subject}</span>
                        )}
                        <span style={{ color: "#999" }}> — {item.sender}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </Section>
            )}

            {/* Footer */}
            <Section style={{ textAlign: "center" }}>
              <Text
                style={{
                  fontSize: "11px",
                  color: "#999",
                  margin: "0",
                }}
              >
                Generated {new Date(summary.generatedAt || Date.now()).toLocaleString()}
                <br />
                <Link
                  href="mailto:digest@bhekani.com"
                  style={{
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
                  Contact
                </Link>
                {" • "}
                <Link
                  href="https://bhekani.com"
                  style={{
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
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

// Helper function to get week number
function getWeekNumber(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNumber = Math.floor(diff / oneWeek) + 1;
  return `${weekNumber}/${now.getFullYear()}`;
}

// Fallback for old format
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
