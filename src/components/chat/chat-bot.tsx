"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { Bot, Copy, MessageCircle, RotateCcw, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

interface ChatMessagePart {
  type: string;
  text: string;
}

interface ChatMessageLike {
  id: string;
  role: string;
  parts?: ChatMessagePart[];
  content?: string;
}

// ── Local Storage ──────────────────────────────────────────────────────

const STORAGE_KEY = "bobsolar-chat-history";

function loadInitialMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed as UIMessage[];
  } catch {
    return [];
  }
}

function persistMessages(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable — silently degrade.
  }
}

// ── Text Rendering ────────────────────────────────────────────────────

/**
 * Strip <think>…</think> blocks from streamed responses.
 * Also removes an incomplete trailing <think> tag.
 */
function stripThinkTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
}

/**
 * Render message text with basic markdown-like formatting.
 * Supports:
 *   - **bold** → <strong>
 *   - *italic* → <em>
 *   - `inline code` → <code>
 *   - line breaks → <br>
 *
 * This is intentionally lightweight — no heavy markdown parser needed
 * for the assistant's current output format.
 */
/**
 * Render message text with basic markdown-like formatting.
 * Supports:
 *   - **bold** → <strong>
 *   - *italic* → <em>
 *   - `inline code` → <code>
 *   - line breaks → <br>
 *
 * This is intentionally lightweight — no heavy markdown parser needed
 * for the assistant's current output format.
 *
 * Keys use content-based identifiers (line number + match offset + type prefix)
 * which are stable within a single render pass since the input text is immutable.
 */
function renderFormattedText(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line === undefined) continue;

    const segments: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(line);

    while (match !== null) {
      if (match.index > lastIndex) {
        segments.push(
          <span key={`${lineIdx}-t-${match.index}`}>{line.slice(lastIndex, match.index)}</span>,
        );
      }

      if (match[2]) {
        segments.push(
          <strong key={`${lineIdx}-b-${match.index}`} className="font-semibold">
            {match[2]}
          </strong>,
        );
      } else if (match[3]) {
        segments.push(
          <em key={`${lineIdx}-i-${match.index}`} className="italic">
            {match[3]}
          </em>,
        );
      } else if (match[4]) {
        segments.push(
          <code
            key={`${lineIdx}-c-${match.index}`}
            className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.8em]"
          >
            {match[4]}
          </code>,
        );
      }

      lastIndex = match.index + match[0].length;
      match = regex.exec(line);
    }

    if (lastIndex < line.length) {
      segments.push(<span key={`${lineIdx}-e-${lastIndex}`}>{line.slice(lastIndex)}</span>);
    }

    if (segments.length > 0) {
      result.push(...segments);
    } else {
      result.push(line);
    }

    if (lineIdx < lines.length - 1) {
      result.push(<br key={`${lineIdx}-br`} />);
    }
  }

  return result;
}

// ── Message Bubble ─────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessageLike;
  onCopy: (text: string) => void;
}

function MessageBubble({ message, onCopy }: MessageBubbleProps): React.ReactElement {
  const isUser = message.role === "user";
  const rawText = extractText(message);
  const displayText = stripThinkTags(rawText);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isUser
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-sm",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{renderFormattedText(displayText)}</div>

        {/* Copy button — visible on hover */}
        {!isUser && displayText.length > 0 && (
          <button
            type="button"
            onClick={() => onCopy(displayText)}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label="Copy message"
            title="Copy message"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function extractText(message: ChatMessageLike): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter((p): p is ChatMessagePart => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  return "";
}

// ── Main Component ─────────────────────────────────────────────────────

export function ChatBot(): React.ReactElement {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, error } = useChat();
  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      sendMessage({ text: trimmed });
      setInput("");
    },
    [input, isLoading, sendMessage],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [setMessages]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(text.slice(0, 20));
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // Load saved messages on mount
  useEffect(() => {
    const initial = loadInitialMessages();
    if (initial.length > 0) {
      setMessages(initial);
    }
    setIsMounted(true);
  }, [setMessages]);

  // Persist messages on change
  useEffect(() => {
    if (isMounted) {
      persistMessages(messages);
    }
  }, [messages, isMounted]);

  // Auto-scroll to bottom
  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-scroll needs to trigger on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  if (!isMounted) return <div />;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div
          className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
          role="dialog"
          aria-label="Chat assistant"
          aria-modal="false"
        >
          {/* Header */}
          <header className="flex items-center justify-between p-4 bg-zinc-900 text-white dark:bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <h3 className="font-semibold text-sm">BobSolar Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Clear Chat History"
                aria-label="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-950">
            <div className="space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-3 py-12">
                  <Bot className="w-14 h-14 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Hello! Ask me about inverter fault codes.
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      I reply in Burmese by default
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const msg = m as ChatMessageLike;
                  return <MessageBubble key={m.id} message={msg} onCopy={handleCopy} />;
                })
              )}

              {error && (
                <div className="flex justify-start" role="alert" aria-live="assertive">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm">Error: {error.message}</p>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start" role="status" aria-live="polite">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex space-x-1.5 h-5 items-center">
                      <div
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Copy confirmation toast */}
          {copiedId && (
            <div
              className="absolute top-16 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg"
              role="status"
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Copied
              </span>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800"
            aria-label="Send a message"
          >
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-950 outline-none rounded-full text-sm transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                disabled={isLoading}
                aria-label="Message input"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
          isOpen
            ? "bg-zinc-800 hover:bg-zinc-900 text-white"
            : "bg-emerald-600 hover:bg-emerald-700 text-white",
        )}
        aria-label={isOpen ? "Close chat assistant" : "Open chat assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
