"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { Bot, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Load initial messages from localStorage
const getInitialMessages = (): UIMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("bobsolar-chat-history");
    return saved ? JSON.parse(saved) : [];
  } catch (_e) {
    return [];
  }
};

export function ChatBot() {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function renderTextWithThink(text: string) {
    // Strip everything between <think> and </think>, including the tags themselves.
    // Also remove incomplete <think> tags at the end of the text if it's still streaming.
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*$/gi, "")
      .trim();
  }

  const { messages, sendMessage, status, setMessages, error } = useChat();

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  useEffect(() => {
    const initial = getInitialMessages();
    if (initial.length > 0) {
      setMessages(initial);
    }
    setIsMounted(true);
  }, [setMessages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("bobsolar-chat-history", JSON.stringify(messages));
    }
  }, [messages, isMounted]);

  // Empty since we moved setIsMounted up

  // Auto scroll to bottom
  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-scroll needs to trigger on messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("bobsolar-chat-history");
  };

  if (!isMounted) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-zinc-900 text-white dark:bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-sm">BobSolar Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearHistory}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-white"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
                <Bot className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm text-center">
                  Hello! Ask me about inverter fault codes.
                  <br />
                  (I reply in Burmese by default)
                </p>
              </div>
            ) : (
              messages.map((m: UIMessage) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      m.role === "user"
                        ? "bg-emerald-600 text-white rounded-tr-sm"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {(() => {
                      if (m.parts) {
                        return m.parts.map((part) => {
                          if (part.type !== "text") return null;
                          return (
                            <div
                              key={`${m.id}-${part.type}-${part.text.substring(0, 10)}`}
                              className="text-sm whitespace-pre-wrap"
                            >
                              {renderTextWithThink(part.text)}
                            </div>
                          );
                        });
                      }

                      // biome-ignore lint/suspicious/noExplicitAny: fallback for older message formats
                      const msgAny = m as any;
                      const textToRender = (msgAny.text as string) || (msgAny.content as string);
                      if (textToRender) {
                        return (
                          <div className="text-sm whitespace-pre-wrap">
                            {renderTextWithThink(textToRender)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))
            )}
            {error && (
              <div className="flex justify-start">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
                  <p className="text-sm">Error: {error.message}</p>
                </div>
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
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

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-950 outline-none rounded-full text-sm transition-all text-zinc-900 dark:text-zinc-100"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-full transition-colors flex-shrink-0"
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
        className={`p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center ${
          isOpen
            ? "bg-zinc-800 hover:bg-zinc-900 text-white"
            : "bg-emerald-600 hover:bg-emerald-700 text-white"
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
