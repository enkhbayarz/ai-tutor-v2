"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type TextbookListData = typeof api.textbooks.list._returnType | undefined;

const TextbookContext = createContext<TextbookListData>(undefined);

export function TextbookProvider({ children }: { children: ReactNode }) {
  const textbooks = useQuery(api.textbooks.list);
  return (
    <TextbookContext.Provider value={textbooks}>
      {children}
    </TextbookContext.Provider>
  );
}

export function useTextbooks() {
  return useContext(TextbookContext);
}
