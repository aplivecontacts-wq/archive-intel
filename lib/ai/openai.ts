/**
 * Minimal OpenAI helper for Generate Brief endpoint.
 * Uses fetch; requires OPENAI_API_KEY in env.
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

function findProjectRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getOpenAIKey(): string {
  let key = (process.env.OPENAI_API_KEY ?? '').trim();
  if (key) return key;
  // Find project root and read .env.local (Next.js cwd can be wrong in some contexts)
  const roots = [
    process.cwd(),
    ...(typeof __dirname !== 'undefined' ? [path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../..')] : []),
  ];
  const tried = new Set<string>();
  for (const start of roots) {
    const root = findProjectRoot(start) || start;
    if (tried.has(root)) continue;
    tried.add(root);
    const candidates = [
      path.join(root, '.env.local'),
      path.join(root, '.env'),
    ];
    for (const envPath of candidates) {
      try {
        if (fs.existsSync(envPath)) {
          config({ path: envPath, override: true });
          key = (process.env.OPENAI_API_KEY ?? '').trim();
          if (key) return key;
          let raw = fs.readFileSync(envPath, 'utf-8');
          raw = raw.replace(/^\uFEFF/, ''); // strip BOM
          const match = raw.match(/OPENAI_API_KEY\s*=\s*(.+?)(?=[\r\n]|\s*#|$)/m);
          if (match) return match[1].replace(/^["']|["']$/g, '').trim().replace(/\r$/, '');
        }
      } catch {
        // ignore
      }
    }
  }
  return '';
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type GenerateStructuredJsonResult<T> = {
  data: T;
  usage?: OpenAIUsage;
};

export async function generateStructuredJson<T = unknown>(
  systemPrompt: string,
  userContent: string,
  model = 'gpt-4o-mini'
): Promise<GenerateStructuredJsonResult<T>> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to .env.local in the project root.');
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `OpenAI API error ${res.status}: ${errBody.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  const usage: OpenAIUsage | undefined = data?.usage
    ? {
        prompt_tokens: data.usage.prompt_tokens ?? 0,
        completion_tokens: data.usage.completion_tokens ?? 0,
        total_tokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  try {
    return { data: JSON.parse(content) as T, usage };
  } catch {
    throw new Error('OpenAI response was not valid JSON');
  }
}
