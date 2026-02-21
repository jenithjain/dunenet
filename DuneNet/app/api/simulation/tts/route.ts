import { NextRequest, NextResponse } from 'next/server';

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_API_URL = 'https://api.elevenlabs.io/v1';

// ElevenLabs Voice IDs (official preset voices)
const voiceIds: Record<string, string> = {
  // Female voices
  nova: '79a125e8-cd45-4c13-8a67-188112f4dd22',
  alloy: '293f3e7b-0ffb-47ab-8f43-08f9e45cfd5c',
  echo: '21m00Tcm4TlvDq3XmeFe',
  
  // Male voices  
  onyx: '5c42302c-0a38-416d-9e8b-a46f64402619',
  fable: 'ed4fdf5f-76d6-4ba6-8bfb-2eda403e8f5c',
  shimmer: '9b69d999-d5a6-408c-a97e-85de90f0875a',
};

export async function POST(request: NextRequest) {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      console.error('ELEVEN_LABS_API_KEY not configured');
      return NextResponse.json(
        { 
          error: 'Text-to-speech service is not configured. Please set ELEVEN_LABS_API_KEY in environment variables.',
          code: 'CONFIG_ERROR'
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { text, voice = 'nova' } = body;

    // Validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid text input. Please provide non-empty text.',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { 
          error: 'Text exceeds maximum length of 5000 characters.',
          code: 'TEXT_TOO_LONG'
        },
        { status: 400 }
      );
    }

    const voiceId = voiceIds[voice] || voiceIds['nova'];

    // Call ElevenLabs API
    const response = await fetch(
      `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API Error (${response.status}):`, errorText);
      
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Authentication failed. Invalid ELEVEN_LABS_API_KEY.',
            code: 'AUTH_ERROR'
          },
          { status: 401 }
        );
      }
      
      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait before retrying.',
            code: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { 
          error: `Voice generation failed: ${errorText || 'Unknown error'}`,
          code: 'GENERATION_ERROR'
        },
        { status: response.status }
      );
    }

    // Convert audio stream to base64
    try {
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      return NextResponse.json({
        success: true,
        audioUrl,
        voice,
        textLength: text.length,
        timestamp: new Date().toISOString(),
      });
    } catch (conversionError) {
      console.error('Audio conversion error:', conversionError);
      return NextResponse.json(
        { 
          error: 'Failed to process audio response.',
          code: 'CONVERSION_ERROR'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      {
        error: 'Text-to-speech service error',
        code: 'SERVER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
