import { Handler } from "@netlify/functions";

const handler: Handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { messages, userProfile, generateTitle } = body;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Title generation (greitas ne-streaming)
    if (generateTitle && messages?.length >= 2) {
      const convoSnippet = messages
        .slice(0, 4)
        .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titleResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: "Generate a short title (max 5 words). Return only the title." },
            { role: "user", content: convoSnippet },
          ],
        }),
      });

      const titleData = await titleResp.json();
      const title = titleData.choices?.[0]?.message?.content?.trim() || messages[0]?.content?.slice(0, 40) || "Chat";

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ title }),
      };
    }

    // Normal chat (vienkartinis ne-streaming)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are EteFit, an expert AI fitness and health coach. You provide personalized, evidence-based advice on:
- Workout programming (strength, cardio, flexibility, sport-specific)
- Nutrition and meal planning
- Recovery, sleep optimization, and stress management
- Injury prevention and rehabilitation guidance
- Habit building and motivation.
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
        stream: false
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data),
    };
  } catch (e: any) {
    console.error("chat error:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message || "Unknown error" }),
    };
  }
};

export { handler };