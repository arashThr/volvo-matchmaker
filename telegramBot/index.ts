import TelegramBot from "node-telegram-bot-api";
import fs from "fs/promises";
import path from "path";
import ollama from "ollama";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.BOT_TOKEN as string;
const bot = new TelegramBot(TOKEN, { polling: true });

type Answers = {
  Q1: string;
  Q2: string;
  Q3: string[];
  Q4: string;
  recommendation?: string;
  questionCount?: number; // Track follow-up questions
};

const userStates: Record<number, Answers> = {};
const messageIds: Record<number, number> = {}; // Store message IDs for question edits
const answerMessageIds: Record<number, number> = {}; // Store message IDs for follow-up answers

type ModelWeights = {
  Q1: number[];
  Q2: number[];
  Q3: number[];
  style: string;
};

const models: Record<string, ModelWeights> = {
  'ex90-electric': {
    Q1: [2, 4, 5], // 375.3 miles (300-400, strong mid-tier)
    Q2: [1, 5, 4], // City: moderate (large), Family: excellent (7 seats), Outdoor: great (AWD)
    Q3: [5, 4, 5, 5, 5, 4], // Sustainability: full electric, Luxury: award-winning, Safety: advanced suite, Space: 668 l, Tech: 5G/Google, Weather: AWD
    style: 'SUV',
  },
  'ex40-electric': {
    Q1: [2, 4, 5], // 355.4 miles (300-400, solid mid-tier)
    Q2: [4, 2, 4], // City: great (agile), Family: moderate (5 seats), Outdoor: great (AWD option)
    Q3: [5, 3, 4, 2, 4, 4], // Sustainability: full electric, Luxury: Harman Kardon, Safety: 360° camera, Space: 404 l, Tech: Google, Weather: AWD
    style: 'SUV',
  },
  'ec40-electric': {
    Q1: [2, 4, 5], // 357.9 miles (300-400, solid mid-tier)
    Q2: [4, 2, 4], // City: great (crossover), Family: moderate (5 seats), Outdoor: great (AWD option)
    Q3: [5, 3, 4, 2, 4, 4], // Sustainability: full electric, Luxury: Harman Kardon, Safety: 360° camera, Space: 404 l, Tech: Google, Weather: AWD
    style: 'SUV',
  },
  'ex30-electric': {
    Q1: [3, 2, 1], // 295.8 miles (<300, lower but functional)
    Q2: [5, 1, 3], // City: excellent (small), Family: low (5 seats, small cargo), Outdoor: good (AWD)
    Q3: [5, 2, 5, 1, 5, 3], // Sustainability: low carbon, Luxury: soundbar, Safety: 5-star NCAP, Space: 318 l, Tech: Park Pilot, Weather: AWD
    style: 'SUV',
  },
  'es90-electric': {
    Q1: [1, 3, 5], // 435 miles (>400, top-tier)
    Q2: [4, 2, 2], // City: great (sedan), Family: moderate (5 seats), Outdoor: moderate (AWD option)
    Q3: [5, 4, 3, 3, 5, 3], // Sustainability: full electric, Luxury: premium interior, Safety: driver assistance, Space: 446 l, Tech: HD headlights/Google, Weather: AWD option
    style: 'Sedan',
  },
  'xc90-hybrid': {
    Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
    Q2: [2, 5, 4], // City: moderate (large), Family: excellent (7 seats), Outdoor: great (AWD)
    Q3: [3, 3, 4, 5, 4, 4], // Sustainability: hybrid, Luxury: Scandinavian design, Safety: 360° camera, Space: 668 l, Tech: Google, Weather: AWD
    style: 'SUV',
  },
  'xc40': {
    Q1: [2, 4, 5], // ~350 miles effective (300-400, mild hybrid)
    Q2: [5, 2, 2], // City: excellent (compact), Family: moderate (5 seats), Outdoor: moderate (no AWD)
    Q3: [1, 3, 3, 3, 4, 1], // Sustainability: mild hybrid, Luxury: Harman Kardon, Safety: driver assistance, Space: 443 l, Tech: Google, Weather: no AWD
    style: 'SUV',
  },
  'xc60-hybrid': {
    Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
    Q2: [3, 4, 5], // City: good, Family: great (5 seats, 468 l), Outdoor: excellent (AWD)
    Q3: [3, 4, 4, 3, 5, 5], // Sustainability: hybrid, Luxury: Bowers & Wilkins, Safety: cross traffic, Space: 468 l, Tech: Google/head-up, Weather: AWD
    style: 'SUV',
  },
  'v60-hybrid': {
    Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
    Q2: [3, 4, 4], // City: good, Family: great (5 seats, 481 l), Outdoor: great (AWD)
    Q3: [3, 3, 3, 3, 4, 4], // Sustainability: hybrid, Luxury: quality materials, Safety: cross traffic, Space: 481 l, Tech: Google, Weather: AWD
    style: 'Wagon',
  },
  'v90-hybrid': {
    Q1: [2, 4, 5], // ~350 miles effective (300-400, hybrid bonus)
    Q2: [3, 4, 5], // City: good, Family: great (5 seats, 488 l), Outdoor: excellent (AWD)
    Q3: [3, 3, 4, 4, 5, 5], // Sustainability: hybrid, Luxury: quality materials, Safety: 360° camera, Space: 488 l, Tech: Google/head-up, Weather: AWD
    style: 'Wagon',
  },
};

