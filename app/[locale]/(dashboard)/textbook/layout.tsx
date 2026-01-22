import { TextbookProvider } from "@/components/textbook/textbook-context";

export default function TextbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TextbookProvider>{children}</TextbookProvider>;
}
