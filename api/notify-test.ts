import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendDiscord, sendTelegram } from './_lib/notify.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  const service = String(body.service ?? '').toLowerCase();
  const settings = body.settings ?? {};

  try {
    if (service === 'telegram') {
      const token = String(settings.telegramBotToken ?? '').trim();
      const chatId = String(settings.telegramChatId ?? '').trim();
      if (token === '' || chatId === '') {
        res.status(400).json({ error: 'Token do Bot ou ID do Chat não foram preenchidos.' });
        return;
      }
      const text =
        '💼 <b>VagaFounder</b>\n\n✅ <b>Teste de Conexão com Telegram Bem-sucedido!</b>\nVocê receberá os alertas de novas vagas aqui.';
      await sendTelegram(token, chatId, text);
      res.status(200).json({ message: 'Mensagem de teste enviada com sucesso para o Telegram!' });
      return;
    }

    if (service === 'discord') {
      const webhook = String(settings.discordWebhookUrl ?? '').trim();
      if (webhook === '') {
        res.status(400).json({ error: 'URL do Webhook do Discord não foi preenchida.' });
        return;
      }
      const embeds = [{
        title: '💼 VagaFounder • Teste de Conexão',
        description: '✅ Webhook do Discord conectado com sucesso! As novas oportunidades aparecerão aqui.',
        color: 0x4f46e5,
      }];
      await sendDiscord(webhook, '🔔 **VagaFounder Conectado!**', embeds);
      res.status(200).json({ message: 'Mensagem de teste enviada com sucesso para o Discord!' });
      return;
    }

    res.status(400).json({ error: 'Serviço de notificação não suportado.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao enviar notificação de teste.' });
  }
}
