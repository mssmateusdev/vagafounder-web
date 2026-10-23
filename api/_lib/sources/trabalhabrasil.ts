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
      ? 'https://www.trabalhabrasil.com.br/vagas-de-emprego-em-recife-pe'
      : `https://www.trabalhabrasil.com.br/vagas-empregos-em-recife-pe/${enc(kwSlug)}`;
  } else if (scope.kind === 'remote') {
    url = kwSlug === ''
      ? 'https://www.trabalhabrasil.com.br/vagas-de-emprego-home-office'
      : `https://www.trabalhabrasil.com.br/vagas-empregos-home-office/${enc(kwSlug)}`;
  } else {
    const citySlug = norm(scope.location).replace(/ /g, '-');
    url = kwSlug === ''
      ? `https://www.trabalhabrasil.com.br/vagas-de-emprego-em-${enc(citySlug)}`
      : `https://www.trabalhabrasil.com.br/vagas-empregos-em-${enc(citySlug)}/${enc(kwSlug)}`;
  }

  const resp = await httpGet(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  if (!resp.ok) throw new Error(`TrabalhaBrasil status ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  const jobs: Job[] = [];
  $('article.job-card').each((_, elem) => {
    const el = $(elem);
    const title = el.find('h2.job-title').first().text().trim();
    if (title === '') return;

    const href = el.find('a.job-link').first().attr('href') ?? '';
    const dataId = el.attr('data-job-id');
    const id = dataId ?? (href.split('/').pop() ?? '');

    const fullUrl = href.startsWith('http') ? href : `https://www.trabalhabrasil.com.br${href}`;

    const company = el.find('.job-company span').first().text().trim();
    const loc = el.find('.job-location span').first().text().trim();
    const salaryRaw = el.find('.job-detail--salary span.salary, .salary').first().text().trim();
    const workplaceRaw = el.find('.job-detail--type span.workplace, .job-badge--remote').first().text().trim();

    const city = loc !== '' ? prettyCity(loc) : 'Recife';
    const modality = inferModality(`${title} ${workplaceRaw}`) ?? 'Presencial';

    const jobId = id === ''
      ? `tb-${fullUrl.split('/').pop() ?? 'job'}`
      : `tb-${id}`;

    const job = makeJob({
      id: jobId,
      title,
      company: company === '' ? 'SINE / Trabalha Brasil' : company,
      city,
      modality,
      published: new Date(),
      url: fullUrl,
      source: 'trabalhabrasil',
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
