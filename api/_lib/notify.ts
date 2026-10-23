import type { Job } from './util.js';

export interface ExternalNotifySettings {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  discordEnabled: boolean;
  discordWebhookUrl: string;
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });
  if (!resp.ok) throw new Error(`Telegram retornou status ${resp.status}`);
}

export async function sendDiscord(
  webhookUrl: string,
  content: string,
  embeds: unknown[],
): Promise<void> {
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, embeds }),
  });
  if (!resp.ok) throw new Error(`Discord retornou status ${resp.status}`);
}

export function buildTelegramMessage(jobs: Job[]): string {
  let msg = `💼 <b>VagaFounder • ${jobs.length} Novas Vagas Encontradas!</b>\n\n`;
  for (const j of jobs.slice(0, 5)) {
    const sal = j.salary ?? 'Salário a combinar';
    msg += `🔹 <b>${j.title}</b>\n🏢 <i>${j.company}</i>\n📍 ${j.location}\n💵 ${sal}\n🔗 <a href="${j.url}">Ver Vaga / Candidatar</a>\n\n`;
  }
  return msg;
}

export function buildDiscordEmbeds(jobs: Job[]): unknown[] {
  return jobs.slice(0, 5).map((j) => ({
    title: j.title,
    url: j.url,
    color: 0x4f46e5,
    fields: [
      { name: '🏢 Empresa', value: j.company, inline: true },
      { name: '📍 Local', value: j.location, inline: true },
      { name: '💵 Salário', value: j.salary ?? 'A combinar', inline: true },
      { name: '🌐 Plataforma', value: j.source.toUpperCase(), inline: true },
    ],
  }));
}