// Helper function to log with timestamp and user details
const log = (message: string, chatId: number, userInfo: string, extra?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Chat ${chatId}: ${message} (${userInfo})`, extra || "");
};

function calculateRecommendation(answers: Answers): string {
  const { Q1, Q2, Q3, Q4 } = answers;
  const styleMap = ["Sedan", "SUV", "Wagon", "Flexible"];
  const targetStyle = styleMap[parseInt(Q4)];

  const scores: Record<string, number> = {};
  for (const [model, { Q1: w1, Q2: w2, Q3: w3 }] of Object.entries(models)) {
    let score = w1[parseInt(Q1)] * 2 + w2[parseInt(Q2)] * 2; // Double Q1 and Q2
    if (Q3.length) {
      score += Q3.reduce((sum, i) => sum + w3[parseInt(i)], 0); // Q3 unchanged
    }
    scores[model] = score;
  }

  const validModels: [string, number][] = Object.entries(scores)
    .filter(([model]) => targetStyle === "Flexible" || models[model].style === targetStyle)
    .sort((a, b) => b[1] - a[1]);

  if (!validModels.length) return "No matching Volvo found";
  return validModels[0][0];
}

async function askLLM(model: string, question: string): Promise<string> {
  const specsPath = path.join(process.cwd(), "data", "car_specs.txt");
  const carSpecs = await fs.readFile(specsPath, "utf-8");

  const systemPrompt = `
You are an expert on Volvo cars. Your answers should be very short. Use the
following information to answer questions about specific Volvo models. Only
respond to questions related to the cars' specifications or features. If the
question is unrelated, say "I can only answer questions about Volvo car
specifications." NEVER EVER ANSWER UNRELATED QUESTION. In your answers,
if the models is not specified, assume it's the given model.

Car Specifications:
${carSpecs}

Selected car model: ${model}

User Question: ${question}
  `.trim();

  const message = { role: "user", content: systemPrompt };
  const response = await ollama.chat({ model: "phi4", messages: [message], stream: false });
  return response.message.content;
}

// Generate Q3 keyboard with selected options marked
function generateQ3Keyboard(selected: string[]): TelegramBot.InlineKeyboardButton[][] {
  const options = [
    { text: "🌿 Sustainability", value: "0" },
    { text: "💎 Luxury", value: "1" },
    { text: "🛡️ Safety", value: "2" },
    { text: "📏 Space", value: "3" },
    { text: "📱 Tech", value: "4" },
    { text: "☔ All Weather", value: "5" },
  ];

  return [
    [
      { text: selected.includes("0") ? `${options[0].text} ✅` : options[0].text, callback_data: "Q3_0" },
      { text: selected.includes("1") ? `${options[1].text} ✅` : options[1].text, callback_data: "Q3_1" },
    ],
    [
      { text: selected.includes("2") ? `${options[2].text} ✅` : options[2].text, callback_data: "Q3_2" },
      { text: selected.includes("3") ? `${options[3].text} ✅` : options[3].text, callback_data: "Q3_3" },
    ],
    [
      { text: selected.includes("4") ? `${options[4].text} ✅` : options[4].text, callback_data: "Q3_4" },
      { text: selected.includes("5") ? `${options[5].text} ✅` : options[5].text, callback_data: "Q3_5" },
    ],
    [{ text: "✅ Done", callback_data: "Q3_done" }],
  ];
}

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userInfo = `${msg.chat.first_name || ""} ${msg.chat.last_name || ""} (${msg.chat.username || "no username"})`;
  log("User started the bot", chatId, userInfo);
  userStates[chatId] = { Q1: "", Q2: "", Q3: [], Q4: "", questionCount: 0 };
  const sentMessage = await bot.sendMessage(chatId, "🚗 *How much do you drive daily?* 🌟", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚙 Less than 20 miles", callback_data: "Q1_0" }],
        [{ text: "🛣️ 20-50 miles", callback_data: "Q1_1" }],
        [{ text: "🏞️ More than 50 miles", callback_data: "Q1_2" }],
      ],
    },
  });
  messageIds[chatId] = sentMessage.message_id; // Store the message ID for editing
});

// Handle all button interactions
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;
  const messageId = messageIds[chatId]; // Use stored message ID for questions
  if (!messageId) return;

  const state = userStates[chatId];
  const data = callbackQuery.data;
  if (!data) return;

  const userInfo = `${callbackQuery.from.first_name || ""} ${callbackQuery.from.last_name || ""} (${callbackQuery.from.username || "no username"})`;
  const [question, value] = data.split("_");

  if (question === "Q1" && !state.Q1) {
    state.Q1 = value;
    log("Q1 answered", chatId, userInfo, { answer: ["Less than 20 miles", "20-50 miles", "More than 50 miles"][parseInt(value)] });
    await bot.editMessageText("🌆 *What’s your primary usage?* ✨", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏙️ City commuting", callback_data: "Q2_0" }],
          [{ text: "👨‍👩‍👧 Family trips", callback_data: "Q2_1" }],
          [{ text: "⛰️ Outdoor adventures", callback_data: "Q2_2" }],
        ],
      },
    });
  } else if (question === "Q2" && !state.Q2) {
    state.Q2 = value;
    log("Q2 answered", chatId, userInfo, { answer: ["City commuting", "Family trips", "Outdoor adventures"][parseInt(value)] });
    await bot.editMessageText("🔧 *What features matter to you?* (Pick all that apply) 🎨", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: generateQ3Keyboard(state.Q3) },
    });
  } else if (question === "Q3" && !state.Q4) {
    if (value === "done") {
      log("Q3 completed", chatId, userInfo, { selected: state.Q3.map(i => ["Sustainability", "Luxury", "Safety", "Space", "Tech", "Weather"][parseInt(i)]) });
      await bot.editMessageText("🚘 *What style do you prefer?* 🎉", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚗 Sedan", callback_data: "Q4_0" }],
            [{ text: "🚙 SUV/Crossover", callback_data: "Q4_1" }],
            [{ text: "🛒 Wagon", callback_data: "Q4_2" }],
            [{ text: "🔄 Flexible", callback_data: "Q4_3" }],
          ],
        },
      });
    } else if (!state.Q3.includes(value)) {
      state.Q3.push(value);
      const selectedFeature = ["Sustainability", "Luxury", "Safety", "Space", "Tech", "Weather"][parseInt(value)];
      log("Q3 feature selected", chatId, userInfo, { feature: selectedFeature });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: generateQ3Keyboard(state.Q3) },
        { chat_id: chatId, message_id: messageId }
      );
      bot.answerCallbackQuery(callbackQuery.id, { text: `${selectedFeature} added! ✅` });
    } else {
      bot.answerCallbackQuery(callbackQuery.id, { text: "Already selected! 😊" });
    }
  } else if (question === "Q4" && !state.Q4) {
    state.Q4 = value;
    const recommendation = calculateRecommendation(state);
    state.recommendation = recommendation;
    log("Q4 answered and recommendation generated", chatId, userInfo, { style: ["Sedan", "SUV/Crossover", "Wagon", "Flexible"][parseInt(value)], recommendation });
    await bot.editMessageText(
      `🎉 *Your recommended Volvo is: ${recommendation}!* 🎊\nAsk me anything about it! (e.g., "What colors are available?")`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      }
    );
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// Handle follow-up questions as separate messages with a limit
const MAX_QUESTIONS = 5; // Limit to 5 follow-up questions
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  const state = userStates[chatId];
  if (state?.recommendation) {
    const userInfo = `${msg.chat.first_name || ""} ${msg.chat.last_name || ""} (${msg.chat.username || "no username"})`;
    state.questionCount = state.questionCount || 0;

    if (state.questionCount >= MAX_QUESTIONS) {
      log("Follow-up question limit reached", chatId, userInfo, { question: text });
      await bot.sendMessage(chatId, "🚫 *Sorry, you've reached the limit of 5 questions about this Volvo.* Start again with /start if you'd like a new recommendation!", { parse_mode: "Markdown" });
      return;
    }

    log("Follow-up question asked", chatId, userInfo, { question: text, questionCount: state.questionCount + 1 });
    
    // Send "Looking for answer..." message
    const lookingMessage = await bot.sendMessage(chatId, "🔍 *Looking for answer...* 🔍", { parse_mode: "Markdown" });
    answerMessageIds[chatId] = lookingMessage.message_id; // Store the message ID to edit later

    bot.sendChatAction(chatId, "typing");
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Original typing delay
    const answer = await askLLM(state.recommendation, text);
    log("Follow-up question answered", chatId, userInfo, { answer, questionCount: state.questionCount + 1 });

    // Override "Looking for answer..." with the actual answer
    await bot.editMessageText(
      `💬 *Answer:* ${answer} 🌟`,
      {
        chat_id: chatId,
        message_id: answerMessageIds[chatId],
        parse_mode: "Markdown",
      }
    );
    
    state.questionCount++; // Increment question count
  }
});

console.log("Bot is running... 🚀");