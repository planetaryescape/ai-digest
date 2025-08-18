import { auth } from '@clerk/nextjs/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient, 
  UpdateCommand, 
  DeleteCommand,
  GetCommand 
} from '@aws-sdk/lib-dynamodb'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
})

const docClient = DynamoDBDocumentClient.from(client)
const tableName = process.env.DYNAMODB_TABLE_NAME || 'ai-digest-known-ai-senders'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const email = decodeURIComponent(id)

    const command = new GetCommand({
      TableName: tableName,
      Key: {
        senderEmail: email.toLowerCase(),
      },
    })

    const response = await docClient.send(command)

    if (!response.Item) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(response.Item)
  } catch (error) {
    console.error('Error fetching sender:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sender' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const email = decodeURIComponent(id)
    const body = await request.json()
    const { confidence, senderName, newsletterName } = body

    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    if (confidence !== undefined) {
      updateExpressions.push('#confidence = :confidence')
      expressionAttributeNames['#confidence'] = 'confidence'
      expressionAttributeValues[':confidence'] = Math.min(100, Math.max(0, confidence))
    }

    if (senderName !== undefined) {
      updateExpressions.push('#senderName = :senderName')
      expressionAttributeNames['#senderName'] = 'senderName'
      expressionAttributeValues[':senderName'] = senderName
    }

    if (newsletterName !== undefined) {
      updateExpressions.push('#newsletterName = :newsletterName')
      expressionAttributeNames['#newsletterName'] = 'newsletterName'
      expressionAttributeValues[':newsletterName'] = newsletterName
    }

    updateExpressions.push('#lastSeen = :lastSeen')
    expressionAttributeNames['#lastSeen'] = 'lastSeen'
    expressionAttributeValues[':lastSeen'] = new Date().toISOString()

    const command = new UpdateCommand({
      TableName: tableName,
      Key: {
        senderEmail: email.toLowerCase(),
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)

    return NextResponse.json({
      success: true,
      sender: response.Attributes,
    })
  } catch (error) {
    console.error('Error updating sender:', error)
    return NextResponse.json(
      { error: 'Failed to update sender' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const email = decodeURIComponent(id)

    const command = new DeleteCommand({
      TableName: tableName,
      Key: {
        senderEmail: email.toLowerCase(),
      },
    })

    await docClient.send(command)

    return NextResponse.json({
      success: true,
      message: 'Sender deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting sender:', error)
    return NextResponse.json(
      { error: 'Failed to delete sender' },
      { status: 500 }
    )
  }
}