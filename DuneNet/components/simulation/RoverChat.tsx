'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Volume2, X, Minimize2, Maximize2, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'rover';
  timestamp: Date;
  voiceUrl?: string;
}

interface RoverChatProps {
  roverStatus?: {
    position: [number, number, number];
    goalPosition?: [number, number, number];
    obstaclesCleared: number;
    isMoving: boolean;
    batteryLevel: number;
    currentTask: string;
    speed: number;
    estimatedTimeToGoal: number | null;
    pathProgress: number;
    pathLength: number;
  };
}

export default function RoverChat({ roverStatus }: RoverChatProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I am your rover assistant. How can I help you? You can ask about my status, obstacles, or any issues I am facing.',
      sender: 'rover',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('nova'); // ElevenLabs voice
  const [selectedGender, setSelectedGender] = useState('female');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  // Always points to the latest handleSendMessage (fixes stale-closure in speech onresult)
  const handleSendRef = useRef<(messageText?: string, isVoice?: boolean) => Promise<void>>(async () => {});

  // Voice gender and voice mapping for ElevenLabs
  const voiceConfig: Record<string, Record<string, string>> = {
    female: {
      nova: 'nova',
      alloy: 'alloy',
      echo: 'echo',
    },
    male: {
      onyx: 'onyx',
      fable: 'fable',
      shimmer: 'shimmer',
    },
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          if (transcript.trim()) {
            setInputValue(transcript);
            // Use ref to avoid stale closure; pass isVoice=true so reply is spoken aloud
            handleSendRef.current(transcript, true);
          }
        };
      }
    }
  }, []);

  // Keep ref current so speech-recognition closure always calls the latest version — must
  // stay BELOW handleSendMessage (no hoisting for const arrow functions).

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (messageText?: string, isVoice = false) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Get rover response from Gemini API
      const response = await fetch('/api/simulation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          roverStatus: roverStatus || {
            position: [0, 0, 0],
            obstaclesCleared: 0,
            isMoving: false,
            batteryLevel: 100,
            currentTask: 'Idle',
          },
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response from rover');
      }

      const data = await response.json();
      if (!data.response) throw new Error('No response from rover');

      const roverMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: 'rover',
        timestamp: new Date(),
      };

      // Get voice response from ElevenLabs
      if (data.response) {
        try {
          const selectedVoiceKey = selectedVoice as keyof typeof voiceConfig[typeof selectedGender];
          const voiceId = voiceConfig[selectedGender][selectedVoiceKey];
          
          const voiceResponse = await fetch('/api/simulation/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: data.response,
              voice: voiceId,
            }),
          });

          if (voiceResponse.ok) {
            const voiceData = await voiceResponse.json();
            if (voiceData.audioUrl) {
              roverMessage.voiceUrl = voiceData.audioUrl;

              // Auto-play ONLY when the user sent their message via voice (mic button)
              if (isVoice) {
                try {
                  const audio = new Audio(voiceData.audioUrl);
                  audio.volume = 0.8;
                  await audio.play();
                } catch (playbackError) {
                  console.warn('Audio playback failed:', playbackError);
                }
              }
            }
          } else {
            const voiceError = await voiceResponse.json().catch(() => ({}));
            console.warn('Voice generation failed:', voiceError.error || 'Unknown error');
          }
        } catch (voiceError) {
          console.warn('Voice generation error:', voiceError instanceof Error ? voiceError.message : 'Unknown error');
          // Continue without voice - not critical
        }
      }

      setMessages((prev) => [...prev, roverMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        sender: 'rover',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep the ref pointing at the latest version after every render
  handleSendRef.current = handleSendMessage;

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const handlePlayVoice = (message: Message) => {
    if (message.voiceUrl) {
      const audio = new Audio(message.voiceUrl);
      audio.play();
    }
  };

  if (!isOpen) {
    return (
      <div
        className="absolute bottom-4 left-4 z-20 cursor-pointer"
        onClick={() => setIsOpen(true)}
        title="Open rover chat"
      >
        <div className="bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110">
          <MessageCircle size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col overflow-hidden" style={{ width: 300, maxHeight: 280, minHeight: 120, background: 'rgb(15, 23, 42)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>
      {/* Header */}
      <div className="border-b border-emerald-500/20 px-3 py-1.5 flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">Rover Chat</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-0.5"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-0.5"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-slate-900 rover-chat-scroll">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
              >
                <div
                  className={`max-w-[85%] px-2.5 py-1.5 rounded-md text-[11px] ${
                    message.sender === 'user'
                      ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <p className="wrap-break-word leading-snug">{message.text}</p>
                  {message.sender === 'rover' && message.voiceUrl && (
                    <button
                      onClick={() => handlePlayVoice(message)}
                      className="mt-1 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                      title="Play voice response"
                    >
                      <Volume2 size={10} />
                      <span>Play</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="bg-slate-800 text-slate-400 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs">Rover is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-emerald-500/20 px-2 py-1.5 flex gap-1.5" style={{ background: 'rgba(30,41,59,0.5)' }}>
            <button
              onClick={startListening}
              disabled={isListening || isLoading}
              className="text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-colors shrink-0 p-0.5 rounded hover:bg-slate-700/50"
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              <Mic size={14} className={isListening ? 'text-emerald-500 animate-pulse' : ''} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask the rover..."
              disabled={isLoading}
              className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1 text-[11px] border border-slate-600 focus:border-emerald-500 outline-none disabled:opacity-50 placeholder-slate-500 hover:bg-slate-600 focus:bg-slate-600 transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors shrink-0 p-0.5 rounded hover:bg-emerald-500/10"
              title="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
      {/* Scoped scrollbar styles — emerald theme for chat */}
      <style>{`
        .rover-chat-scroll::-webkit-scrollbar { width: 5px; }
        .rover-chat-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 3px;
        }
        .rover-chat-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #10b981, #059669);
          border-radius: 3px;
        }
        .rover-chat-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #34d399, #10b981);
        }
      `}</style>
    </div>
  );
}
