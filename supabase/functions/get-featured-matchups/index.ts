// supabase/functions/get-featured-matchups/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { GoogleGenAI, Type } from '@google/genai'

declare const Deno: any;

const featuredMatchSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      teamA: { type: Type.STRING, description: 'The name of the home team.' },
      teamB: { type: Type.STRING, description: 'The name of the away team.' },
      category: { type: Type.STRING, description: 'The match category, must be "men" or "women".' },
      description: { type: Type.STRING, description: 'A short, exciting description of the match (e.g., "El Clásico", "Champions League Final").' }
    },
    required: ['teamA', 'teamB', 'category', 'description']
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Enforce that only GET requests are allowed
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed. Please use GET.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
        });
    }

    const geminiApiKey = Deno.env.get('API_KEY');
    if (!geminiApiKey) {
      throw new Error('[Configuration Error] Server configuration is incomplete.');
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `As a world-class football analyst, identify 4 major, interesting, and highly anticipated upcoming professional soccer matches happening in the next week. Include both men's and women's matches from top leagues or international competitions. For each match, provide the two teams, the category (men/women), and a short, catchy description of why the match is significant (e.g., "Premier League Title Decider", "El Clásico", "NWSL Rivalry Match").`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: featuredMatchSchema,
        },
    });

    const matchesJson = result.text;
    if (!matchesJson) {
        throw new Error("AI failed to generate featured matchups.");
    }

    const matches = JSON.parse(matchesJson);

    return new Response(JSON.stringify(matches), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-featured-matchups function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});