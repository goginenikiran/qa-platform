import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const FREE_LLM_SYSTEM_PROMPT = `You are an expert QA Engineering Analyst. Analyze the provided test data and return a concise, actionable response in plain language. Be specific and data-driven.`;

async function callFreeLLM(prompt: string, systemPrompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey: geminiKey });
      const response = await genAI.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction: systemPrompt, temperature: 0.3, maxOutputTokens: 2048 },
      });
      return response.text ?? '';
    } catch { /* fall through */ }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch { /* fall through */ }
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    switch (action) {

      case 'failure-explanation': {
        const { runName, failures } = body;
        if (!failures || !Array.isArray(failures) || failures.length === 0) {
          return NextResponse.json({ explanation: 'No failure data provided for analysis.' });
        }

        const prompt = `Analyze these failed test cases from execution run "${runName}" and explain likely root causes and suggest fixes:

${failures.map((f: { title: string; steps: { action: string; expectedResult: string; actualResult?: string }[] }) => `---
Test: ${f.title}
Steps:
${(f.steps || []).map((s, i) => `  ${i + 1}. Action: ${s.action}\n     Expected: ${s.expectedResult}\n     Actual: ${s.actualResult || 'N/A'}`).join('\n')}
---`).join('\n')}

Provide:
1. Root cause analysis for each failure
2. Severity assessment
3. Suggested fixes
4. Whether this is likely a code bug, test data issue, or environment problem`;

        let explanation = await callFreeLLM(prompt, FREE_LLM_SYSTEM_PROMPT);
        if (!explanation) {
          explanation = generateLocalFailureExplanation(failures);
        }
        return NextResponse.json({ explanation });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateLocalFailureExplanation(failures: { title: string; steps: { action: string; expectedResult: string; actualResult?: string }[] }[]): string {
  return failures.map(f => {
    const failedStep = f.steps.find(s => s.actualResult && s.actualResult !== s.expectedResult);
    return `## ${f.title}\n\n**Likely Root Cause:** ${failedStep ? `Step "${failedStep.action}" failed — expected "${failedStep.expectedResult}" but got "${failedStep.actualResult || 'no result'}".` : 'One or more steps did not produce the expected outcome.'}\n**Severity:** Medium\n**Suggested Fix:** Review the test data and environment configuration. If the feature behavior has changed, update the expected result or file a bug.\n**Classification:** Likely a test data or environment issue (verify before escalating).`;
  }).join('\n\n---\n\n');
}
