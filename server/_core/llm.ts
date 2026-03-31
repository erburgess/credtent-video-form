import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!ENV.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    _client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return _client;
}

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export interface InvokeParams {
  messages: Array<{ role: string; content: string }>;
  system?: string;
  maxTokens?: number;
}

export interface InvokeResult {
  content: string;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();

  // Extract system message if present in messages array
  let systemPrompt = params.system;
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const msg of params.messages) {
    if (msg.role === "system") {
      systemPrompt = msg.content;
    } else {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      });
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens ?? 8192,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  });

  const textBlock = response.content.find(block => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return { content: textBlock.text };
}
