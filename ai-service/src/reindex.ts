// ai-service/src/reindex.ts
import "dotenv/config";
import { syncIndex } from "./indexer.js";

let total = 0;
for (;;) {
  const n = await syncIndex(50);
  total += n;
  console.log(`indexed ${n} (total ${total})`);
  if (n === 0) break;
}
console.log("done");