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

    // API key iš header arba env
    const OPENROUTER_API_KEY =
  event.headers["apikey"] || process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) throw new Error("API key missing");

    // --- Title generation (quick non-streaming) ---
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
"HTTP-Referer": "https://etefit.netlify.app",
"X-Title": "EteFit AI Coach",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content:
                  "Generate a short title (max 5 words) for this fitness chat conversation. Return ONLY the title, nothing else. No quotes, no punctuation at the end.",
              },
              { role: "user", content: convoSnippet },
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
        titleData.choices?.[0]?.message?.content?.trim() ||
        messages[0]?.content?.slice(0, 40) ||
        "Chat";

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      };
    }

    // --- Normal chat ---
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
"HTTP-Referer": "https://etefit.netlify.app",
"X-Title": "EteFit AI Coach",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `You are EteFit, an expert AI fitness and health coach. You provide personalized, evidence-based advice on:
- Workout programming (strength, cardio, flexibility, sport-specific)
- Nutrition and meal planning
- Recovery, sleep optimization, and stress management
- Injury prevention and rehabilitation guidance
- Habit building and motivation

${
  userProfile
    ? `USER PROFILE (use this to personalize all advice):
- Height: ${userProfile.height ? userProfile.height + " cm" : "Not provided"}
- Weight: ${userProfile.weight ? userProfile.weight + " kg" : "Not provided"}
- Age: ${userProfile.age ? userProfile.age + " years" : "Not provided"}
- Activity level: ${userProfile.activity || "Not provided"}
- Fitness goal: ${userProfile.goal || "Not provided"}`
    : "No user profile provided — give general advice."
}
Guidelines:
- Be encouraging but honest. Use markdown formatting for clarity.
- Use emojis sparingly to keep things engaging.
- Provide specific, actionable advice with sets, reps, durations when relevant.
- Tailor advice based on user's context from the conversation.`,
            },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429)
        return {
          statusCode: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Rate limit exceeded. Try later." }),
        };
      if (response.status === 402)
        return {
          statusCode: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "AI usage limit reached. Add credits." }),
        };
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "AI service error" }),
      };
    }

    // Streaming response
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      body: response.body as any, // Node.js fetch Response.body
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