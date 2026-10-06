# mini-games

Prywatna platforma gier multiplayer w przeglądarce — koncept w [KONCEPT.md](KONCEPT.md).

## Dev

Wymaga Node 24 i pnpm 12.

```sh
pnpm install
pnpm --filter server dev   # http://localhost:2567
pnpm --filter web dev      # http://localhost:5173
pnpm typecheck && pnpm test
```

## Deploy (Raspberry Pi)

Push na `master` → CI buduje obraz `linux/arm64` → `ghcr.io/figielak/mini-games:latest`.

Jednorazowo:

1. **Cloudflare** (bez Zero Trust): domena `figielak.dev` dodana do konta Cloudflare (darmowy plan, nameservery u rejestratora
   wskazują na Cloudflare). Na dowolnej maszynie z [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/):

   ```sh
   cloudflared tunnel login                              # w przeglądarce wybierz figielak.dev
   cloudflared tunnel create games                       # tworzy ~/.cloudflared/<UUID>.json
   cloudflared tunnel route dns games games.figielak.dev # rekord CNAME na tunel
   ```

2. **GHCR**: ustaw pakiet jako publiczny albo na Pi `docker login ghcr.io` (PAT z `read:packages`).
3. **Pi**: skopiuj `docker-compose.yml` i katalog `cloudflared/`, a plik `<UUID>.json` z kroku 1 wrzuć jako
   `cloudflared/credentials.json` (`chmod 644`, bo kontener cloudflared działa jako inny użytkownik).
   Tunel łączy się z Pi na zewnątrz, więc działa za CGNAT i bez przekierowania portów.

Aktualizacja:

```sh
docker compose pull && docker compose up -d
```
