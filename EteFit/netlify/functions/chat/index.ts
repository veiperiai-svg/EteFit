import { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const { messages, userProfile, generateTitle } = JSON.parse(event.body || "{}");
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    // --- 1. TITLE GENERATION (Jei generuojame pavadinimą) ---
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: "Generate a short title (max 5 words) for this fitness chat conversation. Return ONLY the title.\n\n" + convoSnippet }]
            }]
          }),
        }
      );

      const titleData = await titleResp.json();
      const title = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Chat";

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.replace(/[*"]/g, "") }),
      };
    }

    // --- 2. NORMAL CHAT (Pagrindinis robotas) ---

    // Paruošiame tavo specifinę sisteminę instrukciją
    const systemPromptText = `
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
`.trim();

    // Svarbu: Konvertuojame žinutes į Gemini formatą (assistant -> model)
    const geminiHistory = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPromptText }]
          },
          contents: geminiHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      
      if (response.status === 429) {
        return {
          statusCode: 429,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Rate limit exceeded. Please try again in 1 minute." })
        };
      }
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "AI service error" })
      };
    }
<<<<<<< HEAD

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

=======
    // Streaming response
>>>>>>> bbc5ef003ac987f6d6877da1357aea844065edcb
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ text: aiText }),
    };

  } catch (e: any) {
    console.error("Chat error:", e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message || "Unknown error" }),
    };
  }
};