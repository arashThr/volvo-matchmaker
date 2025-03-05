import type { NextApiRequest, NextApiResponse } from "next";

type Answers = {
  Q1: string; // 0, 1, 2
  Q2: string; // 0, 1, 2
  Q3: string[]; // Array of 0-5 (multi-select)
  Q4: string; // 0, 1, 2, 3 (Flexible added)
};

type ModelWeights = {
  Q1: number[]; // Scores for [A, B, C]
  Q2: number[]; // Scores for [A, B, C]
  Q3: number[]; // Scores for [A, B, C, D, E, F]
  style: string;
};

const models: Record<string, ModelWeights> = {
  "XC40 Recharge": {
    Q1: [3, 1, 0], // Mileage: <20, 20-50, >50
    Q2: [3, 2, 1], // Usage: City, Family, Outdoor
    Q3: [2, 1, 1, 1, 2, 1], // Features: Sustainability, Luxury, Safety, Space, Tech, Weather
    style: "SUV",
  },
  "S60": {
    Q1: [1, 3, 2],
    Q2: [3, 1, 0],
    Q3: [1, 2, 1, 0, 2, 0],
    style: "Sedan",
  },
  "XC90": {
    Q1: [0, 2, 3],
    Q2: [1, 3, 2],
    Q3: [1, 1, 2, 2, 1, 1],
    style: "SUV",
  },
  "V60 Cross Country": {
    Q1: [1, 3, 2],
    Q2: [1, 2, 3],
    Q3: [1, 0, 2, 1, 1, 2],
    style: "Wagon",
  },
};

function calculateRecommendation(answers: Answers): string {
  const { Q1, Q2, Q3, Q4 } = answers;
  const styleMap = ["Sedan", "SUV", "Wagon", "Flexible"];
  const targetStyle = styleMap[parseInt(Q4)];

  const scores: Record<string, number> = {};
  for (const [model, { Q1: w1, Q2: w2, Q3: w3 }] of Object.entries(models)) {
    let score = w1[parseInt(Q1)] + w2[parseInt(Q2)];
    if (Q3.length) {
      score += Q3.reduce((sum, i) => sum + w3[parseInt(i)], 0);
    }
    scores[model] = score;
  }

  // Filter by style if not "Flexible", otherwise include all models
  const validModels: [string, number][] = Object.entries(scores)
    .filter(([model]) => targetStyle === "Flexible" || models[model].style === targetStyle)
    .sort((a, b) => b[1] - a[1]); // Descending order

  if (!validModels.length) return "No matching Volvo found";
  return validModels[0][0];
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const answers: Answers = req.body;
      const recommendation = calculateRecommendation(answers);
      res.status(200).json({
        message: "Recommendation calculated",
        recommendation, // Single string
        answers,
      });
    } catch (error) {
      res.status(500).json({ message: "Error processing answers", error: (error as Error).message });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}