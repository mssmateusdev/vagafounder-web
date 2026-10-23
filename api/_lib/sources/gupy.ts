import { httpGetJson } from '../http.js';
import {
  enc, inRadius, makeJob, parseDate, prettyCity, stripAccents, type Job, type Scope,
} from '../util.js';

const API_BASE = 'https://portal.gupy.io/api/job-search/jobs';

interface GupyResponse {
  data?: unknown[];
  pagination?: { total?: number };
}

async function fetchApi(url: string): Promise<unknown[] | null> {
  try {
    const json = await httpGetJson<GupyResponse>(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return null;
  }
}

async function collectJobs(baseQuery: string): Promise<Record<string, unknown>[]> {
  const url100 = `${API_BASE}?${baseQuery}&limit=100&offset=0`;
  const first = await fetchApi(url100);
  if (first !== null) {
    const results = [...first];
    if (first.length >= 100) {
      for (const offset of [100, 200]) {
        const next = await fetchApi(`${API_BASE}?${baseQuery}&limit=100&offset=${offset}`);
        if (!next || next.length === 0) break;
        results.push(...next);
        if (next.length < 100) break;
      }
    }
    return results as Record<string, unknown>[];
  }
  return [];
}

function toJob(v: Record<string, any>): Job | null {
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name) return null;

  const published = parseDate(typeof v.publishedDate === 'string' ? v.publishedDate : '') ?? new Date();
  const workplace = typeof v.workplaceType === 'string' ? v.workplaceType : '';
  const modality = workplace === 'remote' ? 'Remoto' : workplace === 'hybrid' ? 'Híbrido' : 'Presencial';

  const cityRaw = (typeof v.city === 'string' ? v.city : '').trim();
  let city: string;
  if (modality === 'Remoto' && cityRaw === '') city = 'Brasil';
  else if (cityRaw === '') city = 'Pernambuco';
  else city = prettyCity(cityRaw);

  const idStr = v.id != null ? String(v.id) : name;

  const jobUrl =
    typeof v.jobUrl === 'string' && v.jobUrl !== ''
      ? v.jobUrl.replace(/&amp;/g, '&')
      : `https://portal.gupy.io/job-search/term=${enc(name)}`;

  const description =
    typeof v.description === 'string' && v.description.trim() !== '' ? v.description : null;

  return makeJob({
    id: `gupy-${idStr}`,
    title: name,
    company: typeof v.careerPageName === 'string' ? v.careerPageName : '',
    city,
    modality,
    published,
    url: jobUrl,
    source: 'gupy',
    description,
  });
}

export async function search(keyword: string, scope: Scope): Promise<Job[]> {
  const kw = enc(stripAccents(keyword));
  const isRemote = (v: Record<string, any>) => v.workplaceType === 'remote';

  let raw: Record<string, unknown>[] = [];

  if (scope.kind === 'metro') {
    const qLocal = kw === '' ? 'state=Pernambuco' : `jobName=${kw}&state=Pernambuco`;
    const qRemote = kw === '' ? 'workplaceType=remote' : `jobName=${kw}&workplaceType=remote`;

    const local = await collectJobs(qLocal);
    const remote = await collectJobs(qRemote);

    if (local.length === 0 && remote.length === 0) {
      raw = await collectJobs(`jobName=${kw}`);
    } else {
      const localFiltered = (local as Record<string, any>[]).filter((v) => {
        if (isRemote(v)) return true;
        const c = (typeof v.city === 'string' ? v.city : '').trim();
        return c === '' || inRadius(c);
      });
      const remoteFiltered = (remote as Record<string, any>[]).filter(isRemote);
      raw = [...localFiltered, ...remoteFiltered];
    }
  } else if (scope.kind === 'remote') {
    const qRemote = kw === '' ? 'workplaceType=remote' : `jobName=${kw}&workplaceType=remote`;
    raw = await collectJobs(qRemote);
  } else {
    const qLoc = kw === '' ? `city=${enc(scope.location)}` : `jobName=${kw}&city=${enc(scope.location)}`;
    raw = await collectJobs(qLoc);
  }

  const jobs: Job[] = [];
  for (const v of raw) {
    const j = toJob(v as Record<string, any>);
    if (j) jobs.push(j);
  }
  return jobs;
}
