// ai-service/api/agent.ts
import { runAgent } from "../src/agent.js";

// Vercel Node functions support Web-standard handlers: export one per HTTP method.
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("x-internal-key") !== process.env.AI_SERVICE_KEY) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const reply = await runAgent(body);
    return Response.json(reply);
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}