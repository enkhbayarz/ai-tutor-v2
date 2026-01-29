"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const SILENCE_THRESHOLD = 5;
const SILENCE_DURATION = 1000; // ms of silence before auto-stop
const MIN_BLOB_SIZE = 1000; // bytes - minimum to consider as actual speech

interface UseVoiceInputReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  hasSpoken: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useVoiceInput(
  onTranscript: (text: string) => void
): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);

  // Get microphone permission and enumerate devices on mount
  useEffect(() => {
    const initDevices = async () => {
      try {
        // First request permission
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Then enumerate devices
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const mics = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(mics);

        // Try to find MacBook mic or use first available
        const macMic = mics.find((d) => d.label.includes("MacBook"));
        const defaultDevice = macMic?.deviceId || mics[0]?.deviceId || "";
        setSelectedDeviceId(defaultDevice);

        console.log("[MIC] Available microphones:", mics.map(m => m.label || m.deviceId));
        console.log("[MIC] Selected device:", defaultDevice);
      } catch (error) {
        console.error("[MIC] Failed to get microphone permission:", error);
      }
    };

    initDevices();

    return () => {
      cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  const transcribeAudio = useCallback(
    async (blob: Blob) => {
      console.log("[STT] Starting transcription, blob size:", blob.size);
      setIsProcessing(true);
      try {
        let buffer = await blob.arrayBuffer();
        console.log("[STT] Buffer size:", buffer.byteLength);

        // Pad small buffers to meet minimum size
        const minSize = 5120;
        if (buffer.byteLength < minSize) {
          console.log("[STT] Padding buffer to minimum size");
          const padded = new ArrayBuffer(minSize);
          new Uint8Array(padded).set(new Uint8Array(buffer), 0);
          buffer = padded;
        }

        console.log("[STT] Sending to /api/chimege?type=stt");
        const response = await fetch("/api/chimege?type=stt", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: buffer,
        });

        console.log("[STT] Response status:", response.status);
        const data = await response.json();
        console.log("[STT] Response data:", data);

        if (response.ok && data.text) {
          console.log("[STT] Transcription successful:", data.text);
          onTranscript(data.text);
        } else {
          console.error("[STT] Transcription failed:", data.error || "No text returned");
        }
      } catch (error) {
        console.error("[STT] Transcription error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [onTranscript]
  );

  const startRecording = useCallback(async () => {
    console.log("[MIC] Starting recording...");
    console.log("[MIC] Using device ID:", selectedDeviceId || "default");

    try {
      // Use specific device if selected (like the working TutorChimegePage)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
      });

      console.log("[MIC] Got media stream");
      streamRef.current = stream;

      // Log available tracks
      const tracks = stream.getAudioTracks();
      console.log("[MIC] Audio tracks:", tracks.map(t => ({ label: t.label, enabled: t.enabled, muted: t.muted })));

      // Reset state
      silenceStartRef.current = null;
      hasSpokenRef.current = false;
      setHasSpoken(false);

      // Audio analysis for VAD
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      console.log("[MIC] Audio context created, sample rate:", audioCtx.sampleRate);

      const checkLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);

        // Voice activity detection
        if (avg >= SILENCE_THRESHOLD) {
          if (!hasSpokenRef.current) {
            hasSpokenRef.current = true;
            setHasSpoken(true);
            console.log("[MIC] Voice detected! Level:", avg);
          }
          silenceStartRef.current = null;
        } else if (hasSpokenRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
            // Auto-stop after silence
            console.log("[MIC] Auto-stopping after silence");
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

      // MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log("[MIC] Received audio chunk, size:", e.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[MIC] Recording stopped");
        cleanup();
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        console.log("[MIC] Total blob size:", blob.size, "hasSpoken:", hasSpokenRef.current);

        if (hasSpokenRef.current && blob.size > MIN_BLOB_SIZE) {
          await transcribeAudio(blob);
        } else {
          console.log("[MIC] Skipping transcription - no speech or too small");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log("[MIC] Recording started - speak now!");
    } catch (error) {
      console.error("[MIC] Recording error:", error);
      cleanup();
    }
  }, [cleanup, transcribeAudio, selectedDeviceId]);

  const stopRecording = useCallback(() => {
    console.log("[MIC] Manual stop requested");
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    isProcessing,
    audioLevel,
    hasSpoken,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    stopRecording,
  };
}
