# Deploy automático: GitHub Actions + Portainer + Docker Swarm

O workflow `.github/workflows/deploy.yml` executa a cada `push` para `main`:

1. cria as imagens da API e do frontend;
2. publica-as no GitHub Container Registry (GHCR);
3. chama o webhook do stack no Portainer, que atualiza os serviços no Docker Swarm.

## Configuração única no GitHub

No repositório, abra **Settings > Secrets and variables > Actions** e crie o secret:

| Secret | Valor |
| --- | --- |
| `PORTAINER_WEBHOOK_URL` | URL completa do webhook de atualização do stack, copiada do Portainer |

O `GITHUB_TOKEN` usado para publicar no GHCR é fornecido automaticamente pelo GitHub Actions. O workflow publica as imagens:

```text
ghcr.io/rlstech/licitacat-api:latest
ghcr.io/rlstech/licitacat-web:latest
```

Ele também publica uma tag imutável com o SHA do commit, útil para auditoria e rollback.

## Configuração única no Portainer

1. Abra o stack `licitacat` no ambiente Docker Swarm.
2. Configure-o como um stack proveniente deste repositório Git, branch `main`, arquivo `docker-stack.yml`. Assim, o webhook baixa a revisão recém-enviada antes do redeploy.
3. Em **Environment variables**, defina:

   ```text
   LICITACAT_API_IMAGE=ghcr.io/rlstech/licitacat-api:latest
   LICITACAT_WEB_IMAGE=ghcr.io/rlstech/licitacat-web:latest
   ```

4. Se os pacotes GHCR forem privados, crie/configure uma credencial de registry no Portainer para `ghcr.io` e associe-a ao stack. Use um GitHub Personal Access Token com escopo `read:packages` como senha. Se os pacotes forem públicos, isso não é necessário.
5. Habilite a opção de sempre obter a imagem atual antes do deploy, se a versão do Portainer a oferecer.
6. Copie o **Webhook URL** do stack e grave-o no secret `PORTAINER_WEBHOOK_URL` no GitHub.

O webhook é uma credencial de deploy: não o coloque em arquivos, commits, issues ou logs.

## Desenvolvimento local usando a API e a autenticação da VPS

O backend permite `http://localhost:3000` e `http://localhost:3100` via `CORS_ALLOWED_ORIGINS`. A autenticação Better Auth também reconhece essas origens. Após o primeiro deploy desta alteração, valide:

```powershell
curl.exe -i -X OPTIONS "https://api.licitacat.railton.eu.org/api/dashboard/summary" `
  -H "Origin: http://localhost:3000" `
  -H "Access-Control-Request-Method: GET"
```

A resposta deve incluir `Access-Control-Allow-Origin: http://localhost:3000` (ou `http://localhost:3100`, conforme a porta usada).

O frontend local usa o endpoint Better Auth em produção; assim, não é preciso expor, tunelar ou copiar o PostgreSQL. Crie `apps/web/.env.local` (não versionado):

```dotenv
NEXT_PUBLIC_API_URL=https://api.licitacat.railton.eu.org
NEXT_PUBLIC_BETTER_AUTH_URL=https://licitacat.railton.eu.org
LOCAL_DEV_USE_REMOTE_AUTH=true
```

Inicie apenas o frontend:

```powershell
$env:PORT=3100 # use 3000 se estiver livre
pnpm --filter @licitacat/web dev
```

`LOCAL_DEV_USE_REMOTE_AUTH` é um bypass de middleware limitado ao frontend local: a sessão e as permissões continuam sendo validadas pela API e pelo Better Auth da VPS. Não use essa variável em produção. Não use `pnpm dev` neste modo: ele também iniciaria a API local e suas dependências.

## Operação e rollback

- Todo push na `main` atualiza produção depois da configuração acima.
- Para voltar a uma versão, em Portainer altere temporariamente `LICITACAT_API_IMAGE` e/ou `LICITACAT_WEB_IMAGE` para a tag SHA desejada e redeploye o stack.
- Antes do primeiro deploy automático, faça um push pequeno e confirme no GitHub Actions que as imagens foram publicadas e que o webhook retornou sucesso.
