"use client";

import { useState, useCallback } from "react";

export type TestPrepStep = 1 | 2 | 3 | 4 | 5 | "generating" | "complete";

export interface TestPrepData {
  subject?: string;
  grade?: number;
  chapter?: string;
  chapterTitle?: string;
  customTopic?: string;
  duration?: "15min" | "45min" | "90min";
  questionCount?: "5-10" | "10-20" | "20+";
  difficulty?: "easy" | "medium" | "hard";
  questionTypes?: string[];
}

export interface TestPrepState {
  active: boolean;
  step: TestPrepStep;
  data: TestPrepData;
}

const initialState: TestPrepState = {
  active: false,
  step: 1,
  data: {},
};

// Format helpers for prompt generation
function formatDuration(duration?: string): string {
  switch (duration) {
    case "15min": return "15 минут (Богино шалгалт)";
    case "45min": return "45 минут (Ээлжит шалгалт)";
    case "90min": return "90 минут (Улирлын шалгалт)";
    default: return "45 минут";
  }
}

function formatDifficulty(difficulty?: string): string {
  switch (difficulty) {
    case "easy": return "Хялбар (Суурь мэдлэг)";
    case "medium": return "Дунд (Хэрэглээ)";
    case "hard": return "Хүнд (Задлан шинжилгээ)";
    default: return "Дунд";
  }
}

function formatQuestionTypes(types?: string[]): string {
  if (!types || types.length === 0) return "Сонгох хариулттай, Бодлого";

  const typeLabels: Record<string, string> = {
    multiple_choice: "Сонгох хариулттай (A, B, C, D)",
    fill_blank: "Нөхөх",
    short_answer: "Богино хариулт",
    problem: "Бодлого (Дэлгэрэнгүй бодолттой)",
    diagram: "Зураг/Диаграм уншиж хариулах",
  };

  return types.map(t => typeLabels[t] || t).join(", ");
}

function formatQuestionCount(count?: string): string {
  switch (count) {
    case "5-10": return "5-10 асуулт";
    case "10-20": return "10-20 асуулт";
    case "20+": return "20+ асуулт";
    default: return "10-20 асуулт";
  }
}

export function useTestPrep() {
  const [state, setState] = useState<TestPrepState>(initialState);

  const startWorkflow = useCallback((grade?: number) => {
    setState({
      active: true,
      step: 1,
      data: { grade },
    });
  }, []);

  const updateData = useCallback((updates: Partial<TestPrepData>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const currentStep = prev.step;
      if (typeof currentStep === "number" && currentStep < 5) {
        return { ...prev, step: (currentStep + 1) as TestPrepStep };
      }
      if (currentStep === 5) {
        return { ...prev, step: "generating" };
      }
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      const currentStep = prev.step;
      if (typeof currentStep === "number" && currentStep > 1) {
        return { ...prev, step: (currentStep - 1) as TestPrepStep };
      }
      return prev;
    });
  }, []);

  const setStep = useCallback((step: TestPrepStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const generatePrompt = useCallback((): string => {
    const { data } = state;
    const topic = data.chapterTitle || data.customTopic || "Ерөнхий сэдэв";

    return `Надад ${data.grade}-р ангийн ${data.subject} хичээлийн тест бэлдээд өгөөч.

Сэдэв: ${topic}
Хугацаа: ${formatDuration(data.duration)}
Асуултын тоо: ${formatQuestionCount(data.questionCount)}
Түвшин: ${formatDifficulty(data.difficulty)}
Асуултын төрөл: ${formatQuestionTypes(data.questionTypes)}

Тестийг дараах форматаар бэлдээрэй:

1. Эхлээд тестийн толгой хэсэг (анги, хичээл, сэдэв, хугацаа, нийт оноо)
2. Дараа нь асуултууд (асуулт бүрийн оноог тодорхой бичих)
3. Хамгийн сүүлд ХАРИУЛТЫН ТҮЛХҮҮР хэсэг (зөв хариулт + товч тайлбар)

Асуултуудыг сайн боловсруулж, ${formatDifficulty(data.difficulty)} түвшинд тохируулаарай.`;
  }, [state]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const complete = useCallback(() => {
    setState(prev => ({ ...prev, step: "complete", active: false }));
  }, []);

  return {
    state,
    startWorkflow,
    updateData,
    nextStep,
    prevStep,
    setStep,
    generatePrompt,
    reset,
    complete,
  };
}
