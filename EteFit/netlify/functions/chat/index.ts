import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
    };
  }

  try {
    // PAKEITIMAS 1: Saugus duomenų išpakavimas (apsaugo nuo "TypeError: map" klaidos)
    const body = event.body ? JSON.parse(event.body) : {};
    const messages = body.messages || []; 
    const userProfile = body.userProfile;
    const generateTitle = body.generateTitle;

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();
    
      console.log("--- DEBUG INFORMACIJA ---");
    console.log("Raktas Netlify nustatymuose:", GOOGLE_API_KEY ? "RASTAS" : "NERASTAS");
    if (GOOGLE_API_KEY) {
      console.log("Rakto pradžia (pirmi 6 simboliai):", GOOGLE_API_KEY.substring(0, 6));
    }
    console.log("--------------------------");

    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    // PAKEITIMAS 2: Naudojame v1beta ir gemini-1.5-flash (šis derinys stabiliausias nemokamiems raktams)
    const MODEL_ID = "gemini-1.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`;

    // --- Title generation ---
    if (generateTitle && messages.length >= 2) {
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
            parts: [{ text: "Generate a short title (max 5 words) for this chat conversation:\n\n" + convoSnippet }]
          }],
        }),
      });

      if (titleResp.ok) {
        const titleData = await titleResp.json();
        const title = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Chat";
        return {
          statusCode: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        };
      }
    }

    // --- Normal chat ---
    // PAKEITIMAS 3: Gemini rolių formatavimas (assistant -> model)
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

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
` : "No user profile provided."}

GUIDELINES: Be encouraging, use markdown, emojis sparingly.`.trim();

    // Įdedame instrukciją į pirmąją user žinutę (išvengiame 400 klaidos)
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
      formattedMessages[0].parts[0].text = `SYSTEM INSTRUCTIONS: ${systemPrompt}\n\nUSER MESSAGE: ${formattedMessages[0].parts[0].text}`;
    }

    // PAKEITIMAS 4: Užklausa be streaming (kad Netlify Functions veiktų patikimai)
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: formattedMessages
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "AI service error", details: errorText }),
      };
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Grąžiname atsakymą JSON formatu
    return {
      statusCode: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: aiText }),
    };
  } catch (e: any) {
    console.error("chat error:", e);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message || "Unknown error" }),
    };
  }
};

export { handler };