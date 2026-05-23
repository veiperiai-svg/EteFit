import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-goog-api-revision",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handler: Handler = async (event) => {
  // 1. CORS Preflight (Būtina naršyklei)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // 2. Duomenų paruošimas
    const body = event.body ? JSON.parse(event.body) : {};
    const { messages = [], userProfile, generateTitle } = body;

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();
    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    /** 
     * MODELIO PARINKIMAS (2026 m. Gegužė)
     * Jei gemini-3.5-flash meta 404, Google tikriausiai reikalauja specifinės versijos.
     * Naudojame stabiliausią šios dienos ID.
     */
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
- Tailor advice based on conversation`.trim();

    // --- TITLE GENERATION DALIS ---
    if (generateTitle && messages.length >= 1) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: "Generate a short title (max 5 words) for this fitness chat conversation. Return ONLY the title text:\n\n" + convoSnippet }]
          }],
        }),
      });

      if (titleResp.ok) {
        const titleData = await titleResp.json();
        const title = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Chat";
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ title }),
        };
      }
    }

    // --- PAGRINDINIS POKALBIS ---
    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ text: "Sveiki! Aš esu EteFit. Kaip galiu padėti jūsų sporto kelyje šiandien?" }),
      };
    }

    // Formatuojame žinutes (Gemini reikalauja: user -> model -> user)
    let formattedMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

    // Užtikriname, kad seka prasidėtų nuo vartotojo (user)
    if (formattedMessages.length > 0 && formattedMessages[0].role !== "user") {
      formattedMessages.shift();
    }

    console.log(`[DEBUG] Kreipiamės į Google API (${MODEL_ID})...`);
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-revision": "2026-05-20" // Reikalaujama 2026 m. gegužės mėnesį
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: formattedMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await response.json();

    // Jei gauname 404 arba bet kokią kitą klaidą iš Google
    if (!response.ok) {
      console.error("[DEBUG] Google API Klaida:", JSON.stringify(data));
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: "Model error", 
          details: data.error?.message || "Check if model ID is correct for May 2026." 
        }),
      };
    }

    // Paimame AI tekstą
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ text: "Atsiprašau, bet negaliu sugeneruoti atsakymo. Bandykite dar kartą." }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ text: aiText }),
    };

  } catch (e: any) {
    console.error("[DEBUG] Serverio klaida:", e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message || "Unknown error" }),
    };
  }
};

export { handler };