import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scan } from './_lib/scan.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Aceita GET (?keyword=) e POST ({ keyword, filters }).
  let keyword: string | null = null;
  let filters: { keyword: string; location: string; active?: boolean }[] = [];

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body ?? {};
    keyword = typeof body.keyword === 'string' ? body.keyword : null;
    filters = Array.isArray(body.filters) ? body.filters : [];
  } else {
    const q = req.query.keyword;
    keyword = typeof q === 'string' ? q : Array.isArray(q) ? q[0] ?? null : null;
  }

  try {
    const result = await scan(keyword, filters);
    // Cache leve na borda para aliviar scraping repetido.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      jobs: [],
      sources: [],
      error: err instanceof Error ? err.message : 'Erro desconhecido na varredura.',
    });
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
