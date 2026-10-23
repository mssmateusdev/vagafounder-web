import * as cheerio from 'cheerio';
import { httpGet } from '../http.js';
import {
  cityPart, enc, inferModality, inRadius, makeJob, norm, parseDate, prettyCity,
  stripAccents, type Job, type Scope,
} from '../util.js';

const BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';

interface Plan {
  location: string;
  /** Raio em milhas (50 mi ≈ 80 km). */
  distance?: number;
  remote: boolean;
  pages: number;
}

function parse(html: string, plan: Plan, metroOnly: boolean): { cards: number; jobs: Job[] } {
  const $ = cheerio.load(html);
  const jobs: Job[] = [];
  let cards = 0;

  $('.base-search-card').each((_, elem) => {
    cards += 1;
    const el = $(elem);
    const title = el.find('.base-search-card__title').first().text().trim();

    const rawHref = el.find('a.base-card__full-link').first().attr('href') ?? '';
    const url = (rawHref.split('?')[0] ?? '').trim();

    // ID estável: data-entity-urn="urn:li:jobPosting:123" ou o número no fim da URL.
    const urn = el.attr('data-entity-urn');
    let id: string | undefined;
    if (urn) {
      const parts = urn.split(':');
      id = parts[parts.length - 1];
    }
    if (!id) {
      const tail = url.split('-').pop() ?? '';
      if (tail && /^\d+$/.test(tail)) id = tail;
    }
    if (!id || title === '') return;

    const loc = el.find('.job-search-card__location').first().text().trim();
    if (metroOnly && !plan.remote && !(inRadius(loc) || norm(cityPart(loc)) === 'pernambuco')) {
      return;
    }

    const datetime = el.find('time').first().attr('datetime');
    const published = parseDate(datetime) ?? new Date();

    const modality = plan.remote
      ? 'Remoto'
      : inferModality(`${title} ${loc}`) ?? 'Presencial';
    const city = plan.remote ? 'Brasil' : prettyCity(loc);
    const company = el.find('.base-search-card__subtitle').first().text().trim();

    jobs.push(makeJob({
      id: `li-${id}`,
      title,
      company,
      city,
      modality,
      published,
      url,
      source: 'linkedin',
      description: null,
    }));
  });

  return { cards, jobs };
}

export async function search(keyword: string, scope: Scope): Promise<Job[]> {
  const recife = 'Recife, Pernambuco, Brasil';
  const remotePlan = (pages: number): Plan => ({ location: 'Brasil', remote: true, pages });

  let plans: Plan[];
  if (scope.kind === 'metro') {
    plans = [{ location: recife, distance: 50, remote: false, pages: 2 }, remotePlan(1)];
  } else if (scope.kind === 'remote') {
    plans = [remotePlan(2)];
  } else {
    plans = [{ location: scope.location, distance: 50, remote: false, pages: 2 }];
  }

  const metroOnly = scope.kind === 'metro';
  const kw = enc(stripAccents(keyword));

  const jobs: Job[] = [];
  let lastErr: string | null = null;
  let anyOk = false;

  for (const plan of plans) {
    for (let p = 0; p < plan.pages; p++) {
      const startOffset = p * 25;
      let url = `${BASE}?keywords=${kw}&location=${enc(plan.location)}&start=${startOffset}`;
      if (plan.distance != null) url += `&distance=${plan.distance}`;
      if (plan.remote) url += '&f_WT=2';

      let html: string;
      try {
        const resp = await httpGet(url);
        if (!resp.ok) {
          lastErr = `LinkedIn recusou a requisição (HTTP ${resp.status})`;
          break;
        }
        html = await resp.text();
      } catch (e) {
        lastErr = `LinkedIn indisponível: ${(e as Error).message}`;
        break;
      }

      anyOk = true;
      const { cards, jobs: found } = parse(html, plan, metroOnly);
      jobs.push(...found);
      if (cards === 0) break;
    }
  }

  if (!anyOk) {
    throw new Error(lastErr ?? 'LinkedIn não respondeu');
  }
  return jobs;
}
