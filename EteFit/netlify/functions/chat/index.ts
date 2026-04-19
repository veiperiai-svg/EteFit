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
    const { messages, userProfile, generateTitle } = event.body
      ? JSON.parse(event.body)
      : {};

    // Pridėtas .trim(), kad netyčia neatsirastų tarpų
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();

    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    // PAKEITIMAS 1: Naudojame naują, stabilų modelį
    const MODEL_ID = "gemini-1.5-flash";
    // PAKEITIMAS 2: Naudojame v1 (stabilią) versiją vietoje v1beta
    const API_BASE_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`;

    // --- Title generation (quick non-streaming) ---
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "Generate a short title (max 5 words) for this fitness chat conversation. Return ONLY the title.\n\n" +
                    convoSnippet,
                },
              ],
            },
          ],
        }),
      });

      if (!titleResp.ok) {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: messages[0]?.content?.slice(0, 40) || "Chat",
          }),
        };
      }

      const titleData = await titleResp.json();
      const title =
        titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        messages[0]?.content?.slice(0, 40) ||
        "Chat";

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      };
    }

    // --- Normal chat ---
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

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

    // Instrukcijas įdedame į pačią pirmąją vartotojo žinutę
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
      formattedMessages[0].parts[0].text = `INSTRUCTIONS FOR AI: ${systemPrompt}\n\nUSER MESSAGE: ${formattedMessages[0].parts[0].text}`;
    }

    // Naudojame tą patį API_BASE_URL (v1 versija)
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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