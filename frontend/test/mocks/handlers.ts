import { http, HttpResponse } from 'msw';

export const handlers = [
  // Step Functions API handlers
  http.post('/api/stepfunctions/trigger', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      message: 'Step Functions pipeline started',
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123',
      executionName: 'test-execution-123',
      startDate: new Date().toISOString(),
    });
  }),

  http.get('/api/stepfunctions/status', ({ request }) => {
    const url = new URL(request.url);
    const executionArn = url.searchParams.get('executionArn');
    
    if (!executionArn) {
      return HttpResponse.json({ error: 'Missing executionArn' }, { status: 400 });
    }
    
    return HttpResponse.json({
      status: 'RUNNING',
      executionArn,
      startDate: new Date().toISOString(),
    });
  }),

  http.get('/api/stepfunctions/executions', ({ request }) => {
    const url = new URL(request.url);
    const maxResults = parseInt(url.searchParams.get('maxResults') || '10');
    
    return HttpResponse.json({
      executions: [
        {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-1',
          name: 'test-execution-1',
          status: 'SUCCEEDED',
          startDate: new Date(Date.now() - 3600000).toISOString(),
          stopDate: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-2',
          name: 'test-execution-2',
          status: 'RUNNING',
          startDate: new Date(Date.now() - 600000).toISOString(),
        },
      ].slice(0, maxResults),
    });
  }),

  // Digest trigger API
  http.post('/api/digest/trigger', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.useStepFunctions) {
      return HttpResponse.json({
        success: true,
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123',
        executionName: 'test-execution-123',
        message: 'Step Functions pipeline started',
      });
    }
    
    return HttpResponse.json({
      success: true,
      message: body.cleanup 
        ? 'Cleanup digest generation started' 
        : 'Weekly digest generation started',
    });
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'healthy' });
  }),
];