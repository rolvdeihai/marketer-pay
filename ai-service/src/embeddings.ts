// ai-service/src/embeddings.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Must match vector(768) in schema.sql.
export const EMBED_DIM = 768;

export async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: process.env.EMBED_MODEL ?? "gemini-embedding-2",
    contents: text,
    config: { outputDimensionality: EMBED_DIM },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values) throw new Error("Embedding failed: empty response");
  return values;
}