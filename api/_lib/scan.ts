import { dedupeSort, scopeFromLocation, type Job, type Scope } from './util.js';
import * as gupy from './sources/gupy.js';
import * as linkedin from './sources/linkedin.js';
import * as vagas from './sources/vagas.js';
import * as trabalhabrasil from './sources/trabalhabrasil.js';
import * as infojobs from './sources/infojobs.js';
import * as catho from './sources/catho.js';

export interface SourceStatus {
  source: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface ScanResult {
  jobs: Job[];
  sources: SourceStatus[];
}

type SearchFn = (keyword: string, scope: Scope) => Promise<Job[]>;

const SOURCES: { id: string; fn: SearchFn }[] = [
  { id: 'gupy', fn: gupy.search },
  { id: 'linkedin', fn: linkedin.search },
  { id: 'vagas', fn: vagas.search },
  { id: 'trabalhabrasil', fn: trabalhabrasil.search },
  { id: 'infojobs', fn: infojobs.search },
  { id: 'catho', fn: catho.search },
];

/**
 * Executa uma fonte para todas as queries e sumariza em um SourceStatus,
 * equivalente ao `summarize` + `merge_batch` do backend Rust.
 */
async function runSource(
  id: string,
  fn: SearchFn,
  queries: { keyword: string; scope: Scope }[],
): Promise<{ jobs: Job[]; status: SourceStatus }> {
  const results = await Promise.allSettled(queries.map((q) => fn(q.keyword, q.scope)));

  const jobs: Job[] = [];
  let count = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      count += r.value.length;
      jobs.push(...r.value);
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }

  return {
    jobs,
    status: {
      source: id,
      ok: errors.length < results.length,
      count,
      error: errors[0] ?? null,
    },
  };
}

/**
 * Monta a lista de buscas (palavra + escopo) a partir dos filtros ativos,
 * ou de uma palavra-chave custom, ou dos termos padrão.
 */
export function buildQueries(
  customKeyword: string | null,
  filters: { keyword: string; location: string; active?: boolean }[] = [],
): { keyword: string; scope: Scope }[] {
  if (customKeyword && customKeyword.trim() !== '') {
    return [{ keyword: customKeyword.trim(), scope: { kind: 'metro' } }];
  }

  const seen = new Set<string>();
  const out: { keyword: string; scope: Scope }[] = [];
  for (const f of filters) {
    if (f.active === false) continue;
    const kw = (f.keyword ?? '').trim();
    if (kw === '') continue;
    const scope = scopeFromLocation(f.location ?? '');
    const key = `${kw.toLowerCase()}|${scope.kind}|${scope.kind === 'custom' ? scope.location : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ keyword: kw, scope });
  }

  if (out.length === 0) {
    return [{ keyword: '', scope: { kind: 'metro' } }];
  }
  return out;
}

/** Varre as 6 fontes HTTP em paralelo e devolve vagas deduplicadas + status. */
export async function scan(
  customKeyword: string | null,
  filters: { keyword: string; location: string; active?: boolean }[] = [],
): Promise<ScanResult> {
  const queries = buildQueries(customKeyword, filters);

  const batches = await Promise.all(SOURCES.map((s) => runSource(s.id, s.fn, queries)));

  const allJobs: Job[] = [];
  const sources: SourceStatus[] = [];
  for (const b of batches) {
    allJobs.push(...b.jobs);
    sources.push(b.status);
  }

  // Indeed não é suportado na web (exige navegador real com motor JS por causa
  // da proteção anti-robô Cloudflare). Reportamos como indisponível.
  sources.push({
    source: 'indeed',
    ok: false,
    count: 0,
    error: 'Indeed indisponível na versão web (requer navegador nativo). Disponível apenas na versão desktop.',
  });

  return { jobs: dedupeSort(allJobs), sources };
}
