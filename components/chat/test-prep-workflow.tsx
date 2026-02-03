"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, BookOpen, Settings, FileText, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TestPrepStep, TestPrepData } from "@/hooks/use-test-prep";

interface Chapter {
  id: string;
  title: string;
  description: string;
}

interface TestPrepWorkflowProps {
  step: TestPrepStep;
  data: TestPrepData;
  subjects: string[];
  chapters: Chapter[];
  onUpdateData: (updates: Partial<TestPrepData>) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onCancel: () => void;
  onGenerate: () => void;
}

// Step 1: Subject Selection
function StepSubject({
  grade,
  subjects,
  selectedSubject,
  onSelect,
}: {
  grade?: number;
  subjects: string[];
  selectedSubject?: string;
  onSelect: (subject: string) => void;
}) {
  const t = useTranslations("chat.testPrep");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-medium">
        <GraduationCap className="h-5 w-5 text-blue-500" />
        <span>{t("step1Title")}</span>
      </div>

      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <span className="text-gray-600">{t("grade")}:</span>{" "}
        <span className="font-medium">{grade}-р анги</span>
      </div>

      <div>
        <p className="mb-3 text-sm text-gray-600">{t("selectSubject")}:</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <Button
              key={subject}
              variant={selectedSubject === subject ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(subject)}
              className={cn(
                "transition-all",
                selectedSubject === subject && "bg-blue-500 hover:bg-blue-600"
              )}
            >
              {subject}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 2: Topic/Chapter Selection
function StepTopic({
  subject,
  chapters,
  selectedChapter,
  customTopic,
  onSelectChapter: onSelect,
  onCustomTopic,
}: {
  subject?: string;
  chapters: Chapter[];
  selectedChapter?: string;
  customTopic?: string;
  onSelectChapter: (chapterId: string, title: string) => void;
  onCustomTopic: (topic: string) => void;
}) {
  const t = useTranslations("chat.testPrep");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [inputValue, setInputValue] = useState(customTopic || "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-medium">
        <BookOpen className="h-5 w-5 text-purple-500" />
        <span>{t("step2Title")}</span>
      </div>

      <p className="text-sm text-gray-600">
        {subject} - {t("selectTopic")}:
      </p>

      {chapters.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onSelect(chapter.id, `${chapter.title}: ${chapter.description}`)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg border transition-all text-sm",
                selectedChapter === chapter.id
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
              )}
            >
              <div className="font-medium">{chapter.title}</div>
              <div className="text-xs text-gray-500">{chapter.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{t("noChapters")}</p>
      )}

      <div className="pt-2 border-t">
        {showCustomInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("customTopicPlaceholder")}
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button
              size="sm"
              onClick={() => {
                if (inputValue.trim()) {
                  onCustomTopic(inputValue.trim());
                }
              }}
              disabled={!inputValue.trim()}
            >
              {t("confirm")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomInput(true)}
            className="text-purple-600"
          >
            {t("enterCustomTopic")}
          </Button>
        )}
      </div>
    </div>
  );
}

// Step 3: Test Configuration
function StepConfig({
  data,
  onUpdate,
}: {
  data: TestPrepData;
  onUpdate: (updates: Partial<TestPrepData>) => void;
}) {
  const t = useTranslations("chat.testPrep");

  const durations = [
    { value: "15min", label: "15 мин", desc: t("shortTest") },
    { value: "45min", label: "45 мин", desc: t("regularTest") },
    { value: "90min", label: "90 мин", desc: t("semesterTest") },
  ] as const;

  const counts = [
    { value: "5-10", label: "5-10" },
    { value: "10-20", label: "10-20" },
    { value: "20+", label: "20+" },
  ] as const;

  const difficulties = [
    { value: "easy", label: t("easy"), color: "text-green-600" },
    { value: "medium", label: t("medium"), color: "text-yellow-600" },
    { value: "hard", label: t("hard"), color: "text-red-600" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-lg font-medium">
        <Settings className="h-5 w-5 text-orange-500" />
        <span>{t("step3Title")}</span>
      </div>

      {/* Duration */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">{t("duration")}:</p>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <Button
              key={d.value}
              variant={data.duration === d.value ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ duration: d.value })}
              className={cn(
                data.duration === d.value && "bg-orange-500 hover:bg-orange-600"
              )}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Question Count */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">{t("questionCount")}:</p>
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <Button
              key={c.value}
              variant={data.questionCount === c.value ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ questionCount: c.value })}
              className={cn(
                data.questionCount === c.value && "bg-orange-500 hover:bg-orange-600"
              )}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">{t("difficulty")}:</p>
        <div className="flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <Button
              key={d.value}
              variant={data.difficulty === d.value ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ difficulty: d.value })}
              className={cn(
                data.difficulty === d.value && "bg-orange-500 hover:bg-orange-600",
                data.difficulty !== d.value && d.color
              )}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 4: Question Types
