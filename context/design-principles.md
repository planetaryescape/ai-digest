# Pragmatic SaaS Design Checklist (AI Digest Edition)

## Philosophy: Ship Good Enough, Iterate Based on Feedback

### Core Principles (The Only Ones That Matter)
- [ ] **It Works** - Features do what they promise
- [ ] **It's Clear** - Users understand what to do
- [ ] **It's Fast** - Pages load quickly, interactions feel snappy
- [ ] **It's Not Broken** - No glaring visual bugs
- [ ] **It's Trustworthy** - Looks professional enough to enter credit card

## The Money Feature (THIS MUST BE PERFECT)
### The Weekly Digest Email
- [ ] Beautiful, readable email template
- [ ] Clear hierarchy of information
- [ ] Mobile-responsive email design
- [ ] Professional appearance that builds trust
- [ ] Easy-to-scan article summaries
- [ ] Clear CTAs for user actions

### The Dashboard (frontend/)
- [ ] Clear way to trigger manual digest
- [ ] Status of last digest run
- [ ] Simple sender management
- [ ] Cost tracking visibility

## Quick Design System (Keep It Simple)

### Colors (Pick 5, Move On)
- [ ] **Primary Brand Color** - Your main color
- [ ] **Text Color** - Usually dark gray/black
- [ ] **Background** - White or very light
- [ ] **Success** - Green for good things
- [ ] **Danger** - Red for destructive actions
- [ ] That's it. Stop overthinking colors.

### Typography (One Font, Three Sizes)
- [ ] **One Font Family** - System fonts are fine (seriously)
- [ ] **Large** - Headers (make them bigger than you think)
- [ ] **Medium** - Body text (16px minimum)
- [ ] **Small** - Captions (but not too small)

### Spacing (Pick One Unit)
- [ ] Use 8px or 16px as base unit
- [ ] Stick to multiples of your unit
- [ ] When in doubt, add more space

### Components (Build As Needed)
- [ ] **Buttons** - Primary and secondary is enough
- [ ] **Forms** - Clear labels, obvious errors
- [ ] **Cards** - Container with shadow/border
- [ ] **Tables** - Just make them readable
- [ ] Don't build a component library, build features

## Layout (Dead Simple)
- [ ] **Sidebar + Content** - Classic SaaS layout
- [ ] **Mobile** - Stack everything vertically
- [ ] **Responsive** - Test at 3 sizes max (phone/tablet/desktop)

## AI Digest Specific Checks

### Dashboard (`/frontend/app/dashboard`)
- [ ] Clear "Run Now" button
- [ ] Obvious status indicators
- [ ] Simple sender list management
- [ ] Cost tracking visible
- [ ] Recent digest history

### Email Template (`emails/WeeklyDigestRedesigned.tsx`)
- [ ] Works in Gmail, Outlook, Apple Mail
- [ ] Mobile responsive
- [ ] Dark mode compatible
- [ ] Images have fallbacks
- [ ] Text version included

## Actual Problems Worth Fixing
- [ ] Text too small to read comfortably
- [ ] Buttons that don't look clickable
- [ ] Forms without clear labels
- [ ] No feedback after user actions
- [ ] Error messages that don't help
- [ ] Loading without indication
- [ ] Broken on mobile
- [ ] Inaccessible to keyboard users

## Not Worth Your Time (Yet)
- Perfect spacing systems
- Comprehensive icon libraries  
- Custom animation frameworks
- Dark mode (unless users demand it)
- Perfect cross-browser compatibility
- Micro-interactions everywhere
- Custom fonts
- Complex grid systems

## Quick Wins That Matter
- [ ] Consistent button styles
- [ ] Clear navigation
- [ ] Readable text
- [ ] Obvious CTAs
- [ ] Loading states
- [ ] Error handling
- [ ] Mobile usability

## When to Polish More
1. Users complain about specific UI issues
2. You're losing conversions at a specific step
3. Preparing for a launch (Product Hunt, etc.)
4. You have paying customers and time

Remember: Twitter was ugly. Craigslist is still ugly. 
They solved real problems. Focus on that.

## The Only Accessibility That Matters (For Now)
- [ ] Keyboard navigation works
- [ ] Text has enough contrast
- [ ] Forms have labels
- [ ] Images have alt text
- [ ] Nothing breaks screen readers

Perfect WCAG compliance can wait until you have users.

## AI Digest Specific Priorities
1. **Email template** - This IS the product
2. **Dashboard usability** - Must be dead simple
3. **Onboarding flow** - Gmail auth must work
4. **Error states** - When APIs fail, users need to know
5. Everything else can wait