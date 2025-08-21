import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { SFNClient, ListExecutionsCommand } from '@aws-sdk/client-sfn';

vi.mock('@clerk/nextjs/server');
vi.mock('@aws-sdk/client-sfn');

describe('/api/stepfunctions/executions', () => {
  let mockSend: any;
  
  beforeEach(() => {
    mockSend = vi.fn().mockResolvedValue({
      executions: [
        {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:execution-1',
          name: 'execution-1',
          status: 'SUCCEEDED',
          startDate: new Date('2024-01-01T12:00:00Z'),
          stopDate: new Date('2024-01-01T12:05:00Z'),
        },
        {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:execution-2',
          name: 'execution-2',
          status: 'RUNNING',
          startDate: new Date('2024-01-01T13:00:00Z'),
        },
      ],
      nextToken: 'next-page-token',
    });
    
    vi.mocked(SFNClient).mockImplementation(() => ({
      send: mockSend,
    } as any));
    
    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
  
  it('returns 500 when state machine ARN is not configured', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    delete process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Step Functions state machine ARN not configured');
  });
  
  it('returns list of executions with default parameters', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.executions).toHaveLength(2);
    expect(data.executions[0]).toEqual({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:execution-1',
      name: 'execution-1',
      status: 'SUCCEEDED',
      startDate: new Date('2024-01-01T12:00:00Z'),
      stopDate: new Date('2024-01-01T12:05:00Z'),
    });
    expect(data.nextToken).toBe('next-page-token');
  });
  
  it('filters executions by status', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions?status=RUNNING');
    
    await GET(request);
    
    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(ListExecutionsCommand);
    expect(command.input.statusFilter).toBe('RUNNING');
  });
  
  it('validates and limits maxResults parameter', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    // Test valid range
    const request1 = new Request('http://localhost:3000/api/stepfunctions/executions?maxResults=50');
    await GET(request1);
    
    let command = mockSend.mock.calls[0][0];
    expect(command.input.maxResults).toBe(50);
    
    // Test upper bound
    const request2 = new Request('http://localhost:3000/api/stepfunctions/executions?maxResults=200');
    await GET(request2);
    
    command = mockSend.mock.calls[1][0];
    expect(command.input.maxResults).toBe(100); // Should be capped at 100
    
    // Test lower bound
    const request3 = new Request('http://localhost:3000/api/stepfunctions/executions?maxResults=0');
    await GET(request3);
    
    command = mockSend.mock.calls[2][0];
    expect(command.input.maxResults).toBe(1); // Should be at least 1
  });
  
  it('handles invalid maxResults gracefully', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions?maxResults=invalid');
    
    await GET(request);
    
    const command = mockSend.mock.calls[0][0];
    expect(command.input.maxResults).toBe(10); // Should default to 10
  });
  
  it('passes nextToken for pagination', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions?nextToken=page-2-token');
    
    await GET(request);
    
    const command = mockSend.mock.calls[0][0];
    expect(command.input.nextToken).toBe('page-2-token');
  });
  
  it('returns 400 for invalid status filter', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions?status=INVALID_STATUS');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid query parameters');
    expect(data.details).toBeDefined();
  });
  
  it('handles empty executions list', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    mockSend.mockResolvedValue({
      executions: [],
      nextToken: null,
    });
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.executions).toEqual([]);
    expect(data.nextToken).toBeNull();
  });
  
  it('handles AWS SDK errors gracefully', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    mockSend.mockRejectedValue(new Error('StateMachineDoesNotExist'));
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to list executions');
    expect(data.details).toBeDefined();
  });
  
  it('combines multiple query parameters correctly', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions?status=FAILED&maxResults=25&nextToken=token123');
    
    await GET(request);
    
    const command = mockSend.mock.calls[0][0];
    expect(command.input.statusFilter).toBe('FAILED');
    expect(command.input.maxResults).toBe(25);
    expect(command.input.nextToken).toBe('token123');
  });
  
  it('handles null/undefined executions from AWS', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'test-user-123' } as any);
    
    mockSend.mockResolvedValue({
      executions: null,
      nextToken: null,
    });
    
    const request = new Request('http://localhost:3000/api/stepfunctions/executions');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.executions).toEqual([]);
  });
});