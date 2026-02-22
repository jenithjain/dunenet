import { NextRequest, NextResponse } from 'next/server';

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_API_URL = 'https://api.elevenlabs.io/v1';

// ElevenLabs Voice IDs (real preset voices)
const voiceIds: Record<string, string> = {
  // Female voices
  nova: 'EXAVITQu4vr4xnSDxMaL',    // Bella
  alloy: 'MF3mGyEYCl7XYWbV9V6O',   // Elli
  echo: '21m00Tcm4TlvDq8XmeFe',    // Rachel

  // Male voices
  onyx: 'VR6AewLTigWG4xSOukaG',    // Arnold
  fable: 'pNInz6obpgDQGcFmaJgB',   // Adam
  shimmer: 'yoZ06aMxZJJ28mfd3POQ',  // Sam
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
          model_id: 'eleven_turbo_v2_5',
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
