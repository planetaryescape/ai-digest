import { auth } from '@clerk/nextjs/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand,
  BatchWriteCommand 
} from '@aws-sdk/lib-dynamodb'
import { NextResponse } from 'next/server'
import type { KnownSender } from '@/types/sender'

export const runtime = 'nodejs'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const docClient = DynamoDBDocumentClient.from(client)
const tableName = process.env.DYNAMODB_TABLE_NAME || 'ai-digest-known-ai-senders'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const command = new ScanCommand({
      TableName: tableName,
    })

    const response = await docClient.send(command)
    const senders = response.Items as KnownSender[]

    return NextResponse.json(senders || [])
  } catch (error) {
    console.error('Error fetching senders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch senders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, newsletterName, confidence = 90 } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const domain = email.split('@')[1] || ''
    const now = new Date().toISOString()

    const newSender: KnownSender = {
      senderEmail: email.toLowerCase(),
      domain,
      senderName: name,
      newsletterName,
      confirmedAt: now,
      lastSeen: now,
      confidence,
      emailCount: 1,
    }

    const command = new PutCommand({
      TableName: tableName,
      Item: newSender,
    })

    await docClient.send(command)

    return NextResponse.json({
      success: true,
      sender: newSender,
    })
  } catch (error) {
    console.error('Error adding sender:', error)
    return NextResponse.json(
      { error: 'Failed to add sender' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emails } = body

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      )
    }

    // Batch delete (DynamoDB supports up to 25 items per batch)
    const batchSize = 25
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const deleteRequests = batch.map((email: string) => ({
        DeleteRequest: {
          Key: {
            senderEmail: email.toLowerCase(),
          },
        },
      }))

      const command = new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests,
        },
      })

      await docClient.send(command)
    }

    return NextResponse.json({
      success: true,
      deleted: emails.length,
    })
  } catch (error) {
    console.error('Error deleting senders:', error)
    return NextResponse.json(
      { error: 'Failed to delete senders' },
      { status: 500 }
    )
  }
}