import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";
import ollama from "ollama";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const { model, q } = req.query as { model: string; q: string };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Content-Encoding", "none");

  try {
    const specsPath = path.join(process.cwd(), "data", "car_specs.txt");
    const carSpecs = await fs.readFile(specsPath, "utf-8");

    const systemPrompt = `
You are an expert on Volvo cars. Your answers should be very short. Use the
following information to answer questions about specific Volvo models. Only
respond to questions related to the cars' specifications or features. If the
question is unrelated, say "I can only answer questions about Volvo car
specifications."

Car Specifications:
${carSpecs}

Selected car model: ${model}

User Question: ${q}
    `.trim();

    const message = { role: "user", content: systemPrompt };
    const response = await ollama.chat({ model: "phi4", messages: [message], stream: true });

    for await (const part of response) {
      const chunk = part.message.content;
      process.stdout.write(chunk); // Optional
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    process.stdout.write("\n");
    console.log("Finished streaming LLM response");
    res.write(`data: {"done": true}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.write(`data: {"error": "${(error as Error).message}"}\n\n`);
    res.end();
  }
}