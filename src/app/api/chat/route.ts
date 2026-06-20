import fs from "node:fs";
import path from "node:path";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Load knowledge base
  const kbPath = path.join(process.cwd(), "docs", "Knowledge_base.md");
  const kbContent = fs.readFileSync(kbPath, "utf-8");

  const systemPrompt = `You are a specialized BobSolar technician assistant chatbot.
Your primary role is to diagnose inverter fault codes using ONLY the provided knowledge base.

Instructions:
1. First, think step-by-step about the user's problem. Output your internal reasoning inside <think>...</think> tags. The user will NOT see this thinking process, so use it freely to analyze the document.
2. Then, provide your final response to the user.
3. If the user asks for a fault code, search the provided knowledge base tables carefully. Note that fault codes in the document may have footnote numbers attached to them (e.g., "**F20**6" means F20, "**039**4" means 039). Ignore these footnote numbers when matching the user's query.
4. If the fault code exists in the knowledge base, provide the Meaning, Causes, Action Plan, and Danger Level. Structure your answer clearly.
5. If the user asks about a fault code that is DEFINITELY NOT in the knowledge base, reply politely: 'I do not have information on this fault code in my current knowledge base.' and DO NOT guess.
6. If the user says a general greeting or asks a general question, greet them back and ask how you can help with inverter diagnostics.
7. Answer in Burmese by default for the final response, unless requested in English. The <think> tags can be in English.

--- KNOWLEDGE BASE ---
${kbContent}
--- END KNOWLEDGE BASE ---
`;

  const result = await streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[Chat API Error]:", error);
      return String(error); // Forward error message to the client
    },
  });
}
