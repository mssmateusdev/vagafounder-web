import * as cheerio from 'cheerio';
import { httpGet } from '../http.js';
import {
  enc, extractBenefits, extractSalary, inferModality, makeJob, prettyCity,
  type Job, type Scope,
} from '../util.js';

export async function search(keyword: string, scope: Scope): Promise<Job[]> {
  const kwClean = keyword.trim();

  let url: string;
  if (scope.kind === 'metro') {
    url = kwClean === ''
      ? 'https://www.infojobs.com.br/empregos-em-recife,-pe.aspx'
      : `https://www.infojobs.com.br/empregos-em-recife,-pe.aspx?palavra=${enc(kwClean)}`;
  } else if (scope.kind === 'remote') {
    url = kwClean === ''
      ? 'https://www.infojobs.com.br/vagas-de-emprego-home-office.aspx'
      : `https://www.infojobs.com.br/vagas-de-emprego-home-office.aspx?palavra=${enc(kwClean)}`;
  } else {
    url = kwClean === ''
      ? `https://www.infojobs.com.br/vagas-de-emprego.aspx?cidade=${enc(scope.location)}`
      : `https://www.infojobs.com.br/vagas-de-emprego.aspx?palavra=${enc(kwClean)}&cidade=${enc(scope.location)}`;
  }

  const resp = await httpGet(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  if (!resp.ok) throw new Error(`Infojobs status ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  const jobs: Job[] = [];
  $('.js_cardLink, div.js_vacancyLoad').each((_, elem) => {
    const el = $(elem);
    const title = el.find('.js_vacancyTitle, h2').first().text().trim();
    if (title === '') return;

    let href = el.attr('data-href') ?? el.find('a').first().attr('href') ?? '';

    const dataId = el.attr('data-id');
    let id = dataId;
    if (!id) {
      const afterDouble = href.split('__').pop() ?? '';
      id = afterDouble.split('.')[0] ?? '';
    }

    const fullUrl = href.startsWith('http') ? href : `https://www.infojobs.com.br${href}`;

    const company = el.find('.js_companyName, .text-body.small').first().text().trim();
    const loc = el.find('.text-muted.small').first().text().trim();

    const city = loc !== '' ? prettyCity(loc) : 'Recife';
    const modality = inferModality(`${title} ${loc}`) ?? 'Presencial';

    const jobId = !id || id === ''
      ? `ij-${fullUrl.split('/').pop() ?? 'job'}`
      : `ij-${id}`;

    const job = makeJob({
      id: jobId,
      title,
      company: company === '' ? 'Empresa Confidencial' : company,
      city,
      modality,
      published: new Date(),
      url: fullUrl,
      source: 'infojobs',
      description: null,
    });

    const sal = extractSalary(job.title, null);
    if (sal) job.salary = sal;
    const b = extractBenefits(job.title, null);
    if (b.length > 0) job.benefits = b;

    jobs.push(job);
  });

  return jobs;
}
