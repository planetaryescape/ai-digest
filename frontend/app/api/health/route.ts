import { NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {
    env: {
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION || 'not set',
      DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'not set',
      CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
    dynamodb: {
      connection: false,
      tableExists: false,
      error: null as string | null,
    },
  }

  // Test DynamoDB connection if credentials are available
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })

      const tableName = process.env.DYNAMODB_TABLE_NAME || 'ai-digest-known-ai-senders'
      const command = new DescribeTableCommand({
        TableName: tableName,
      })

      const response = await client.send(command)
      
      checks.dynamodb.connection = true
      checks.dynamodb.tableExists = response.Table?.TableStatus === 'ACTIVE'
    } catch (error) {
      checks.dynamodb.error = error instanceof Error ? error.message : 'Unknown error'
    }
  } else {
    checks.dynamodb.error = 'AWS credentials not configured'
  }

  const allChecksPass = 
    checks.env.AWS_ACCESS_KEY_ID &&
    checks.env.AWS_SECRET_ACCESS_KEY &&
    checks.env.AWS_REGION !== 'not set' &&
    checks.dynamodb.connection &&
    checks.dynamodb.tableExists

  const headers = {
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  return NextResponse.json({
    status: allChecksPass ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, {
    status: allChecksPass ? 200 : 503,
    headers,
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}