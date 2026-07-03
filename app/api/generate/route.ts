import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert QA Engineer. Your job is to generate comprehensive test cases from a given requirement or acceptance criteria.

RULES:
1. Return ONLY a valid JSON array. No markdown, no explanation, no preamble.
2. Each test case must follow the exact schema below.
3. Generate test cases for: happy path, negative/edge cases, boundary/performance scenarios as relevant.
4. Use clear, professional QA language in all fields.

JSON SCHEMA (array of objects):
[
  {
    "title": "string — clear imperative test case title",
    "priority": "Critical" | "High" | "Medium" | "Low",
    "description": "string — brief description of what this test validates",
    "preconditions": "string — what must be true before test begins",
    "steps": [
      { "action": "string — what the tester does", "expectedResult": "string — what should happen" }
    ],
    "tags": ["string array of relevant tags like 'smoke', 'regression', 'auth', 'negative', 'security', 'performance']
  }
]`;

export async function POST(req: NextRequest) {
    try {
        const { requirement, count = 3, model: requestedModel } = await req.json();

        if (!requirement?.trim()) {
            return NextResponse.json({ error: 'Requirement text is required.' }, { status: 400 });
        }

        const model = requestedModel || process.env.AI_MODEL || 'gemini';
        const userPrompt = `Generate exactly ${count} test case(s) for the following requirement:\n\n"${requirement}"\n\nReturn only the JSON array, nothing else.`;

        // Try Gemini first (default)
        const geminiKey = process.env.GEMINI_API_KEY;
        if ((model === 'gemini' || model === 'default') && geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
            try {
                const { GoogleGenAI } = await import('@google/genai');
                const genAI = new GoogleGenAI({ apiKey: geminiKey });
                const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

                const response = await genAI.models.generateContent({
                    model: modelName,
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    config: {
                        systemInstruction: SYSTEM_PROMPT,
                        temperature: 0.4,
                        maxOutputTokens: 4096,
                    },
                });

                const rawText = response.text ?? '';
                const jsonText = rawText
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```\s*$/i, '')
                    .trim();

                let testCases;
                try {
                    testCases = JSON.parse(jsonText);
                } catch {
                    return NextResponse.json({ error: 'AI returned invalid JSON. Please try again.', raw: rawText }, { status: 500 });
                }

                if (!Array.isArray(testCases)) {
                    return NextResponse.json({ error: 'AI did not return an array.', raw: rawText }, { status: 500 });
                }

                return NextResponse.json({ testCases: testCases.slice(0, count), provider: 'gemini' });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Gemini error';
                console.error('[Gemini Error]', msg);
                // Fall through to next provider
            }
        }

        // Try Claude
        const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        if ((model === 'claude' || model === 'default') && claudeKey) {
            try {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': claudeKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 4096,
                        system: SYSTEM_PROMPT,
                        messages: [{ role: 'user', content: userPrompt }],
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.content?.[0]?.text || '';
                    const jsonText = content
                        .replace(/^```json\s*/i, '')
                        .replace(/^```\s*/i, '')
                        .replace(/```\s*$/i, '')
                        .trim();

                    let testCases;
                    try {
                        testCases = JSON.parse(jsonText);
                    } catch {
                        return NextResponse.json({ error: 'Claude returned invalid JSON.', raw: content }, { status: 500 });
                    }

                    if (Array.isArray(testCases)) {
                        return NextResponse.json({ testCases: testCases.slice(0, count), provider: 'claude' });
                    }
                }
            } catch {
                // Fall through
            }
        }

        // Try OpenAI
        const openaiKey = process.env.OPENAI_API_KEY;
        if ((model === 'openai' || model === 'default') && openaiKey) {
            try {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ],
                        temperature: 0.4,
                        max_tokens: 4096,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.choices?.[0]?.message?.content || '';
                    const jsonText = content
                        .replace(/^```json\s*/i, '')
                        .replace(/^```\s*/i, '')
                        .replace(/```\s*$/i, '')
                        .trim();

                    let testCases;
                    try {
                        testCases = JSON.parse(jsonText);
                    } catch {
                        return NextResponse.json({ error: 'OpenAI returned invalid JSON.', raw: content }, { status: 500 });
                    }

                    if (Array.isArray(testCases)) {
                        return NextResponse.json({ testCases: testCases.slice(0, count), provider: 'openai' });
                    }
                }
            } catch {
                // Fall through
            }
        }

        // Try OpenRouter (free tier — open-source models, no CC required)
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if ((model === 'openrouter' || model === 'default') && openrouterKey) {
            try {
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openrouterKey}`,
                        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                        'X-Title': 'QA Copilot',
                    },
                    body: JSON.stringify({
                        model: 'meta-llama/llama-3.3-70b-instruct:free',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ],
                        temperature: 0.4,
                        max_tokens: 4096,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.choices?.[0]?.message?.content || '';
                    const jsonText = content
                        .replace(/^```json\s*/i, '')
                        .replace(/^```\s*/i, '')
                        .replace(/```\s*$/i, '')
                        .trim();

                    let testCases;
                    try {
                        testCases = JSON.parse(jsonText);
                    } catch {
                        return NextResponse.json({ error: 'OpenRouter returned invalid JSON.', raw: content }, { status: 500 });
                    }

                    if (Array.isArray(testCases)) {
                        return NextResponse.json({ testCases: testCases.slice(0, count), provider: 'openrouter' });
                    }
                }
            } catch {
                // Fall through
            }
        }

        // No API key configured — return fallback signal
        return NextResponse.json({ fallback: true, testCases: [], provider: 'fallback' });
    } catch (err: unknown) {
        console.error('[AI Generate Route Error]', err);
        const message = err instanceof Error ? err.message : 'Internal server error.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
