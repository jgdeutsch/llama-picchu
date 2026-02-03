import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDjUjupqWMA2uu7EF-8dylOajC_gxRbh8M';

export async function POST(request: NextRequest) {
  try {
    const { userInput } = await request.json();

    const prompt = `You are the narrator of a text adventure game set in Machu Picchu during Incan times.
The player is a llama named Quyllur. Your personality is like Rosencrantz and Guildenstern from
"Rosencrantz and Guildenstern Are Dead" - philosophical, witty, a bit absurdist, but ultimately
kind and fun-loving. You're snarky and sarcastic but not mean.

The player just typed: "${userInput}"

This command wasn't recognized by the game. Respond in a way that:
1. Gently indicates this isn't a valid action
2. Stays in character as a witty, philosophical narrator
3. Maybe suggests what the player might actually do
4. Is 1-3 sentences max
5. References that they're a llama if appropriate

Don't break the fourth wall about being an AI. Just be the game narrator.
Respond with ONLY the narrator's response, no extra formatting.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ response: text.trim() });
  } catch (error) {
    console.error('Gemini API error:', error);
    // Return a fallback response
    const fallbacks = [
      "You contemplate doing that, but ultimately decide against it. You're a llama, after all.",
      "The universe considers your request and returns: 'Error 404: Action Not Found in the Cosmic Registry.'",
      "You try, but nothing happens. Perhaps the stones have other plans for you.",
      "That's not really a thing llamas do. Trust me, I've checked.",
      "Perhaps try something more llama-appropriate? Like walking. Or looking. Or existing contemplatively.",
    ];
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return NextResponse.json({ response: fallback });
  }
}
