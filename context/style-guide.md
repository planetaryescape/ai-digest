# AI Digest Quick Style Guide

## Brand Colors
```css
--primary: #0066cc;    /* Change to your brand color */
--text: #1a1a1a;       /* Almost black */
--text-muted: #666;    /* Gray text */
--background: #ffffff;  /* White */
--border: #e5e5e5;     /* Light gray */
--success: #10b981;    /* Green */
--error: #ef4444;      /* Red */
--warning: #f59e0b;    /* Amber for warnings/costs */
```

## Typography
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
/* System fonts are free and fast */

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
```

## Spacing Scale (Tailwind Compatible)
```css
/* Use these in the frontend/ directory */
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
```

## Components

### Buttons
```css
/* Primary - Run Digest, Save Settings */
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
}

/* Secondary - Cancel, Back */
.btn-secondary {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--border);
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

/* Danger - Delete actions */
.btn-danger {
  background: var(--error);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}
```

### Cards (Dashboard widgets)
```css
.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.card-header {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: 1rem;
}
```

### Status Indicators
```css
.status-success { color: var(--success); }
.status-error { color: var(--error); }
.status-pending { color: var(--text-muted); }
.status-running { color: var(--primary); }
```

## AI Digest Specific Styles

### Dashboard Layout
```css
/* Sidebar + Content pattern */
.dashboard-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

/* Mobile: Stack everything */
@media (max-width: 768px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}
```

### Email Template Styles
```css
/* For the digest email (emails/WeeklyDigestRedesigned.tsx) */
.email-container {
  max-width: 600px;
  margin: 0 auto;
  font-family: system-ui, sans-serif;
}

.article-card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.article-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.article-summary {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}
```

### Cost Tracking Display
```css
.cost-display {
  font-family: 'SF Mono', Monaco, monospace;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.cost-warning {
  color: var(--warning);
  font-weight: 600;
}
```

## Frontend Framework (Already Using)
- **Tailwind CSS** - Already configured in `/frontend`
- **shadcn/ui** components - Use these for consistency
- **Clerk** - For authentication UI

## What NOT to Worry About
- Pixel perfection
- Custom animations
- Unique design language
- Brand guidelines document
- Design tokens beyond these basics
- Component documentation

## Quick CSS Framework Tips for `/frontend`

### Using Tailwind (Already Set Up)
```jsx
// Good - use Tailwind classes
<button className="bg-blue-500 text-white px-4 py-2 rounded">
  Run Digest Now
</button>

// Avoid - custom CSS unless necessary
<button style={{background: '#0066cc'}}>
  Run Digest Now
</button>
```

### Using shadcn/ui Components
```jsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Use pre-built components for consistency
<Button variant="default">Run Digest</Button>
<Card>Dashboard content</Card>
```

## When You Actually Need a Designer
1. Your digest emails are ugly and users complain
2. The dashboard is confusing users
3. You're losing sign-ups at onboarding
4. You've validated the business model
5. You have revenue to invest

Until then, keep it simple and focus on making the digest valuable.