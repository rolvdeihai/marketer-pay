// ai-service/src/graph.ts
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { makeTools } from "./tools.js";
import { syncIndex } from "./indexer.js";
import { systemPrompt } from "./prompt.js";

type State = typeof MessagesAnnotation.State;
type AnyTool = { name: string; invoke: (input: any) => Promise<unknown> };

export function buildGraph(opts: { businessId: string | null; businessName: string | null }) {
  const tools = makeTools(opts.businessId);
  const toolsByName: Record<string, AnyTool> = Object.fromEntries(tools.map((t) => [t.name, t as unknown as AnyTool]));

  const model = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.2,
    maxRetries: 2,
  }).bindTools(tools);

  // Node 1: keep the RAG index fresh. Failure here must not break the chat.
  async function syncIndexNode(_state: State) {
    try {
      await syncIndex(20);
    } catch (e) {
      console.error("syncIndex failed:", e);
    }
    return {}; // no state change
  }

  // Node 2: ask Gemini what to do next.
  async function agentNode(state: State) {
    const response = await model.invoke([new SystemMessage(systemPrompt(opts.businessName)), ...state.messages]);
    return { messages: [response] }; // MessagesAnnotation's reducer APPENDS this
  }

  // Node 3: execute every tool call from the last AI message.
  async function toolsNode(state: State) {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    const results = await Promise.all(
      (last.tool_calls ?? []).map(async (call) => {
        const t = toolsByName[call.name];
        let output: unknown;
        try {
          output = t ? await t.invoke(call.args) : `Unknown tool: ${call.name}`;
        } catch (e) {
          output = `Tool error: ${(e as Error).message}`;
        }
        return new ToolMessage({
          content: typeof output === "string" ? output : JSON.stringify(output),
          tool_call_id: call.id ?? call.name,
          name: call.name,
        });
      }),
    );
    return { messages: results };
  }

  // Conditional edge: loop to tools if Gemini asked for any, otherwise finish.
  function route(state: State) {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return last.tool_calls && last.tool_calls.length > 0 ? "tools" : END;
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("syncIndex", syncIndexNode)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge(START, "syncIndex")
    .addEdge("syncIndex", "agent")
    .addConditionalEdges("agent", route, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}