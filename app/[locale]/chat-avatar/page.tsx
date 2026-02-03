"use client";

import { useState, useRef, useEffect } from "react";
import { useRive, EventType, Event as RiveEvent } from "@rive-app/react-canvas";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square, Send } from "lucide-react";
import { useChatStream } from "@/hooks/use-chat-stream";

// Verbal prompt wrapper for 5-year-old level explanations
const VERBAL_PROMPT = `[Чамайг 5 настай хүүхэдтэй ярьж байгаа юм шиг ойлгомжтой, энгийн үгээр тайлбарла.
Математикийн тухай ярихдаа тоо, томьёо бус жишээ ашигла.
Хариултаа богино (2-3 өгүүлбэр), эелдэг, ярианы хэлбэрээр өг.]

Хэрэглэгчийн асуулт: `;

export default function ChatAvatarPage() {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [response, setResponse] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isProcessingTTS, setIsProcessingTTS] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const { sendMessage, isStreaming, streamingContent } = useChatStream();

  const SILENCE_THRESHOLD = 5;
  const SILENCE_DURATION = 1500; // 1.5 sec silence to auto-stop

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Rive bunny avatar - use absolute URL to avoid locale prefix issue
  const riveUrl = typeof window !== "undefined"
    ? `${window.location.origin}/bunney.riv`
    : "/bunney.riv";

  const { rive, RiveComponent } = useRive({
    src: riveUrl,
    animations: "Idle Loop",
    autoplay: true,
  });

  const riveRef = useRef<typeof rive>(null);

  useEffect(() => {
    riveRef.current = rive;

    if (rive) {
      const onLoop = (_event: RiveEvent) => {
        if (isSpeakingRef.current && riveRef.current) {
          riveRef.current.play("01 Wave 1");
        }
      };

      const onStop = (_event: RiveEvent) => {
        if (isSpeakingRef.current && riveRef.current) {
          setTimeout(() => {
            if (isSpeakingRef.current && riveRef.current) {
              riveRef.current.play("01 Wave 1");
            }
          }, 50);
        }
      };

      rive.on(EventType.Loop, onLoop);
      rive.on(EventType.Stop, onStop);

      return () => {
        rive.off(EventType.Loop, onLoop);
        rive.off(EventType.Stop, onStop);
      };
    }
  }, [rive]);

  // Animation helpers
  const playAnimation = (name: string) => {
    try {
      if (riveRef.current) {
        riveRef.current.stop();
        riveRef.current.play(name);
      }
    } catch (e) {
      console.log("Animation error:", e);
    }
  };

  const playIdle = () => {
    isSpeakingRef.current = false;
    playAnimation("Idle Loop");
  };

  const playPose = () => {
    isSpeakingRef.current = false;
    playAnimation("Pose 1 loop");
  };

  const playWave = () => {
    isSpeakingRef.current = true;
    playAnimation("01 Wave 1");
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      silenceStartRef.current = null;
      hasSpokenRef.current = false;
      setHasSpoken(false);

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const checkLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);

        if (avg >= SILENCE_THRESHOLD) {
          if (!hasSpokenRef.current) {
            hasSpokenRef.current = true;
            setHasSpoken(true);
          }
          silenceStartRef.current = null;
        } else if (hasSpokenRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              return;
            }
          }
        }

        animationRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
        audioCtx.close();
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (hasSpokenRef.current && blob.size > 1000) {
          await transcribeAudio(blob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      playPose(); // Listening pose
    } catch (error) {
      console.error("Recording error:", error);
      alert("Микрофон руу хандах боломжгүй");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // STT → Chat → TTS
  const transcribeAudio = async (blob: Blob) => {
    try {
      const buffer = await blob.arrayBuffer();

      // Discard recordings that are too short (likely noise or accidental clicks)
      const minSize = 5120;
      if (buffer.byteLength < minSize) {
        console.warn("Recording too short, discarding");
        return;
      }

      // STT
      const sttRes = await fetch("/api/chimege?type=stt", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer,
      });

      const sttData = await sttRes.json();

      if (!sttRes.ok || !sttData.text) {
        console.error("STT Error:", sttData.error);
        return;
      }

      await sendToChat(sttData.text);
    } catch (error) {
      console.error("STT error:", error);
    }
  };

  // Send to chat-v2 and play TTS
  const sendToChat = async (text: string) => {
    setResponse("");

    try {
      // Wrap with verbal prompt
      const wrappedMessage = VERBAL_PROMPT + text;

      // Get AI response (streaming)
      const fullResponse = await sendMessage(
        wrappedMessage,
        sessionIdRef.current,
      );

      if (fullResponse) {
        setResponse(fullResponse);
        await playTTS(fullResponse);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setResponse("Алдаа гарлаа. Дахин оролдоно уу.");
    }
  };

  // Play TTS
  const playTTS = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessingTTS(true);
    playWave(); // Start wave animation

    try {
      const response = await fetch("/api/chimege?type=tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error("TTS Error:", response.status);
        playIdle();
        return;
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.onended = () => {
          playIdle();
          URL.revokeObjectURL(url);
        };
        try {
          await audioRef.current.play();
        } catch (playError) {
          console.warn("Autoplay blocked:", playError);
          URL.revokeObjectURL(url);
          playIdle();
        }
      }
    } catch (error) {
      console.error("TTS error:", error);
      playIdle();
    } finally {
      setIsProcessingTTS(false);
    }
  };

  // Handle text submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || isProcessingTTS) return;

    const message = input;
    setInput("");
    await sendToChat(message);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    playIdle();
  };

  const isLoading = isStreaming || isProcessingTTS;

  return (
    <div className="flex flex-col h-dvh bg-gradient-to-b from-blue-50 to-white">
      {/* Avatar */}
      <div className="flex-1 relative">
        <RiveComponent className="w-full h-full" />
      </div>

      {/* Response overlay */}
      {(response || streamingContent) && (
        <div className="absolute bottom-32 left-4 right-4 max-w-lg mx-auto bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg max-h-40 overflow-y-auto">
          <p className="text-gray-800 text-sm leading-relaxed">
            {streamingContent || response}
          </p>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute bottom-28 left-4 right-4 max-w-lg mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, audioLevel * 2)}%` }}
                />
              </div>
              <span className="text-gray-600 text-xs">
                {audioLevel < SILENCE_THRESHOLD
                  ? hasSpoken
                    ? "⏳ Зогсож байна..."
                    : "🎤 Ярина уу..."
                  : "🔴 Бичиж байна..."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-4 pb-6 bg-white border-t">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-lg mx-auto">
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className="shrink-0"
            onClick={toggleRecording}
            disabled={isLoading}
          >
            {isRecording ? (
              <MicOff className="size-5" />
            ) : (
              <Mic className="size-5" />
            )}
          </Button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Асуултаа бичээрэй..."
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || isRecording}
          />

          {isLoading ? (
            <Button
              type="button"
              onClick={handleStop}
              variant="destructive"
              size="icon"
              className="shrink-0"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="shrink-0"
              disabled={!input.trim() || isRecording}
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </div>

      <audio ref={audioRef} playsInline />
    </div>
  );
}