function StepQuestionTypes({
  selectedTypes,
  onToggle,
}: {
  selectedTypes: string[];
  onToggle: (type: string) => void;
}) {
  const t = useTranslations("chat.testPrep");

  const types = [
    { value: "multiple_choice", label: t("multipleChoice") },
    { value: "fill_blank", label: t("fillBlank") },
    { value: "short_answer", label: t("shortAnswer") },
    { value: "problem", label: t("problem") },
    { value: "diagram", label: t("diagram") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-medium">
        <FileText className="h-5 w-5 text-green-500" />
        <span>{t("step4Title")}</span>
      </div>

      <p className="text-sm text-gray-600">{t("selectQuestionTypes")}:</p>

      <div className="space-y-2">
        {types.map((type) => {
          const isSelected = selectedTypes.includes(type.value);
          return (
            <button
              key={type.value}
              onClick={() => onToggle(type.value)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-sm text-left",
                isSelected
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-green-300"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  isSelected
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-300"
                )}
              >
                {isSelected && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className={isSelected ? "text-green-700 font-medium" : ""}>
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 5: Generating
function StepGenerating() {
  const t = useTranslations("chat.testPrep");

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm text-gray-600">{t("generating")}</p>
    </div>
  );
}

// Main Workflow Component
export function TestPrepWorkflow({
  step,
  data,
  subjects,
  chapters,
  onUpdateData,
  onNextStep,
  onPrevStep,
  onCancel,
  onGenerate,
}: TestPrepWorkflowProps) {
  const t = useTranslations("chat.testPrep");

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!data.subject;
      case 2:
        return !!(data.chapter || data.customTopic);
      case 3:
        return !!(data.duration && data.questionCount && data.difficulty);
      case 4:
        return (data.questionTypes?.length || 0) > 0;
      default:
        return false;
    }
  };

  const handleQuestionTypeToggle = (type: string) => {
    const current = data.questionTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onUpdateData({ questionTypes: updated });
  };

  if (step === "generating") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <StepGenerating />
      </div>
    );
  }

  if (step === "complete") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-all",
              typeof step === "number" && s <= step ? "bg-blue-500" : "bg-gray-200"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepSubject
          grade={data.grade}
          subjects={subjects}
          selectedSubject={data.subject}
          onSelect={(subject) => onUpdateData({ subject })}
        />
      )}

      {step === 2 && (
        <StepTopic
          subject={data.subject}
          chapters={chapters}
          selectedChapter={data.chapter}
          customTopic={data.customTopic}
          onSelectChapter={(id, title) => onUpdateData({ chapter: id, chapterTitle: title, customTopic: undefined })}
          onCustomTopic={(topic) => onUpdateData({ customTopic: topic, chapter: undefined, chapterTitle: undefined })}
        />
      )}

      {step === 3 && <StepConfig data={data} onUpdate={onUpdateData} />}

      {step === 4 && (
        <StepQuestionTypes
          selectedTypes={data.questionTypes || []}
          onToggle={handleQuestionTypeToggle}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          {typeof step === "number" && step > 1 ? (
            <Button variant="ghost" size="sm" onClick={onPrevStep}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("back")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-gray-500">
              {t("cancel")}
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-400">
          {typeof step === "number" && `${step}/4`}
        </div>

        <Button
          size="sm"
          onClick={step === 4 ? onGenerate : onNextStep}
          disabled={!canProceed()}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {step === 4 ? t("generate") : t("next")}
        </Button>
      </div>
    </div>
  );
}
