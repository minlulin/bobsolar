import { DefaultChatTransport, type UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ChatBot transport — conversationId persistence", () => {
  let originalLocalStorage: Storage;
  let conversationIdRef: { current: string | null };
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    // Mock window to bypass Next.js SSR check
    // @ts-expect-error - mock window for testing
    global.window = {};

    conversationIdRef = { current: null };
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    // @ts-expect-error - clean up window mock
    delete global.window;
    vi.restoreAllMocks();
  });

  function createFetchInterceptor(mockFetch: typeof fetch) {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await mockFetch(input, init);
      const conversationId = response.headers.get("X-Chat-Conversation-Id");
      if (conversationId) {
        conversationIdRef.current = conversationId;
        if (typeof window !== "undefined") {
          localStorage.setItem("bobsolar-chat-conversation-id", conversationId);
        }
      }
      return response;
    };
  }

  function createTransport(mockFetch: typeof fetch) {
    return new DefaultChatTransport({
      fetch: createFetchInterceptor(mockFetch),
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          ...body,
          conversationId: conversationIdRef.current,
          messages,
        },
      }),
    });
  }

  it("captures conversationId from response headers on first request", async () => {
    const mockResponse = new Response(new ReadableStream(), {
      headers: { "X-Chat-Conversation-Id": "conv-from-server-123" },
    });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    const interceptor = createFetchInterceptor(mockFetch as unknown as typeof fetch);
    await interceptor("/api/chat", {});

    expect(conversationIdRef.current).toBe("conv-from-server-123");
    expect(localStorage.getItem("bobsolar-chat-conversation-id")).toBe("conv-from-server-123");
  });

  it("uses captured conversationId for subsequent requests", async () => {
    const mockResponse = new Response(new ReadableStream(), {
      headers: { "X-Chat-Conversation-Id": "conv-from-server-123" },
    });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    const transport = createTransport(mockFetch as unknown as typeof fetch);

    // First request - captures conversationId
    const interceptor = createFetchInterceptor(mockFetch as unknown as typeof fetch);
    await interceptor("/api/chat", {});

    // Verify conversationId was captured
    expect(conversationIdRef.current).toBe("conv-from-server-123");

    // Second request - prepareSendMessagesRequest will be called by the transport.
    // We can cast the protected method to test it:
    const prepare = (
      transport as unknown as {
        prepareSendMessagesRequest: (options: {
          messages: UIMessage[];
          body: Record<string, unknown>;
        }) => { body: { conversationId: string | null } };
      }
    ).prepareSendMessagesRequest;
    const prepared = prepare({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] } as UIMessage],
      body: {},
    });

    expect(prepared.body.conversationId).toBe("conv-from-server-123");
  });

  it("persists conversationId in localStorage for reload", async () => {
    const mockResponse = new Response(new ReadableStream(), {
      headers: { "X-Chat-Conversation-Id": "conv-from-server-123" },
    });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    const interceptor = createFetchInterceptor(mockFetch as unknown as typeof fetch);
    await interceptor("/api/chat", {});

    // Simulate page reload - conversationIdRef is reset but localStorage persists
    conversationIdRef.current = null;

    // On remount, the component reads from localStorage
    const savedId = localStorage.getItem("bobsolar-chat-conversation-id");
    conversationIdRef.current = savedId;

    expect(conversationIdRef.current).toBe("conv-from-server-123");
  });

  it("handles response without X-Chat-Conversation-Id header gracefully", async () => {
    const responseWithoutHeader = new Response(new ReadableStream());
    const mockFetch = vi.fn().mockResolvedValue(responseWithoutHeader);

    const interceptor = createFetchInterceptor(mockFetch as unknown as typeof fetch);
    await interceptor("/api/chat", {});

    expect(conversationIdRef.current).toBeNull();
    expect(localStorage.getItem("bobsolar-chat-conversation-id")).toBeNull();
  });

  it("handles missing localStorage (SSR) gracefully", async () => {
    const mockResponse = new Response(new ReadableStream(), {
      headers: { "X-Chat-Conversation-Id": "conv-from-server-123" },
    });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    // Simulate SSR where window is undefined
    // @ts-expect-error - delete window for SSR test
    delete global.window;

    const interceptor = createFetchInterceptor(mockFetch as unknown as typeof fetch);
    await interceptor("/api/chat", {});

    expect(conversationIdRef.current).toBe("conv-from-server-123");
  });
});
