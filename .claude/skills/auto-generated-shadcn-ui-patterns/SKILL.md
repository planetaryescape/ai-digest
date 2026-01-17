---
name: auto-generated-shadcn-ui-patterns
description: shadcn/ui component patterns for this project. CVA variants, Radix primitives, cn utility, forwardRef. Triggers on "shadcn", "ui components", "class-variance-authority", "radix-ui", "cva", "button", "badge", "alert".
---

# shadcn/ui Patterns

Frontend uses shadcn/ui components with class-variance-authority (CVA) for variants.

## CVA Variant Pattern

Define variants with `cva()`, export both component and variants:

```typescript
// From frontend/components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**First arg**: Base classes applied to all variants
**Second arg**: Object with `variants` and `defaultVariants`

Always export variants function for reuse: `export { Button, buttonVariants };`

## Type-Safe Props with VariantProps

Extract variant types from CVA definition:

```typescript
// From frontend/components/ui/button.tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

`VariantProps<typeof buttonVariants>` gives you typed `variant` and `size` props.

Simple components without custom props:

```typescript
// From frontend/components/ui/badge.tsx
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
```

## Radix Slot Pattern (asChild)

Use `Slot` from Radix to allow component polymorphism:

```typescript
// From frontend/components/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
```

**Pattern**: `const Comp = asChild ? Slot : "button"`

Allows usage like:
```tsx
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

## cn Utility for className Merging

Always use `cn()` to merge variant classes with custom classes:

```typescript
// From frontend/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage in components**:

```typescript
// Merge variant classes with additional className
<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />

// Or simpler for non-CVA components
<div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />

// Or for subcomponents with static classes
<h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
```

**Key**: Always pass `className` last to allow user overrides.

## forwardRef Pattern

All interactive components use `forwardRef` for ref forwarding:

```typescript
// With custom interface
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // ...
  }
);
Button.displayName = "Button";

// Inline type for subcomponents
const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";
```

**Always set** `displayName` for better debugging.

## Variant Patterns in This Project

### Standard Variants
```typescript
variant: {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
}
```

### Size Variants
```typescript
size: {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
}
```

## Usage in Components

From `frontend/components/dashboard/DigestTrigger.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Basic button
<Button onClick={handleTrigger} disabled={isPending} size="lg">
  <Play className="mr-2 h-4 w-4" />
  Generate Digest
</Button>

// Button with variant
<Button variant="ghost" size="sm" onClick={handleClear}>
  Clear
</Button>

// Badge with conditional variant
<Badge
  variant={
    status === "RUNNING"
      ? "default"
      : status === "SUCCEEDED"
        ? "secondary"
        : "destructive"
  }
>
  {status}
</Badge>

// Alert with custom border color
<Alert className="border-indigo-200 bg-indigo-50">
  <Calendar className="h-4 w-4" />
  <AlertTitle>Historical Date Range</AlertTitle>
  <AlertDescription>
    <p>Select date range for historical digest:</p>
  </AlertDescription>
</Alert>
```

## Advanced CVA Patterns

### Complex Selector Patterns

Use arbitrary selectors for child element styling:

```typescript
// From button.tsx - style nested SVGs
"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

// From alert.tsx - position SVG and adjust siblings
"[&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4"
```

### Component Composition

Subcomponents share parent context through classes:

```typescript
// From frontend/components/ui/alert.tsx
const Alert = React.forwardRef<...>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));

const AlertTitle = React.forwardRef<...>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
));

const AlertDescription = React.forwardRef<...>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));

export { Alert, AlertTitle, AlertDescription };
```

## Key Files

- `frontend/components/ui/button.tsx` - Button with asChild and multiple variants
- `frontend/components/ui/badge.tsx` - Simple CVA without forwardRef complexity
- `frontend/components/ui/alert.tsx` - Composite component with subcomponents
- `frontend/lib/utils.ts` - cn utility definition
- `frontend/components/dashboard/DigestTrigger.tsx` - Real-world usage examples

## Avoid

- **Don't** apply variant classes directly: `<button className="bg-primary">` → Use `<Button variant="default">`
- **Don't** forget `cn()` when merging classes: `className={buttonVariants({ variant }) + " " + className}` is wrong
- **Don't** skip `displayName`: Makes debugging harder in React DevTools
- **Don't** pass `variant` to DOM: CVA extracts it, but spread `...props` carefully
- **Don't** use `asChild` without Slot import: Component will break
