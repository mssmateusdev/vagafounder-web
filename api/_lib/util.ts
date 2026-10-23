// Porte fiel de src-tauri/src/util.rs para TypeScript (ambiente serverless Node).
// Normalização, escopo geográfico, raio metropolitano de Recife, extração de
// salário/benefícios, classificação de cargo e deduplicação.

export interface Job {
  id: string;
  title: string;
  company: string;
  /** Texto pronto para exibição: "Cidade (Modalidade)". */
  location: string;
  city: string;
  /** "Presencial" | "Híbrido" | "Remoto" */
  modality: string;
  type: string;
  publishedAt: string;
  url: string;
  /** "gupy" | "linkedin" | "indeed" | "vagas" | "trabalhabrasil" | "infojobs" | "catho" */
  source: string;
  description?: string;
  salary?: string;
  benefits: string[];
}

/** Municípios de PE num raio de ~80 km de Recife (normalizados). */
const METRO: string[] = [
  'recife', 'jaboatao dos guararapes', 'jaboatao', 'olinda', 'paulista', 'camaragibe',
  'sao lourenco da mata', 'cabo de santo agostinho', 'ipojuca', 'moreno', 'igarassu',
  'abreu e lima', 'ilha de itamaraca', 'itamaraca', 'itapissuma', 'aracoiaba', 'goiana',
  'vitoria de santo antao', 'escada', 'pombos', 'cha grande', 'cha de alegria',
  'gloria do goita', 'paudalho', 'carpina', 'nazare da mata', 'lagoa de itaenga',
  'lagoa do carro', 'tracunhaem', 'feira nova', 'buenos aires', 'limoeiro', 'sirinhaem',
  'ribeirao', 'primavera', 'condado', 'itaquitinga', 'vicencia', 'suape',
];

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function norm(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

export function enc(s: string): string {
  return encodeURIComponent(s);
}

/** "Jaboatão dos Guararapes, Pernambuco, Brazil" -> "Jaboatão dos Guararapes" */
export function cityPart(loc: string): string {
  let first = loc.split(',')[0] ?? '';
  first = first.split(' - ')[0] ?? '';
  first = first.split('(')[0] ?? '';
  return first.trim();
}

/** Nome de cidade legível para exibição. */
export function prettyCity(loc: string): string {
  const c = cityPart(loc);
  switch (norm(c)) {
    case 'greater recife':
    case 'regiao metropolitana do recife':
    case 'recife e regiao':
      return 'Grande Recife';
    case 'brazil':
    case 'brasil':
    case '':
      return 'Brasil';
    default:
      return c;
  }
}

/** Verdadeiro se a localidade está dentro do raio de ~80 km de Recife. */
export function inRadius(loc: string): boolean {
  const n = norm(loc);
  if (n.includes('recife') || n.includes('pernambuco')) return true;
  const c = norm(cityPart(loc));
  return METRO.some((m) => c === m || n.includes(m));
}

export function inferModality(text: string): string | null {
  const t = norm(text);
  if (t.includes('remoto') || t.includes('home office') || t.includes('remote') || t.includes('teletrabalho')) {
    return 'Remoto';
  }
  if (t.includes('hibrido') || t.includes('hybrid')) {
    return 'Híbrido';
  }
  return null;
}

export function classify(title: string): string {
  const t = norm(title);
  const has = (ws: string[]) => ws.some((w) => t.includes(w));
  const tokens = t.split(/[^a-z0-9]+/i);
  const word = (w: string) => tokens.includes(w);

  if (has(['aprendiz'])) return 'Jovem Aprendiz';
  if (has(['estagi', 'internship']) || word('intern')) return 'Estágio';
  if (word('rh') || word('dp') || has(['recursos humanos', 'departamento pessoal', 'recrutamento', 'gestao de pessoas', 'talent'])) {
    return 'Recursos Humanos (RH)';
  }
  if (has(['desenvolvedor', 'developer', 'software', 'programador', 'frontend', 'front-end', 'backend', 'back-end', 'fullstack', 'full stack'])) {
    return 'Tecnologia & Dev';
  }
  if (has(['suporte', 'helpdesk', 'help desk', 'service desk', 'tecnico de ti', 'tecnico de informatica', 'infraestrutura']) || word('ti')) {
    return 'Suporte de TI';
  }
  if (has(['auxiliar', 'assistente', 'administrativ'])) return 'Auxiliar Administrativo';
  if (has(['atendente', 'atendimento', 'recepcion', 'recepcao', 'caixa'])) return 'Atendimento / Recepção';
  if (word('pj')) return 'PJ';
  return 'CLT';
}

/** Aceita RFC3339 ou data simples (YYYY-MM-DD, como o LinkedIn retorna). */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  // Data simples YYYY-MM-DD → meio-dia em Brasília (15h UTC), nunca no futuro.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T15:00:00Z`);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    return d > now ? now : d;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export function extractSalary(title: string, desc?: string | null): string | undefined {
  const combined = `${title} ${desc ?? ''}`;
  const lower = combined.toLowerCase();

  const posReal = lower.indexOf('r$');
  if (posReal !== -1) {
    const slice = combined.slice(posReal);
    const stopIdx = slice.search(/[\n<|;•]/);
    const end = stopIdx === -1 ? Math.min(slice.length, 45) : stopIdx;
    const candidate = slice.slice(0, end).trim();
    if (candidate.length >= 4 && candidate.length <= 40) return candidate;
  }

  const posBolsa = lower.indexOf('bolsa');
  if (posBolsa !== -1) {
    const slice = combined.slice(posBolsa);
    const stopIdx = slice.search(/[\n<|•]/);
    const end = stopIdx === -1 ? Math.min(slice.length, 40) : stopIdx;
    const candidate = slice.slice(0, end).trim();
    if (candidate.length >= 5 && candidate.length <= 40) return candidate;
  }

  if (lower.includes('a combinar') || lower.includes('salario a combinar')) {
    return 'A combinar';
  }

  return undefined;
}

