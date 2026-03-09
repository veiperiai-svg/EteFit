import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userProfile, generateTitle } = await req.json();
    const LOVABLE_API_KEY = req.headers.get("apikey");
if (!LOVABLE_API_KEY) throw new Error("API key missing");

    // Title generation mode — quick non-streaming call
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "Generate a short title (max 5 words) for this fitness chat conversation. Return ONLY the title, nothing else. No quotes, no punctuation at the end.",
              },
              {
                role: "user",
                content: convoSnippet,
              },
            ],
          }),
        }
      );

      if (!titleResp.ok) {
        return new Response(
          JSON.stringify({ title: messages[0]?.content?.slice(0, 40) || "Chat" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const titleData = await titleResp.json();
      const title = titleData.choices?.[0]?.message?.content?.trim() || messages[0]?.content?.slice(0, 40) || "Chat";

      return new Response(
        JSON.stringify({ title }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal chat streaming
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are EteFit, an expert AI fitness and health coach. You provide personalized, evidence-based advice on:
- Workout programming (strength, cardio, flexibility, sport-specific)
- Nutrition and meal planning
- Recovery, sleep optimization, and stress management
- Injury prevention and rehabilitation guidance
- Habit building and motivation

${userProfile ? `USER PROFILE (use this to personalize all advice):
- Height: ${userProfile.height ? userProfile.height + ' cm' : 'Not provided'}
- Weight: ${userProfile.weight ? userProfile.weight + ' kg' : 'Not provided'}
- Age: ${userProfile.age ? userProfile.age + ' years' : 'Not provided'}
- Activity level: ${userProfile.activity || 'Not provided'}
- Fitness goal: ${userProfile.goal || 'Not provided'}
` : 'No user profile provided — give general advice.'}
Guidelines:
- Be encouraging but honest. Use markdown formatting for clarity.
- Use emojis sparingly to keep things engaging.
- Provide specific, actionable advice with sets, reps, durations when relevant.
- When the user has provided their profile, tailor calories, weights, and intensity to their stats.
- Always recommend consulting a healthcare professional for medical concerns.
- Keep responses focused and well-structured with headers, lists, and tables when helpful.
- Tailor advice based on the user's context from the conversation.`,
            },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
