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
        className="fixed bottom-4 right-4 z-30 cursor-pointer"
        onClick={() => setIsOpen(true)}
        title="Open rover chat"
      >
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110">
          <MessageCircle size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-96 max-h-96 bg-slate-900 rounded-lg border border-emerald-500/30 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border-b border-emerald-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-400">Rover Assistant</h3>
            <p className="text-xs text-slate-400 mt-0.5">AI-powered communication</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          {/* Voice Controls */}
          <div className="bg-slate-800/50 border-b border-emerald-500/20 px-4 py-2 flex gap-2 text-xs">
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600 focus:border-emerald-500 outline-none text-xs hover:bg-slate-600 transition-colors"
              title="Select voice gender"
            >
              <option value="female">👩 Female</option>
              <option value="male">👨 Male</option>
            </select>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600 focus:border-emerald-500 outline-none text-xs flex-1 hover:bg-slate-600 transition-colors"
              title="Select voice model"
            >
              {Object.entries(voiceConfig[selectedGender]).map(([key, value]) => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-xs ${
                    message.sender === 'user'
                      ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <p className="break-words">{message.text}</p>
                  {message.sender === 'rover' && message.voiceUrl && (
                    <button
                      onClick={() => handlePlayVoice(message)}
                      className="mt-2 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-xs"
                      title="Play voice response"
                    >
                      <Volume2 size={12} />
                      <span>Play</span>
                    </button>
                  )}
                  <span className="text-xs text-slate-500 mt-1 block opacity-75">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
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
          <div className="bg-slate-800/50 border-t border-emerald-500/20 px-3 py-2 flex gap-2">
            <button
              onClick={startListening}
              disabled={isListening || isLoading}
              className="text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-700/50"
              title={isListening ? 'Listening...' : 'Voice input (click to speak)'}
            >
              <Mic size={18} className={isListening ? 'text-emerald-500 animate-pulse' : ''} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask the rover..."
              disabled={isLoading}
              className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1 text-xs border border-slate-600 focus:border-emerald-500 outline-none disabled:opacity-50 placeholder-slate-500 hover:bg-slate-600 focus:bg-slate-600 transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors flex-shrink-0 p-1 rounded hover:bg-emerald-500/10"
              title="Send message (Enter)"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
