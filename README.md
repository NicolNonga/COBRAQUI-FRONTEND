# Cobraqui — Frontend Next.js

Migração do frontend Angular (Sakai/PrimeNG) para **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4**, com design system próprio inspirado em produtos fintech (Stripe, Linear, Apple).

## Começar

1. Arranque a API (`nestjs-api`): `npm run start:dev` → `http://localhost:3333/api` (Swagger em `/docs`, se activo).
2. No frontend:

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3333/api
npm run dev                  # http://localhost:3000
```

Entre com um utilizador existente na base de dados da API.

## Integração com a API

- Todos os pedidos passam por `src/lib/api/services/index.ts` (um objecto por módulo, campos iguais aos DTOs do NestJS).
- `src/lib/api/http.ts`: token Bearer, `Idempotency-Key` nas operações financeiras (pagamentos, repasses, negociações, transferências), erros no formato `{ code, message, details, requestId }`, redirecção para `/login` em 401.
- Valores monetários circulam como texto decimal (`"1234.50"`) — nunca como número de vírgula flutuante.
- Única parte ainda sem backend: **Documentos** (`services/documents.ts`, guardados só na sessão do browser).

## Mapa de telas (Angular → Next.js)

| Angular | Next.js |
|---|---|
| `/auth/login` | `/login` |
| `/auth/forgetPassword` | `/forgot-password` |
| `/auth/forgetPassword_instructions` | `/forgot-password/sent` |
| `/auth/reset_password/:token` | `/reset-password/[token]` |
| `/auth/access`, `/auth/error`, `/notfound` | `/access-denied`, `/error`, 404 |
| `/` (dashboard) | `/dashboard` |
| `/agents/list-agent-users` (+ processos do agente, transferência) | `/agents` |
| `/invoices/list-invoice`, `list-pending-invoice`, `list-overdue-invoice`, pagas | `/invoices?status=…` (+ criar, importar Excel/PDF) |
| `/process/list-process` (+ facturas do processo) | `/processes` |
| `/process/list-process-user-wallet` | `/processes/mine` |
| `/negociation/list-negociation` | `/negotiations` |
| criar negociação | `/negotiations/new` |
| `/clients/list-debtors` (+ criar/editar) | `/debtors`, `/debtors/[id]` |
| `/clients/list-user-wallet` (+ adicionar/transferir/remover) | `/wallet` |
| `/acess_control/list-users` · `list-roles` · `list-permissions` | `/access-control/users` · `roles` · `permissions` |
| `/configuration/lit-client-type` · `list-contact-type` · `list-organization` · `list-category` · `list-curriencies` | `/settings/client-types` · `contact-types` · `organizations` · `categories` · `currencies` |
| sino de notificações | sino + `/notifications` |
| — | `/profile` |
| — (novos, do backend) | `/payments`, `/creditors`, `/disputes`, `/ladders`, `/ladders/tasks`, `/negotiations/[id]`, `/negotiations/[id]/renegotiate`, `/outbox`, `/settings/payment-methods` |

## Estrutura

```
src/
  app/(auth)/        login, recuperação e redefinição de senha
  app/(app)/         área autenticada (sidebar + topbar)
  components/ui/     design system (Button, Input, DataTable, Modal, Drawer, Badge…)
  components/layout/ sidebar, topbar, paleta de comandos ⌘K
  components/shared/ formulários e blocos reutilizados por várias telas
  lib/api/           cliente HTTP + serviços da API NestJS
  types/models.ts    modelos (iguais aos do backend)
```

## Destaques de UX

- Paleta de comandos **⌘K / Ctrl+K** (páginas, acções rápidas, pesquisa de devedores)
- Tema claro/escuro, sidebar recolhível, layout responsivo (drawer no mobile)
- Tabelas com pesquisa, filtros, paginação, selecção múltipla e acções em massa
- Formulários em drawers laterais com validação inline
- Simulador de acordo com desconto ↔ valor, plano de parcelas editável e resumo fixo
- Estados vazios, skeletons de carregamento e toasts de feedback
