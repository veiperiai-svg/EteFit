import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-api-revision",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };

  try {
    const body = JSON.parse(event.body || "{}");
    const { messages = [], userProfile, generateTitle } = body;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();

    if (!GOOGLE_API_KEY) throw new Error("API KEY MISSING");

    // NAUDOJAME MODELĮ IŠ TAVO GRAFIKO
    const MODEL_ID = "gemini-3.5-flash"; 
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
USER PROFILE (use this to personalize all advice):
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
- IMPORTANT: If asked for medical diagnosis, remind the user you are an AI coach and suggest professional medical consultation.`.trim();

    // --- TITLE GENERATION (Tik jei prašoma atskirai) ---
    if (generateTitle) {
      const lastMsg = messages[messages.length - 1]?.content || "New Chat";
      const titleResp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "3 word title for: " + lastMsg }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      const tData = await titleResp.json();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ title: tData.candidates?.[0]?.content?.parts?.[0]?.text || "Chat" })
      };
    }

    // --- PAGRINDINIS CHAT ---
    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ text: "Sveiki! Aš esu EteFit. Kaip galiu padėti jūsų sporto kelyje šiandien?" }),
      };
    }

    // Gemini reikalauja user/model sekos. Siunčiame tik paskutines 8 žinutes (taupome Tokenus).
    let contents = messages.slice(-8).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

    if (contents[0].role !== "user") contents.shift();

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-revision": "2026-05-20"
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      }),
    });

    const data = await response.json();

    // Jei gauname 429 klaidą (kaip tavo nuotraukoje)
    if (response.status === 429) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          text: "⚠️ EteFit šiuo metu pasiekė nemokamos versijos limitą (429 Too Many Requests). Google leidžia tik kelias užklausas per minutę. Prašome palaukti 60 sekundžių." 
        }),
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error?.message || "API Klaida" }),
      };
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Atsiprašau, įvyko klaida.";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ text: aiText }),
    };

  } catch (e: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message }),
    };
  }
};