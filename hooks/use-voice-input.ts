"use client";

import { useState, useRef, useCallback } from "react";

const SILENCE_THRESHOLD = 5;
const SILENCE_DURATION = 1000; // ms of silence before auto-stop
const MIN_BLOB_SIZE = 1000; // bytes - minimum to consider as actual speech

interface UseVoiceInputReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  hasSpoken: boolean;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);

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
      setIsProcessing(true);
      try {
        let buffer = await blob.arrayBuffer();

        // Pad small buffers to meet minimum size
        const minSize = 5120;
        if (buffer.byteLength < minSize) {
          const padded = new ArrayBuffer(minSize);
          new Uint8Array(padded).set(new Uint8Array(buffer), 0);
          buffer = padded;
        }

        const response = await fetch("/api/chimege?type=stt", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: buffer,
        });

        const data = await response.json();

        if (response.ok && data.text) {
          onTranscript(data.text);
        }
      } catch (error) {
        console.error("Transcription error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [onTranscript]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
          }
          silenceStartRef.current = null;
        } else if (hasSpokenRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
            // Auto-stop after silence
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
        }
      };

      mediaRecorder.onstop = async () => {
        cleanup();
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (hasSpokenRef.current && blob.size > MIN_BLOB_SIZE) {
          await transcribeAudio(blob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
      cleanup();
    }
  }, [cleanup, transcribeAudio]);

  const stopRecording = useCallback(() => {
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
    startRecording,
    stopRecording,
  };
}
