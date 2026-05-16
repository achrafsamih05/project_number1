import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";
import type { Locale } from "@/lib/types";

// ---------------------------------------------------------------------------
// POST /api/ai/generate-description
//
// Protected endpoint that generates SEO-optimized, localized product
// descriptions using Google Gemini (or OpenAI as fallback).
//
// Request body:
//   { productName, category, tone, language }
//
// Response:
//   { description: string }
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type Tone = "professional" | "enthusiastic" | "luxury" | "casual" | "technical";

interface GenerateDescriptionPayload {
  productName: string;
  category: string;
  tone: Tone;
  language: Locale;
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional: "Write in a professional, trustworthy business tone",
  enthusiastic: "Write in an enthusiastic, energetic, exciting tone with action words",
  luxury: "Write in a luxurious, premium, sophisticated tone that evokes exclusivity",
  casual: "Write in a friendly, casual, conversational tone",
  technical: "Write in a precise, technical, specification-focused tone",
};

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
};

function buildPrompt(payload: GenerateDescriptionPayload): string {
  const { productName, category, tone, language } = payload;
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;
  const langName = LANGUAGE_NAMES[language] || "English";

  return [
    `You are an expert e-commerce copywriter specializing in ${langName} product descriptions.`,
    ``,
    `${toneInstruction}.`,
    ``,
    `Generate an SEO-optimized product description for:`,
    `- Product: ${productName}`,
    `- Category: ${category}`,
    `- Language: ${langName}`,
    ``,
    `Requirements:`,
    `- 2-4 sentences, 50-120 words`,
    `- Include relevant keywords naturally for SEO`,
    `- Highlight key benefits and features`,
    `- Include a subtle call-to-action`,
    `- Write ONLY the description text, no titles or labels`,
    `- Write entirely in ${langName}`,
    language === "ar" ? `- Use modern standard Arabic suitable for e-commerce` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
          topP: 0.9,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error("Empty response from AI model");
  return text;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert e-commerce copywriter." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty response from AI model");
  return text;
}

export const POST = (req: NextRequest) =>
  handle(async () => {
    // Auth: only authenticated merchants can use AI generation
    await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = (await req.json().catch(() => null)) as GenerateDescriptionPayload | null;
    if (!body) httpError(400, "Invalid request body");

    const { productName, category, tone, language } = body!;

    if (!productName?.trim()) httpError(400, "productName is required");
    if (!category?.trim()) httpError(400, "category is required");
    if (!tone || !TONE_INSTRUCTIONS[tone]) httpError(400, "Invalid tone");
    if (!language || !LANGUAGE_NAMES[language]) httpError(400, "Invalid language");

    const prompt = buildPrompt({ productName, category, tone, language });

    // Try Gemini first, fall back to OpenAI
    let description: string;
    try {
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
        description = await callGemini(prompt);
      } else if (process.env.OPENAI_API_KEY) {
        description = await callOpenAI(prompt);
      } else {
        httpError(503, "No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY in environment.");
        return; // unreachable but satisfies TS
      }
    } catch (err) {
      // If primary fails, try secondary
      try {
        if (process.env.OPENAI_API_KEY && (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)) {
          description = await callOpenAI(prompt);
        } else {
          throw err;
        }
      } catch {
        const msg = err instanceof Error ? err.message : "AI generation failed";
        httpError(502, msg);
        return;
      }
    }

    return { description };
  });
