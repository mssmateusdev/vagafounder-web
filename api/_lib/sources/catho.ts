import * as cheerio from 'cheerio';
import { httpGet } from '../http.js';
import {
  enc, extractBenefits, extractSalary, inferModality, makeJob, norm,
  type Job, type Scope,
} from '../util.js';

export async function search(keyword: string, scope: Scope): Promise<Job[]> {
  const kwClean = norm(keyword).replace(/ /g, '-');

  let url: string;
  if (scope.kind === 'metro') {
    url = kwClean === ''
      ? 'https://www.catho.com.br/vagas/recife-pe/'
      : `https://www.catho.com.br/vagas/${enc(kwClean)}/recife-pe/`;
  } else if (scope.kind === 'remote') {
    url = kwClean === ''
      ? 'https://www.catho.com.br/vagas/home-office/'
      : `https://www.catho.com.br/vagas/${enc(kwClean)}/home-office/`;
  } else {
    const cityClean = norm(scope.location).replace(/ /g, '-');
    url = kwClean === ''
      ? `https://www.catho.com.br/vagas/${enc(cityClean)}/`
      : `https://www.catho.com.br/vagas/${enc(kwClean)}/${enc(cityClean)}/`;
  }

  const resp = await httpGet(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  if (!resp.ok) throw new Error(`Catho status ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  const jobs: Job[] = [];
  $('article.offer').each((_, elem) => {
    const el = $(elem);
    const a = el.find('h2.title_offer a, h2 a').first();
    if (a.length === 0) return;

    const href = a.attr('href') ?? '';
    const title = (a.attr('title') ?? a.text().trim()).trim();
    if (title === '' || href === '') return;

    const fullUrl = href.startsWith('http') ? href : `https://www.catho.com.br${href}`;

    const id = href.split('/').filter((p) => p !== '').pop() ?? `catho-${fullUrl.length}`;

    const company = el.find('span.text-12').first().text().trim();
    const salaryRaw = el.find('span.icon.i_salary + strong, span.i_salary ~ strong').first().text().trim();

    const modality = inferModality(title) ?? 'Presencial';

    const job = makeJob({
      id: `catho-${id}`,
      title,
      company: company === '' ? 'Empresa Confidencial (Catho)' : company,
      city: 'Recife',
      modality,
      published: new Date(),
      url: fullUrl,
      source: 'catho',
      description: null,
    });

    if (salaryRaw !== '') {
      job.salary = salaryRaw;
    } else {
      const sal = extractSalary(job.title, null);
      if (sal) job.salary = sal;
    }
    const b = extractBenefits(job.title, null);
    if (b.length > 0) job.benefits = b;

    jobs.push(job);
  });

  return jobs;
}
