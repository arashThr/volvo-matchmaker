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
    "EX90": {
        Q1: [2, 4, 5], // 375.3 miles (300-400, strong mid-tier)
        Q2: [2, 5, 4], // City: moderate (large), Family: excellent (7 seats), Outdoor: great (AWD)
        Q3: [5, 4, 5, 5, 5, 4], // Sustainability: full electric, Luxury: award-winning, Safety: advanced suite, Space: 668 l, Tech: 5G/Google, Weather: AWD
        style: "SUV"
    },
    "EX40": {
        Q1: [2, 4, 5], // 355.4 miles (300-400, solid mid-tier)
        Q2: [4, 2, 4], // City: great (agile), Family: moderate (5 seats), Outdoor: great (AWD option)
        Q3: [5, 3, 4, 2, 4, 4], // Sustainability: full electric, Luxury: Harman Kardon, Safety: 360° camera, Space: 404 l, Tech: Google, Weather: AWD
        style: "SUV"
    },
    "EC40": {
        Q1: [2, 4, 5], // 357.9 miles (300-400, solid mid-tier)
        Q2: [4, 2, 4], // City: great (crossover), Family: moderate (5 seats), Outdoor: great (AWD option)
        Q3: [5, 3, 4, 2, 4, 4], // Sustainability: full electric, Luxury: Harman Kardon, Safety: 360° camera, Space: 404 l, Tech: Google, Weather: AWD
        style: "SUV"
    },
    "EX30": {
        Q1: [3, 2, 1], // 295.8 miles (<300, lower but functional)
        Q2: [5, 1, 3], // City: excellent (small), Family: low (5 seats, small cargo), Outdoor: good (AWD)
        Q3: [5, 2, 5, 1, 5, 3], // Sustainability: low carbon, Luxury: soundbar, Safety: 5-star NCAP, Space: 318 l, Tech: Park Pilot, Weather: AWD
        style: "SUV"
    },
    "ES90": {
        Q1: [1, 3, 5], // 435 miles (>400, top-tier)
        Q2: [4, 2, 2], // City: great (sedan), Family: moderate (5 seats), Outdoor: moderate (AWD option)
        Q3: [5, 4, 3, 3, 5, 3], // Sustainability: full electric, Luxury: premium interior, Safety: driver assistance, Space: 446 l, Tech: HD headlights/Google, Weather: AWD option
        style: "Sedan"
    },
    "XC90": {
        Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
        Q2: [2, 5, 4], // City: moderate (large), Family: excellent (7 seats), Outdoor: great (AWD)
        Q3: [3, 3, 4, 5, 4, 4], // Sustainability: hybrid, Luxury: Scandinavian design, Safety: 360° camera, Space: 668 l, Tech: Google, Weather: AWD
        style: "SUV"
    },
    "XC40": {
        Q1: [2, 4, 5], // ~350 miles effective (300-400, mild hybrid)
        Q2: [5, 2, 2], // City: excellent (compact), Family: moderate (5 seats), Outdoor: moderate (no AWD)
        Q3: [1, 3, 3, 3, 4, 1], // Sustainability: mild hybrid, Luxury: Harman Kardon, Safety: driver assistance, Space: 443 l, Tech: Google, Weather: no AWD
        style: "SUV"
    },
    "XC60": {
        Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
        Q2: [3, 4, 5], // City: good, Family: great (5 seats, 468 l), Outdoor: excellent (AWD)
        Q3: [3, 4, 4, 3, 5, 5], // Sustainability: hybrid, Luxury: Bowers & Wilkins, Safety: cross traffic, Space: 468 l, Tech: Google/head-up, Weather: AWD
        style: "SUV"
    },
    "V60": {
        Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
        Q2: [3, 4, 4], // City: good, Family: great (5 seats, 481 l), Outdoor: great (AWD)
        Q3: [3, 3, 3, 3, 4, 4], // Sustainability: hybrid, Luxury: quality materials, Safety: cross traffic, Space: 481 l, Tech: Google, Weather: AWD
        style: "Wagon"
    },
    "V90": {
        Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
        Q2: [3, 4, 5], // City: good, Family: great (5 seats, 488 l), Outdoor: excellent (AWD)
        Q3: [3, 3, 4, 4, 5, 5], // Sustainability: hybrid, Luxury: quality materials, Safety: 360° camera, Space: 488 l, Tech: Google/head-up, Weather: AWD
        style: "Wagon"
    }
}

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