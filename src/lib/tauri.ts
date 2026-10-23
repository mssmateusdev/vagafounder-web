// Camada de compatibilidade desktop/web.
//
// No desktop (Tauri), delega para @tauri-apps/api: usa IPC nativo e eventos.
// Na web (Vercel), `invoke` mapeia comandos para chamadas às serverless
// functions em /api/* e `listen` vira no-op (não há worker em background
// emitindo eventos no navegador).
//
// A assinatura é igual à do Tauri, então os componentes não precisam saber
// em qual ambiente estão rodando.

import type { Job, MonitorStatus, NotificationSettings, ExternalNotifySettings } from '../types';

/** True quando rodando dentro do shell nativo do Tauri. */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// Estado leve só da web (persistido em localStorage) para comandos que no
// desktop vivem no backend Rust: filtros, settings e cache de vagas.
// ---------------------------------------------------------------------------

const LS_FILTERS = 'vagafounder_web_filters';
const LS_NOTIFY = 'vagafounder_web_notify';
const LS_EXTERNAL = 'vagafounder_web_external';
const LS_JOBS = 'vagafounder_web_jobs';

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota cheia ou indisponível: ignora */
  }
}

const DEFAULT_NOTIFY: NotificationSettings = { notifyAll: true, roles: [], keywords: [] };
const DEFAULT_EXTERNAL: ExternalNotifySettings = {
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  discordEnabled: false,
  discordWebhookUrl: '',
};

interface WebFilter {
  id: string;
  keyword: string;
  location: string;
  type: string;
  timeWindow: string;
  active: boolean;
}

async function apiScan(keyword: string | null): Promise<Job[]> {
  const filters = lsGet<WebFilter[]>(LS_FILTERS, []);
  const resp = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, filters }),
  });
  if (!resp.ok) throw new Error(`Falha na varredura (HTTP ${resp.status})`);
  const data = (await resp.json()) as { jobs?: Job[]; sources?: MonitorStatus['sources'] };
  const jobs = data.jobs ?? [];
  lsSet(LS_JOBS, jobs);
  if (data.sources) {
    lastSources = data.sources;
  }
  return jobs;
}

let lastSources: MonitorStatus['sources'] = [];

function webStatus(): MonitorStatus {
  return {
    paused: false,
    muted: false,
    scanning: false,
    nextCheckAt: null,
    lastCheckAt: new Date().toISOString(),
    sources: lastSources,
    notificationSettings: lsGet<NotificationSettings>(LS_NOTIFY, DEFAULT_NOTIFY),
    externalNotificationSettings: lsGet<ExternalNotifySettings>(LS_EXTERNAL, DEFAULT_EXTERNAL),
  };
}

/** Implementação web de `invoke`. */
async function webInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case 'get_jobs':
      return lsGet<Job[]>(LS_JOBS, []) as unknown as T;

    case 'scan_now':
    case 'fetch_jobs': {
      const keyword = (args?.keyword as string | null) ?? null;
      return (await apiScan(keyword)) as unknown as T;
    }

    case 'get_status':
      return webStatus() as unknown as T;

    case 'set_paused':
    case 'set_muted':
      // Sem worker em background na web: no-op.
      return undefined as unknown as T;

    case 'get_notification_settings':
      return lsGet<NotificationSettings>(LS_NOTIFY, DEFAULT_NOTIFY) as unknown as T;

    case 'set_notification_settings': {
      const settings = args?.settings as NotificationSettings;
      lsSet(LS_NOTIFY, settings);
      return settings as unknown as T;
    }

    case 'test_notification': {
      // Sem notificação nativa do SO na web: usa a Web Notifications API.
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('VagaFounder • Teste de Aviso', {
            body: 'Avisos ativos! Você verá alertas de novas vagas aqui.',
          });
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            new Notification('VagaFounder • Teste de Aviso', {
              body: 'Avisos ativos! Você verá alertas de novas vagas aqui.',
            });
          } else {
            throw new Error('Permissão de notificação negada pelo navegador.');
          }
        } else {
          throw new Error('Permissão de notificação negada pelo navegador.');
        }
      } else {
        throw new Error('Este navegador não suporta notificações.');
      }
      return undefined as unknown as T;
    }

    case 'get_external_notify_settings':
      return lsGet<ExternalNotifySettings>(LS_EXTERNAL, DEFAULT_EXTERNAL) as unknown as T;

    case 'set_external_notify_settings': {
      const settings = args?.settings as ExternalNotifySettings;
      lsSet(LS_EXTERNAL, settings);
      return settings as unknown as T;
    }

    case 'test_external_notification': {
      const service = args?.service as string;
      const settings = lsGet<ExternalNotifySettings>(LS_EXTERNAL, DEFAULT_EXTERNAL);
      const resp = await fetch('/api/notify-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, settings }),
      });
      const data = (await resp.json()) as { message?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? `Falha ao testar ${service}`);
      return (data.message ?? 'Teste enviado!') as unknown as T;
    }

    case 'get_job_description': {
      const id = args?.id as string;
      const source = args?.source as string;
      const resp = await fetch(
        `/api/job-description?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source)}`,
      );
      const data = (await resp.json()) as { description?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? 'Descrição indisponível.');
      return (data.description ?? '') as unknown as T;
    }

    case 'open_url': {
      const url = args?.url as string;
      window.open(url, '_blank', 'noopener,noreferrer');
      return undefined as unknown as T;
    }

    // Comandos de janela nativa: sem efeito no navegador.
    case 'minimize_window':
    case 'hide_to_tray':
    case 'exit_app':
      return undefined as unknown as T;

    default:
      throw new Error(`Comando não suportado na web: ${cmd}`);
  }
}

/**
 * invoke compatível. No Tauri carrega o módulo nativo dinamicamente; na web
 * usa a implementação acima.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }
  return webInvoke<T>(cmd, args);
}

export type UnlistenFn = () => void;

/**
 * listen compatível. No Tauri assina o evento nativo; na web devolve um
 * unlisten no-op (os eventos `jobs-updated` / `monitor-status` só existem no
 * worker em background do desktop).
 */
export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> {
  if (isTauri) {
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    return tauriListen<T>(event, handler);
  }
  void event;
  void handler;
  return () => {};
}
