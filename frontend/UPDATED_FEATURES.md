# Frontend Updates for AI Digest

## New Features Added

### 1. Step Functions Integration
The frontend now supports AWS Step Functions for orchestrated email processing pipeline.

#### New API Routes:
- **POST /api/stepfunctions/trigger** - Start a new Step Functions execution
- **GET /api/stepfunctions/status** - Get execution status by ARN
- **GET /api/stepfunctions/executions** - List recent executions

#### Updated Routes:
- **POST /api/digest/trigger** - Now supports both Lambda and Step Functions
  - Add `useStepFunctions: true` in request body to use Step Functions
  - Default behavior uses Lambda for backward compatibility

### 2. Enhanced Dashboard Components

#### DigestTrigger Component
- Added Step Functions toggle switch
- Real-time execution status monitoring
- Visual status indicators for running/succeeded/failed states
- Automatic polling for execution progress

#### ExecutionHistory Component (New)
- Shows recent Step Functions executions
- Live status updates with auto-refresh
- Execution duration tracking
- Status badges with visual indicators

### 3. Dashboard Updates
- Two-column layout for better space utilization
- Execution history panel alongside recent activity
- Real-time updates for Step Functions executions

## Configuration

Add these environment variables to your `.env.local`:

```env
# Step Functions Configuration
STEP_FUNCTIONS_STATE_MACHINE_ARN=arn:aws:states:us-east-1:ACCOUNT_ID:stateMachine:ai-digest-pipeline

# Existing AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
LAMBDA_DIGEST_FUNCTION_NAME=ai-digest-run-now
DYNAMODB_TABLE_NAME=ai-digest-known-ai-senders
```

## Usage

### Triggering with Step Functions:
1. Navigate to the dashboard
2. Enable "Use Step Functions" toggle
3. Optionally enable "Cleanup Mode" for processing all emails
4. Click "Generate Digest"
5. Monitor execution progress in real-time

### Monitoring Executions:
- View recent executions in the Execution History panel
- Status updates automatically (polls every 2 seconds while running)
- See execution duration and status for completed runs

## Technical Details

### Dependencies Added:
- `@aws-sdk/client-sfn` - AWS Step Functions SDK
- `date-fns` - Date formatting utilities

### Key Features:
- Real-time execution monitoring with automatic polling
- Graceful fallback to Lambda if Step Functions not configured
- Visual status indicators and progress tracking
- Support for both regular and cleanup mode digests

## Testing

To test the integration:

1. Ensure AWS credentials are configured
2. Set the Step Functions state machine ARN in environment variables
3. Run the frontend: `bun run dev`
4. Navigate to http://localhost:3000/dashboard
5. Trigger a digest with Step Functions enabled
6. Monitor execution progress in real-time

## Backward Compatibility

All existing functionality remains intact:
- Lambda-based digest generation still works
- Sender management APIs unchanged
- Dashboard statistics continue to function
- API routes maintain backward compatibility

## Future Enhancements

Potential improvements:
- Detailed execution step visualization
- Error details for failed executions
- Execution logs viewer
- Cost tracking per execution
- Batch operations support
- Export execution history