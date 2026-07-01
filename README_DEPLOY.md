# Deploy em produção

## 1. Domínio

- `saaschat.com` -> A record pro servidor (ou CNAME pra Vercel/Render/etc).
- `*.saaschat.com` -> mesmo destino (wildcard). Sem isso, subdomínio de empresa não resolve.
- SSL: certificado wildcard (`*.saaschat.com`). Let's Encrypt via desafio DNS-01 (Certbot
  com plugin do seu provedor de DNS, ou Cloudflare com "Full SSL" + proxy ligado).

## 2. Variáveis de ambiente (backend)

Preencher tudo em `backend/.env.example` antes de subir. Itens críticos pra produção:
- `JWT_SECRET`: gerar um valor forte (`openssl rand -base64 32`), nunca o de exemplo.
- `ROOT_DOMAIN=saaschat.com`
- `CORS_ORIGIN`: domínio do frontend em produção.
- `NODE_ENV=production` (logs em JSON, mensagens de erro genéricas pro cliente).
- `WHATSAPP_APP_SECRET` / `WHATSAPP_VERIFY_TOKEN`: do App da Meta.
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`: troque a senha padrão antes do primeiro deploy.
- `DATABASE_URL`: string do Postgres gerenciado (RDS, Supabase, Railway, etc).

## 3. Banco de dados

```bash
npx prisma migrate deploy   # aplica as migrations (não usa "dev")
npm run seed                # só na primeira vez, cria planos + super admin
```
Backup automático: configure snapshot diário do provedor gerenciado (todos oferecem) —
isso cobre o banco inteiro. Para exportar os dados de uma empresa especificamente, use
`GET /api/admin/companies/:id/export` (ou `GET /api/company/export` como ADMIN da empresa).

## 4. Backend (Node)

Build e start:
```bash
npm run build
npm run start   # node dist/server.js
```
Rodar com um supervisor de processo (PM2, systemd, ou container) que reinicia em caso de
crash — o `server.ts` já loga `uncaughtException`/`unhandledRejection`, mas não impede o
processo de cair; o supervisor é quem garante o restart.

**WebSocket em produção**: se for rodar **mais de uma instância** do backend atrás de um
load balancer, é obrigatório usar sticky sessions (afinidade por IP/cookie) OU o adapter
Redis do Socket.io (`@socket.io/redis-adapter`) — sem isso, dois agentes conectados em
instâncias diferentes não recebem os eventos um do outro. Com **uma instância só**, não
precisa de nada extra.

Exemplo de Nginx como proxy (preciso preservar o `Host` original — é dele que sai o
subdomínio da empresa):
```nginx
server {
  listen 443 ssl;
  server_name saaschat.com *.saaschat.com;

  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 5. Frontend

```bash
npm run build   # gera frontend/dist
```
Servir `dist/` como estático (Nginx, Vercel, Netlify, S3+CloudFront). Configurar
`VITE_API_URL` no build apontando pro domínio da API. Como o frontend é uma SPA,
configurar fallback de rota pra `index.html` (qualquer rota não encontrada cai nele).

## 6. WhatsApp Cloud API

No painel da Meta, o webhook é cadastrado **uma vez só** (`https://saaschat.com/api/webhooks/whatsapp`),
não por empresa — a empresa certa é resolvida internamente pelo `phone_number_id`
(ver `ChannelConfig.externalAccountId`). Cada empresa configura o próprio número/token
em `/team` (token fica isolado por empresa, nunca exposto de volta pela API).

## 7. Confiabilidade

- Mensagens de saída que falham (WhatsApp fora do ar, token expirado, etc.) entram numa
  fila persistida (`OutboundQueueItem`) com retry exponencial (até 6 tentativas, ~6h de
  janela total) — sobrevive a restart do processo. Depois disso a mensagem fica `FAILED`
  permanentemente e o agente vê o estado na conversa.
- Toda ação administrativa relevante (criar/suspender empresa, criar/editar/remover
  usuário, mudar configuração, conectar WhatsApp) grava em `AuditLog`, consultável em
  `GET /api/admin/audit-logs`.
