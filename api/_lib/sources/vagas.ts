import * as cheerio from 'cheerio';
import { httpGet } from '../http.js';
import {
  enc, extractBenefits, extractSalary, inferModality, makeJob, norm, prettyCity,
  type Job, type Scope,
} from '../util.js';

export async function search(keyword: string, scope: Scope): Promise<Job[]> {
  const kwSlug = norm(keyword).replace(/ /g, '-');

  let url: string;
  if (scope.kind === 'metro') {
    url = kwSlug === ''
      ? 'https://www.vagas.com.br/vagas-em-recife'
      : `https://www.vagas.com.br/vagas-de-${enc(kwSlug)}-em-recife`;
  } else if (scope.kind === 'remote') {
    url = kwSlug === ''
      ? 'https://www.vagas.com.br/vagas-de-home-office'
      : `https://www.vagas.com.br/vagas-de-${enc(kwSlug)}-remoto`;
  } else {
    const citySlug = norm(scope.location).replace(/ /g, '-');
    url = kwSlug === ''
      ? `https://www.vagas.com.br/vagas-em-${enc(citySlug)}`
      : `https://www.vagas.com.br/vagas-de-${enc(kwSlug)}-em-${enc(citySlug)}`;
  }

  const resp = await httpGet(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  if (!resp.ok) throw new Error(`Vagas.com status ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  const jobs: Job[] = [];
  $('li.vaga, article.vaga').each((_, elem) => {
    const el = $(elem);
    const a = el.find('a.link-detalhes-vaga').first();
    if (a.length === 0) return;

    const href = a.attr('href') ?? '';
    const idAttr = a.attr('data-id-vaga');
    const id = idAttr ?? (href.split('/').pop() ?? '');

    const title = (a.attr('title') ?? a.text().trim()).trim();
    if (title === '' || href === '') return;

    const fullUrl = href.startsWith('http') ? href : `https://www.vagas.com.br${href}`;

    const company = el.find('.emprVaga').first().text().trim();
    const loc = el.find('.vaga-local').first().text().trim();
    const desc = el.find('.detalhes').first().text().trim();

    const city = loc !== '' ? prettyCity(loc) : 'Recife';
    const modality = inferModality(`${title} ${loc} ${desc}`) ?? 'Presencial';

    const jobId = id === ''
      ? `vagas-${fullUrl.split('/').pop() ?? 'job'}`
      : `vagas-${id}`;

    const job = makeJob({
      id: jobId,
      title,
      company: company === '' ? 'Confidencial' : company,
      city,
      modality,
      published: new Date(),
      url: fullUrl,
      source: 'vagas',
      description: desc === '' ? null : desc,
    });

    const sal = extractSalary(job.title, job.description);
    if (sal) job.salary = sal;
    const b = extractBenefits(job.title, job.description);
    if (b.length > 0) job.benefits = b;

    jobs.push(job);
  });

  return jobs;
}
