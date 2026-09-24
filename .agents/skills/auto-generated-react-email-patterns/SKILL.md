---
name: auto-generated-react-email-patterns
description: React Email + Tailwind patterns for this project. Component structure, brand colors, conditional sections, fallback templates. Triggers on "email template", "react-email", "digest email", "tailwind email".
---

# React Email Patterns

All email templates use React Email with Tailwind CSS. Located in `emails/` directory.

## Template Structure

Main template with fallback for legacy format:

```typescript
// From emails/WeeklyDigestRedesigned.tsx
export const WeeklyDigestEmail = ({ summary }: WeeklyDigestEmailProps) => {
  const digest = summary.digest as DigestOutput;

  // Always check for legacy string format
  if (!digest || typeof digest === "string") {
    return <FallbackEmail summary={summary} />;
  }

  return (
    <Html>
      <Head />
      <Preview>{digest.headline || "Your Weekly AI Digest"}</Preview>
      <Tailwind config={{...}}>
        <Body className="bg-background font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            {/* sections */}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Tailwind Configuration

Embedded Tailwind config in email matches frontend brand colors:

```typescript
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
```

**Critical:** Config must be embedded in component. Cannot import from external file.

## Gradient Header Pattern

Header with gradient + white text, rounded card below:

```typescript
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
```

Negative margin (`-mt-4`) creates overlap effect.

## Conditional Section Rendering

Only render sections if data exists:

```typescript
{digest.competitiveIntel && digest.competitiveIntel.length > 0 && (
  <Section className="mb-10">
    <Heading as="h2" className="text-xl font-bold text-brand mb-4">
      🎯 Competitive Intel
    </Heading>
    {digest.competitiveIntel.map((intel, i) => (
      <div key={i} className="bg-warning/10 p-4 rounded-lg mb-3 border-l-4 border-warning">
        <Text className="font-semibold text-brand mb-2">{intel.insight}</Text>
        <Text className="text-sm text-muted mb-1">
          Players: {intel.players.join(", ")}
        </Text>
        <Text className="text-sm italic text-brand">→ {intel.implication}</Text>
      </div>
    ))}
  </Section>
)}
```

Always check both existence and length for arrays.

## Icon + Content Card Pattern

Emoji icon in colored box + heading in row:

```typescript
<div className="flex items-center mb-4">
  <div className="bg-primary/10 p-2 rounded-lg mr-3">
    <Text className="text-2xl m-0">📰</Text>
  </div>
  <Heading as="h2" className="text-xl font-bold text-brand m-0">
    What Actually Happened
  </Heading>
</div>
<div className="bg-card rounded-xl border border-border p-6">
  {/* content */}
</div>
```

Pattern: `bg-{color}/10` for tinted background, `border-{color}` for accent.

## Category-Based Styling

Map categories to colors dynamically:

```typescript
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
  <div className={`${style.bg} rounded-xl p-4`}>
    <div className="flex items-start">
      <Text className="text-xl mr-3 mt-1">{style.icon}</Text>
      <div className="flex-1">
        <Text className={`${style.text} font-semibold text-sm uppercase tracking-wide mb-1`}>
          {takeaway.category}
        </Text>
        {/* content */}
      </div>
    </div>
  </div>
);
```

## Conditional Badges

Show badges based on data:

```typescript
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
```

## Divider Between Items

Only add border to non-last items:

```typescript
{Array.isArray(digest.whatHappened) &&
  digest.whatHappened.map((item, i) => (
    <div
      key={i}
      className={`${
        i < digest.whatHappened.length - 1
          ? "mb-4 pb-4 border-b border-border"
          : ""
      }`}
    >
      {/* content */}
    </div>
  ))}
```

## Collapsible Section

Use HTML `<details>` for email-safe accordions:

```typescript
<details>
  <summary className="cursor-pointer">
    <Text className="inline font-semibold text-muted text-sm">
      📧 View {summary.items.length} source emails
    </Text>
  </summary>
  <div className="mt-4 bg-background rounded-lg p-4">
    {summary.items.map((item, i) => (
      // items
    ))}
  </div>
</details>
```

## Fallback Template

Legacy format for string-based digest:

```typescript
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
```

Use inline `style` prop (not Tailwind) for fallback. `whiteSpace: "pre-wrap"` preserves line breaks.

## Preview Text

First text in email client preview:

```typescript
<Preview>{digest.headline || "Your Weekly AI Digest"}</Preview>
```

Always provide fallback text.

## Date Formatting

Consistent locale formatting:

```typescript
const currentDate = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
```

## Key Files

- `emails/WeeklyDigestRedesigned.tsx` - Main template
- `functions/lib/schemas/digest.ts` - DigestOutput type
- `functions/lib/types.ts` - Summary type

## Avoid

- Don't import Tailwind config from file (must be inline)
- Don't use complex CSS (limited email client support)
- Don't forget fallback template check
- Don't use `text-{color}` without checking email client support
- Don't skip Preview component
- Don't use advanced Tailwind features (arbitrary values limited in emails)
