# 🚀 Deploy da Versão Web (Vercel)

O VagaFounder roda em **dois modos a partir do mesmo código**:

| Modo | Tecnologia | Onde roda |
|---|---|---|
| **Desktop** | Tauri v2 (Rust) + React | App nativo (Windows/Linux/macOS) |
| **Web** | Serverless Functions (TypeScript) + React | Vercel |

No desktop, o backend Rust faz o scraping. Na web, as mesmas buscas são feitas
por **serverless functions** em `api/`, que portam a lógica dos scrapers para
TypeScript. O frontend é idêntico nos dois: a camada `src/lib/tauri.ts` detecta
o ambiente e decide se chama o IPC nativo do Tauri ou as rotas `/api/*`.

---

## 📦 Estrutura relevante para a web

```
api/
├─ _lib/
│  ├─ util.ts            # normalização, raio metropolitano, salário/benefícios, dedupe
│  ├─ http.ts            # fetch com timeout e User-Agent de navegador
│  ├─ notify.ts          # Telegram / Discord
│  ├─ scan.ts            # orquestra as 6 fontes em paralelo
│  └─ sources/           # scrapers portados de Rust → TypeScript
│     ├─ gupy.ts  linkedin.ts  vagas.ts
│     └─ trabalhabrasil.ts  infojobs.ts  catho.ts
├─ scan.ts               # POST/GET /api/scan
├─ notify-test.ts        # POST /api/notify-test
└─ job-description.ts    # GET  /api/job-description

src/lib/tauri.ts         # camada de compatibilidade desktop/web
vercel.json              # configuração de build/functions da Vercel
tsconfig.api.json        # type-check isolado das functions
```

---

## ✅ Passo a passo na Vercel

1. **Importe o repositório** na Vercel: *New Project → Import Git Repository →*
   `mssmateusdev/vagafounder-web`.

2. A Vercel lê o `vercel.json` automaticamente. As configurações já vêm prontas:

   | Campo | Valor |
   |---|---|
   | Framework Preset | Vite |
   | Build Command | `npm run build:web` |
   | Output Directory | `dist` |
   | Functions | `api/**/*.ts` (`maxDuration: 60`) |

3. **Nenhuma variável de ambiente é necessária.** Os tokens de Telegram/Discord
   são informados pelo próprio usuário na tela de Configurações e ficam salvos no
   navegador (localStorage). Nada sensível é commitado no repositório.

4. Clique em **Deploy**.

---

## ⚠️ Limite de tempo das Functions (importante)

- `vercel.json` define `maxDuration: 60` (segundos). Isso **só vale no plano Pro**.
- No **plano Hobby (grátis)** o limite é **10s** por function.
- O `/api/scan` varre 6 fontes em paralelo e normalmente responde bem antes
  disso. Se você ver timeout no Hobby, reduza o volume por varredura em
  `api/_lib/sources/linkedin.ts` (número de `pages`) e/ou limite a lista de
  queries em `api/_lib/scan.ts`.

---

## 🌐 O que muda entre web e desktop

### Funciona na web
- Busca nas **6 fontes**: Gupy, LinkedIn, Vagas.com, Trabalha Brasil, InfoJobs, Catho
- Funil de Candidaturas (Kanban), favoritos, "já me candidatei"
- Dark mode, split-view, exportação CSV/JSON
- Teste de notificação Telegram e Discord (via `/api/notify-test`)
- Descrição sob demanda do LinkedIn (via `/api/job-description`)

### Não funciona na web (limitação do navegador)
- **Indeed** — exige navegador nativo com motor JS (anti-robô do Cloudflare).
  Aparece como *indisponível* no painel de status das fontes.
- **Monitoramento contínuo em segundo plano** — a web escaneia sob demanda
  (quando o usuário busca ou atualiza); não há worker rodando com o app fechado.
- **System tray, notificações nativas do SO e janela nativa** — exclusivos do desktop.

---

## 🧪 Build e testes locais (ambiente Linux/WSL)

> Este projeto vive no WSL. Rode os comandos **dentro do Linux** (não via npm do
> Windows), pois o `node_modules` precisa ser populado pelo Node do Linux.

```bash
# dentro do WSL, na raiz do projeto
npm install

# build de produção da versão web (gera dist/)
npm run build:web

# type-check isolado das serverless functions
npm run typecheck:api

# preview local do bundle gerado
npm run preview
```

Para desenvolvimento do frontend isolado (sem Tauri):

```bash
npm run dev:vite
```

> Observação: no `dev:vite` as rotas `/api/*` não existem localmente a menos que
> você use o `vercel dev` (CLI da Vercel). Sem ele, a busca retornará erro de
> rede no navegador — isso é esperado em dev puro do Vite.
