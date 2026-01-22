"use client";

import { useState, useEffect, useCallback } from "react";

export function useFormDraft<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        setValue(JSON.parse(saved));
      } catch {
        // Invalid JSON, ignore
      }
    }
    setIsHydrated(true);
  }, [key]);

  // Save to sessionStorage on change
  useEffect(() => {
    if (isHydrated) {
      sessionStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value, isHydrated]);

  // Clear draft (call after successful submit)
  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(key);
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, clearDraft, isHydrated] as const;
}
