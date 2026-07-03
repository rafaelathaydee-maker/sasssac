# Evolution API no Render

Este servico e separado do backend do Sasssac. Ele segura a conexao do WhatsApp por QR Code e envia as mensagens para o backend via webhook.

Imagem Docker usada: `evoapicloud/evolution-api:latest`.

## Criar no Render

1. Clique em `New` -> `Web Service`.
2. Escolha o mesmo repositorio `rafaelathaydee-maker/sasssac`.
3. Em `Root Directory`, coloque:

```txt
evolution-render
```

4. Em `Environment`, escolha `Docker`.
5. Nome sugerido:

```txt
sasssac-evolution
```

## Variaveis da Evolution

No servico `sasssac-evolution`, adicione:

```env
AUTHENTICATION_API_KEY=coloque-uma-chave-grande-aqui
SERVER_URL=https://URL-DA-EVOLUTION.onrender.com
CORS_ORIGIN=*
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_CLIENT_NAME=evolution_api
DATABASE_CONNECTION_URI=postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=evolution_api
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
```

Voce pode usar o mesmo Postgres do Sasssac. Pegue a `External Database URL` ou `Internal Database URL` do banco no Render e adicione `?schema=evolution_api` no final. Se a URL ja tiver `?sslmode=require`, use `&schema=evolution_api`.

Se o log mostrar `Database URL:` vazio ou tentar conectar em `postgres:5432`, a variavel `DATABASE_CONNECTION_URI` nao foi adicionada no servico `sasssac-evolution` ou foi escrita com outro nome.

Depois que a Evolution estiver live, volte no backend `sasssac-backend` e adicione:

```env
EVOLUTION_API_URL=https://URL-DA-EVOLUTION.onrender.com
EVOLUTION_API_KEY=a-mesma-chave-do-AUTHENTICATION_API_KEY
PUBLIC_API_URL=https://URL-DO-BACKEND.onrender.com
```

Depois disso, no painel do Sasssac:

```txt
Equipe e canais -> Conectar WhatsApp -> escanear QR Code
```
