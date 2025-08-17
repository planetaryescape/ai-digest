# AI Digest Frontend

A modern Next.js 15 frontend for managing AI newsletter digests with Clerk authentication and TanStack suite.

## Features

- 🔐 **Authentication**: Secure login with Clerk
- 📊 **Dashboard**: Real-time statistics and activity monitoring
- 👥 **Sender Management**: CRUD operations for AI senders with confidence scoring
- 🚀 **Digest Generation**: Manual trigger with cleanup mode option
- 📱 **Responsive Design**: Mobile-friendly interface with shadcn/ui
- ⚡ **Real-time Updates**: Live progress tracking with Server-Sent Events
- 🔄 **Data Management**: Advanced table features with TanStack Table

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: Clerk
- **State Management**: TanStack Query
- **UI Components**: shadcn/ui + Tailwind CSS
- **Data Tables**: TanStack Table
- **Forms**: TanStack Form
- **Deployment**: Vercel
- **Backend Integration**: AWS Lambda + DynamoDB

## Getting Started

### Prerequisites

1. Node.js 18+ and npm
2. Clerk account for authentication
3. AWS credentials for Lambda and DynamoDB access
4. Vercel account for deployment

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
- Clerk keys from dashboard.clerk.com
- AWS credentials with Lambda and DynamoDB permissions
- Function names from your AWS deployment

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Building

Build for production:

```bash
npm run build
```

### Deployment

#### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

#### Manual Deployment

```bash
vercel --prod
```

## Project Structure

```
frontend/
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── dashboard/       # Dashboard pages
│   └── sign-in/         # Auth pages
├── components/          # React components
│   ├── dashboard/       # Dashboard components
│   ├── senders/         # Sender management
│   └── ui/              # shadcn/ui components
├── lib/                 # Utilities
│   ├── aws/            # AWS SDK helpers
│   └── utils/          # Helper functions
└── types/              # TypeScript types
```

## API Routes

### Digest Operations
- `POST /api/digest/trigger` - Trigger digest generation
- `GET /api/digest/status` - Check generation status

### Sender Management
- `GET /api/senders` - List all senders
- `POST /api/senders` - Add new sender
- `PATCH /api/senders/[id]` - Update sender
- `DELETE /api/senders/[id]` - Delete sender

## Environment Variables

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
LAMBDA_DIGEST_FUNCTION_NAME=ai-digest-run-now
LAMBDA_WEEKLY_FUNCTION_NAME=ai-digest-weekly-digest

# DynamoDB/S3
DYNAMODB_TABLE_NAME=ai-digest-known-ai-senders
S3_BUCKET_NAME=ai-digest-storage

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

## Features

### Dashboard
- Overview statistics (total senders, confidence levels, email counts)
- Recent activity feed
- Quick digest trigger with cleanup mode

### Sender Management
- Advanced data table with sorting, filtering, pagination
- Bulk operations (select and delete multiple)
- Confidence score visualization
- Add/Edit/Delete individual senders
- Search across all sender fields

### Digest Generation
- Manual trigger button
- Cleanup mode for processing all emails
- Real-time progress tracking
- Success/error notifications

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT