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

    if (!GOOGLE_API_KEY) throw new Error("API_KEY_MISSING");

    // 2026-05-23: Nemokamam planui stabiliausias pasirinkimas per apkrovas
    const MODEL_ID = "gemini-2.0-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`;

    // --- IŠSAMIOS INSTRUKCIJOS (TAVO PERSONA) ---
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

    // Žinučių paruošimas
    let contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));
    if (contents.length > 0 && contents[0].role !== "user") contents.shift();

    // --- TITLE GENERATION AR CHAT ---
    const payload = generateTitle 
      ? { contents: [{ role: "user", parts: [{ text: "Generate 3-word title for: " + messages[messages.length-1]?.content }] }] }
      : { 
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        };

    // --- RETRY LOGIKA SU ILGESNIU LAUKIMU ---
    let response;
    let data;
    let retries = 0;
    const maxRetries = 1; // Bandome tik vieną papildomą kartą, kad neperkrautume Netlify

    while (retries <= maxRetries) {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      data = await response.json();

      if (response.status === 429) {
        console.warn(`[429] Limitai pasiekti. Bandymas ${retries + 1}/${maxRetries}. Laukiame 5s...`);
        await wait(5000); // 2026 m. nemokamai versijai reikia bent 5s pauzės tarp bandymų
        retries++;
        continue;
      }
      break;
    }

    // --- KLAIDŲ APDOROJIMAS ---
    if (!response || !response.ok) {
      // Jei vis tiek 429, grąžiname 200 su klaidos pranešimu (kad front-end neužstrigtų)
      if (response?.status === 429) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            text: "⚠️ Šiuo metu EteFit yra labai užimtas (nemokamos versijos limitas). Prašome palaukti lygiai 1 minutę ir bandyti dar kartą." 
          }),
        };
      }
      return {
        statusCode: response?.status || 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: data?.error?.message || "API Error" }),
      };
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Atsiprašau, įvyko klaida generuojant atsakymą.";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(generateTitle ? { title: aiText } : { text: aiText }),
    };

  } catch (e: any) {
    console.error("Klaida:", e.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Serverio klaida", details: e.message }),
    };
  }
};