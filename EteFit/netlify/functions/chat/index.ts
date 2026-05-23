import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-api-revision",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };

  try {
    const body = JSON.parse(event.body || "{}");
    const { messages = [], userProfile, generateTitle } = body;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();

    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    /**
     * 2026 m. GEGUŽĖS STATUSAS:
     * - gemini-1.5-flash: IŠJUNGTAS (Shut down)
     * - gemini-2.0-flash: STABILUS (Rekomenduojamas nemokamam planui)
     * - gemini-3.5-flash: NAUJAS (Gali būti ribojamas nemokamiems vartotojams)
     */
    const MODEL_ID = "gemini-2.0-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`;

    // --- TAVO IŠSAMIOS INSTRUKCIJOS (PERSONA) ---
    const systemPrompt = `
You are EteFit, an expert AI fitness and health coach. You provide personalized, evidence-based advice on:
- Workout programming (strength, cardio, flexibility, sport-specific)
- Nutrition and meal planning
- Recovery, sleep optimization, and stress management
- Injury prevention and rehabilitation guidance
- Habit building and motivation

${userProfile ? `
USER PROFILE:
- Height: ${userProfile.height || "Not provided"}
- Weight: ${userProfile.weight || "Not provided"}
- Age: ${userProfile.age || "Not provided"}
- Activity level: ${userProfile.activity || "Not provided"}
- Fitness goal: ${userProfile.goal || "Not provided"}
` : "No user profile provided — give general advice."}

GUIDELINES:
- Be encouraging but honest
- Use markdown formatting for clarity
- Use emojis sparingly
- Provide specific sets, reps, durations when relevant
- Tailor advice based on conversation
- IMPORTANT: If asked for medical diagnosis, suggest professional medical consultation.`.trim();

    // --- PAGRINDINIS POKALBIS ---
    if (messages.length === 0 && !generateTitle) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ text: "Sveiki! Aš esu EteFit. Kaip galiu padėti?" }),
      };
    }

    let contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));
    if (contents.length > 0 && contents[0].role !== "user") contents.shift();

    // --- RETRY LOGIKA (Sprendžia 429 klaidą) ---
    let response;
    let data;
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      console.log(`[DEBUG] Bandymas ${retries + 1} su ${MODEL_ID}...`);
      
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: generateTitle ? [{ role: "user", parts: [{ text: "Generate 3-5 word title for this: " + messages[messages.length-1].content }] }] : contents,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        }),
      });

      data = await response.json();
      if (response.status === 429) {
        await wait(2000);
        retries++;
      } else {
        break;
      }
    }

    if (!response || !response.ok) {
      const errorMsg = response?.status === 429 ? "Viršyti limitai. Palaukite 1 min." : (data.error?.message || "API Error");
      return {
        statusCode: response?.status || 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: errorMsg }),
      };
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Atsiprašau, įvyko klaida.";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(generateTitle ? { title: aiText } : { text: aiText }),
    };

  } catch (e: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message }),
    };
  }
};