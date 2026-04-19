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

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    if (!GOOGLE_API_KEY) throw new Error("API key missing");

    // --- Title generation (quick non-streaming) ---
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
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
        }
      );

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

    // --- Normal chat (Streaming disabled for compatibility) ---
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

    // PAKEITIMAS: Įdedame systemPrompt į pirmąją user žinutę, kad išvengtume 400 klaidos
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
      formattedMessages[0].parts[0].text = `INSTRUCTIONS: ${systemPrompt}\n\nUSER MESSAGE: ${formattedMessages[0].parts[0].text}`;
    }

    // PAKEITIMAS: v1beta + generateContent (nebe stream)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: formattedMessages
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "AI service error" }),
      };
    }

    // PAKEITIMAS: Išgauname tekstą iš JSON, nes nebe naudojame streaming
    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      statusCode: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: aiText }), // Frontend gaus objektą su { text: "atsakymas" }
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