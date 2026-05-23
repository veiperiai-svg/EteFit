import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-api-revision",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {
  // 1. CORS sutvarkymas
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { messages = [], userProfile, generateTitle } = body;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();

    if (!GOOGLE_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "[Klaida: 001]", details: "Netlify nustatymuose nerastas GOOGLE_API_KEY." }),
      };
    }

    // 2026-05-23: Nemokamai versijai naudojame stabiliausią prieinamą modelį
    const MODEL_ID = "gemini-2.0-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`;

    // --- IŠSAMIOS INSTRUKCIJOS (PERSONA) ---
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
- IMPORTANT: If asked for medical diagnosis, remind the user you are an AI coach and suggest consulting a doctor.`.trim();

    // Žinučių paruošimas
    let contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));
    if (contents.length > 0 && contents[0].role !== "user") contents.shift();

    console.log(`[DEBUG] Užklausa į ${MODEL_ID}...`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-revision": "2026-05-20"
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 2048,
          topP: 0.95 
        }
      }),
    });

    const data = await response.json();

    // --- DETALUS KLAIDŲ VALDYMAS ---
    if (!response.ok) {
      let errorMsg = "Nežinoma API klaida";
      if (response.status === 404) errorMsg = `[Klaida: 404] Modelis '${MODEL_ID}' nerastas arba nepasiekiamas jūsų regione.`;
      if (response.status === 429) errorMsg = "[Klaida: 429] Viršijote nemokamos versijos limitus (RPM). Palaukite minutę.";
      if (response.status === 403) errorMsg = "[Klaida: 403] API raktas neteisingas arba neturi teisių.";
      if (response.status === 503) errorMsg = "[Klaida: 503] Google serveriai šiuo metu perkrauti. Pabandykite po 30 sek.";

      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: errorMsg, details: data.error?.message }),
      };
    }

    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const aiText = candidate?.content?.parts?.[0]?.text;

    // Patikra dėl saugumo filtrų (dažna fitneso klaidų priežastis)
    if (finishReason === "SAFETY") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          text: "⚠️ Google saugumo filtrai užblokavo atsakymą (tikriausiai palaikyta per daug medicinišku). Pabandykite perfrazuoti klausimą nesinaudodami medicininiais terminais.",
          debug_reason: finishReason 
        }),
      };
    }

    if (!aiText) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          text: "Gautas tuščias atsakymas. Priežastis: " + (finishReason || "nežinoma"),
          raw_data: data 
        }),
      };
    }

    // Viskas gerai - grąžiname tekstą
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ text: aiText }),
    };

  } catch (e: any) {
    console.error("[CRITICAL ERROR]:", e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: "[Klaida: 500] Serverio klaida", 
        details: e.message 
      }),
    };
  }
};