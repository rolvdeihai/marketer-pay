// ai-service/src/dev-server.ts
import "dotenv/config"; // must be the first import: loads .env before anything reads process.env
import http from "node:http";
import { runAgent } from "./agent.js";

const port = Number(process.env.PORT ?? 8787);

http
  .createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== "/api/agent") return send(404, { error: "not found" });
    if (req.headers["x-internal-key"] !== process.env.AI_SERVICE_KEY) return send(403, { error: "forbidden" });

    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      const reply = await runAgent(JSON.parse(raw));
      send(200, reply);
    } catch (e) {
      console.error(e);
      send(500, { error: (e as Error).message });
    }
  })
  .listen(port, () => console.log(`AI dev server on http://192.168.1.229:${port}/api/agent`));