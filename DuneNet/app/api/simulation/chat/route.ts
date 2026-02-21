import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function getChatModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, roverStatus, conversationHistory } = body;

    // Input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid message. Please provide non-empty text.',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { 
          error: 'Message is too long. Maximum 2000 characters allowed.',
          code: 'MESSAGE_TOO_LONG'
        },
        { status: 400 }
      );
    }

    // Build rover context from current status
    let roverContext = '';
    if (roverStatus && typeof roverStatus === 'object') {
      try {
        const pos = (roverStatus.position as any) || [0, 0, 0];
        const posStr = Array.isArray(pos)
          ? `(${pos[0]?.toFixed?.(1) ?? '?'}, ${pos[1]?.toFixed?.(1) ?? '?'}, ${pos[2]?.toFixed?.(1) ?? '?'})`
          : '(?, ?, ?)';

        const goal = (roverStatus.goalPosition as any);
        const goalStr = Array.isArray(goal)
          ? `(${goal[0]?.toFixed?.(1) ?? '?'}, ${goal[1]?.toFixed?.(1) ?? '?'}, ${goal[2]?.toFixed?.(1) ?? '?'})`
          : 'unknown';

        const progress = roverStatus.pathProgress != null
          ? `${Math.round(roverStatus.pathProgress * 100)}%`
          : '?';

        const eta = roverStatus.estimatedTimeToGoal != null
          ? roverStatus.estimatedTimeToGoal > 0
            ? `~${roverStatus.estimatedTimeToGoal}s`
            : 'Arrived'
          : 'N/A (stationary)';

        roverContext = `
Current Rover Telemetry:
- Position: ${posStr}
- Goal Position: ${goalStr}
- Is Moving: ${roverStatus.isMoving ? 'Yes' : 'No'}
- Speed: ${roverStatus.speed ?? 2} units/s
- Path Progress: ${progress} (${roverStatus.pathLength ?? 0} total waypoints)
- Estimated Time to Goal: ${eta}
- Obstacles Cleared (approx): ${roverStatus.obstaclesCleared ?? 0}
- Battery Level: ${roverStatus.batteryLevel ?? 100}%
- Current Task: ${roverStatus.currentTask || 'Idle'}
`;
      } catch (e) {
        console.warn('Error building rover context:', e);
        roverContext = '';
      }
    }

    // Build conversation history for context (last 4 messages max)
    let conversationContext = '';
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      try {
        const recentMessages = conversationHistory
          .filter((m: any) => m && typeof m === 'object' && m.text && m.sender)
          .slice(-4)
          .map((m: any) => 
            `${m.sender === 'user' ? 'Human' : 'Rover'}: ${m.text.substring(0, 200)}`
          )
          .join('\n');
        
        if (recentMessages.length > 0) {
          conversationContext = '\nRecent Conversation:\n' + recentMessages;
        }
      } catch (e) {
        console.warn('Error building conversation context:', e);
        conversationContext = '';
      }
    }

    const systemPrompt = `You are a sophisticated rover assistant in a desert simulation environment.
You are helping the user understand and interact with their Mars rover in real-time.
${roverContext}${conversationContext}

Your responsibilities:
1. Answer questions about the rover's current status and operations
2. Provide insights about obstacles and navigation decisions
3. Report on battery level, position, and task progress
4. Explain any issues or challenges the rover is facing
5. Suggest optimizations for paths and navigation
6. Be concise and technical but also friendly and helpful

Guidelines:
- Keep responses SHORT (1-3 sentences max)
- Focus on answering the specific question directly
- Use clear, technical language but make it understandable
- Always reference current rover data when relevant
- Be natural and conversational, not robotic`;

    try {
      const model = getChatModel();
      
      // Simpler prompt combining system context and user message
      const fullPrompt = systemPrompt + '\n\nUser message: ' + message.trim();
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const generatedText = response.text().trim();

      if (!generatedText) {
        return NextResponse.json(
          {
            response: 'I understood your question but had difficulty forming a response. Please try again.',
            timestamp: new Date().toISOString(),
            warning: 'Empty response from model'
          }
        );
      }

      return NextResponse.json({
        response: generatedText,
        timestamp: new Date().toISOString(),
        messageLength: message.length,
        roverStatusIncluded: !!roverStatus,
      });
    } catch (modelError) {
      console.error('Gemini Model Error:', modelError);
      
      // Check for specific Gemini errors
      const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);
      console.error('Error Details:', errorMsg);
      
      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('API key') || errorMsg.includes('401')) {
        return NextResponse.json(
          {
            error: 'Authentication failed. Check GEMINI_API_KEY configuration.',
            code: 'AUTH_ERROR',
            details: errorMsg
          },
          { status: 401 }
        );
      }

      if (errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return NextResponse.json(
          {
            error: 'Service temporarily unavailable. Please try again later.',
            code: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to generate response from rover AI',
          code: 'MODEL_ERROR',
          details: errorMsg,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error processing chat request',
        code: 'SERVER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
