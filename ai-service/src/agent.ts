// ai-service/src/agent.ts
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { buildGraph } from "./graph.js";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type AgentInput = { businessId?: string | null; businessName?: string | null; messages: ChatMsg[] };
export type AgentReply = { text: string; html: string | null };

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === "string" ? part : part?.type === "text" ? part.text ?? "" : ""))
      .join("");
  }
  return "";
}

/** Pulls the optional ```html block out of the answer. */
export function splitHtml(raw: string): AgentReply {
  const match = raw.match(/```html\s*([\s\S]*?)```/i);
  if (!match) return { text: raw.trim(), html: null };
  return { text: raw.replace(match[0], "").trim(), html: match[1].trim() };
}

export async function runAgent(input: AgentInput): Promise<AgentReply> {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("messages is required");
  }
  const graph = buildGraph({ businessId: input.businessId ?? null, businessName: input.businessName ?? null });

  // Keep the last 12 turns: enough context, bounded token cost.
  const history = input.messages
    .slice(-12)
    .map((m) => (m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content)));

  const result = await graph.invoke({ messages: history }, { recursionLimit: 16 });
  const last = result.messages[result.messages.length - 1];
  return splitHtml(contentToText(last.content));
}