export function extractBenefits(title: string, desc?: string | null): string[] {
  const combined = norm(`${title} ${desc ?? ''}`);
  const benefits: string[] = [];

  if (/\b(vale refeicao|vale alimentacao|vr|va|refeitorio|caju|flash)\b/.test(combined)) {
    benefits.push('Vale Refeição / Alimentação');
  }
  if (/\b(vale transporte|vt|auxilio transporte|combustivel)\b/.test(combined)) {
    benefits.push('Vale Transporte');
  }
  if (combined.includes('plano de saude') || combined.includes('assistencia medica') || combined.includes('convenio medico') || combined.includes('unimed') || combined.includes('hapvida') || combined.includes('bradesco saude') || combined.includes('amil')) {
    benefits.push('Plano de Saúde');
  }
  if (combined.includes('plano odontologico') || combined.includes('assistencia odontologica') || combined.includes('odonto')) {
    benefits.push('Plano Odontológico');
  }
  if (combined.includes('home office') || combined.includes('auxilio home office') || combined.includes('ajuda de custo home') || combined.includes('remoto')) {
    benefits.push('Auxílio Remoto / Home Office');
  }
  if (combined.includes('gympass') || combined.includes('totalpass') || combined.includes('academia')) {
    benefits.push('Gympass / Academia');
  }
  if (combined.includes('seguro de vida')) {
    benefits.push('Seguro de Vida');
  }
  if (combined.includes('plr') || combined.includes('participacao nos lucros') || combined.includes('bonus') || combined.includes('comissao')) {
    benefits.push('Bônus / PLR');
  }
  if (combined.includes('day off') || combined.includes('folga de aniversario')) {
    benefits.push('Day Off Aniversário');
  }

  // dedupe preservando ordem
  return [...new Set(benefits)];
}

export function makeJob(params: {
  id: string;
  title: string;
  company: string;
  city: string;
  modality: string;
  published: Date;
  url: string;
  source: string;
  description?: string | null;
}): Job {
  const { id, title, company, city, modality, published, url, source, description } = params;
  const salary = extractSalary(title, description ?? undefined);
  const benefits = extractBenefits(title, description ?? undefined);
  const cleanCompany = company.trim() === '' ? 'Empresa não informada' : company.trim();
  return {
    id,
    type: classify(title),
    location: `${city} (${modality})`,
    title,
    company: cleanCompany,
    city,
    modality,
    publishedAt: published.toISOString(),
    url,
    source,
    description: description ?? undefined,
    salary,
    benefits,
  };
}

/** Remove duplicadas e ordena da mais recente para a mais antiga. */
export function dedupeSort(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const j of jobs) {
    const key = j.id
      ? j.id
      : j.url
        ? j.url
        : `${norm(j.title)}|${norm(j.company)}|${norm(j.location)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(j);
    }
  }
  out.sort((a, b) => (b.publishedAt < a.publishedAt ? -1 : b.publishedAt > a.publishedAt ? 1 : 0));
  return out;
}

/** Escopo geográfico derivado do campo "localização" de um filtro. */
export type Scope =
  | { kind: 'metro' }
  | { kind: 'remote' }
  | { kind: 'custom'; location: string };

export function scopeFromLocation(loc: string): Scope {
  const n = norm(loc);
  if (n.includes('remot')) return { kind: 'remote' };
  if (n === '' || n.includes('recife') || n.includes('jaboatao') || n.includes('pernambuco') || n.includes('80 km')) {
    return { kind: 'metro' };
  }
  return { kind: 'custom', location: loc.trim() };
}

export const DEFAULT_KEYWORDS: string[] = [
  'Jovem Aprendiz', 'Auxiliar Administrativo', 'Estágio', 'Recursos Humanos', 'Suporte TI', 'Atendimento',
];

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
