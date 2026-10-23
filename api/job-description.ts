import type { VercelRequest, VercelResponse } from '@vercel/node';
import { httpGet } from './_lib/http.js';

/**
 * Busca a descrição completa sob demanda. Hoje suporta LinkedIn (igual ao
 * backend Rust); demais fontes retornam mensagem orientando abrir o link.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = String(req.query.id ?? '');
  const source = String(req.query.source ?? '').toLowerCase();

  if (source.includes('linkedin')) {
    const liId = id.startsWith('li-') ? id.slice(3) : id;
    const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${liId}`;
    try {
      const resp = await httpGet(detailUrl);
      if (resp.ok) {
        const html = await resp.text();
        const marker = 'show-more-less-html__markup';
        const startIdx = html.indexOf(marker);
        if (startIdx !== -1) {
          const tagClose = html.indexOf('>', startIdx);
          if (tagClose !== -1) {
            const bodyStart = tagClose + 1;
            const bodyEnd = html.indexOf('</div>', bodyStart);
            if (bodyEnd !== -1) {
              const descHtml = html.slice(bodyStart, bodyEnd).trim();
              res.status(200).json({ description: descHtml });
              return;
            }
          }
        }
      }
    } catch {
      // cai no erro genérico abaixo
    }
    res.status(404).json({ error: 'Não foi possível carregar a descrição completa do LinkedIn no momento.' });
    return;
  }

  if (source.includes('gupy')) {
    res.status(404).json({ error: 'Descrição não disponibilizada nesta vaga pela empresa no Gupy.' });
    return;
  }
  if (source.includes('indeed')) {
    res.status(404).json({ error: 'O Indeed requer validação direta na plataforma. Acesse o link oficial para conferir a descrição completa.' });
    return;
  }

  res.status(404).json({ error: 'Fonte sem suporte a extração sob demanda.' });
}
