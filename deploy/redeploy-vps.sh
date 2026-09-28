#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
if [[ "$project_dir" != "/home/ubuntu/BoumaticAPP" ]]; then
  echo "Ce script doit etre lance depuis le projet du VPS : /home/ubuntu/BoumaticAPP." >&2
  exit 1
fi

cd "$project_dir"
compose=(docker compose -f docker-compose.yml -f docker-compose.https.yml)
"${compose[@]}" config --quiet
"${compose[@]}" up -d --build --no-deps backend frontend

mkdir -p Frontend/dist
docker cp boumaticapp-frontend-1:/app/dist/. Frontend/dist/
sudo chmod o+x "$(dirname "$project_dir")" "$project_dir" "$project_dir/Frontend"
sudo chmod -R o+rX "$project_dir/Frontend/dist"

if [[ ! -s Frontend/dist/index.html ]]; then
  echo "Le build web n'a pas ete copie dans Frontend/dist." >&2
  exit 1
fi

asset="$(grep -oE '/assets/index-[^\"]+\.js' Frontend/dist/index.html | head -n 1 || true)"
if [[ -z "$asset" || ! -f "Frontend/dist$asset" ]]; then
  echo "Le fichier JavaScript reference par index.html est introuvable." >&2
  exit 1
fi
if grep -qF ':4000/api' "Frontend/dist$asset"; then
  echo "Le build web utilise encore l'ancienne API sur le port 4000." >&2
  exit 1
fi

backend_status=""
for ((attempt = 0; attempt < 30; attempt++)); do
  backend_status="$(curl --max-time 3 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/auth/session 2>/dev/null || true)"
  if [[ "$backend_status" == "401" ]]; then break; fi
  sleep 2
done
if [[ "$backend_status" != "401" ]]; then
  echo "Le backend ne repond pas correctement sur 127.0.0.1:4000 (HTTP $backend_status)." >&2
  exit 1
fi

site_status="$(curl --max-time 10 -sS -o /dev/null -w '%{http_code}' https://techplanner.fr/ || true)"
api_status="$(curl --max-time 10 -sS -o /dev/null -w '%{http_code}' https://techplanner.fr/api/auth/session || true)"
origin_status="$(curl --max-time 10 -sS -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://techplanner.fr' https://techplanner.fr/api/auth/logout || true)"

if [[ "$site_status" != "200" || "$api_status" != "401" || "$origin_status" != "401" ]]; then
  echo "Verification echouee : site HTTP $site_status, API HTTP $api_status, origine HTTP $origin_status." >&2
  exit 1
fi

echo "Deploiement verifie : site HTTP 200, API HTTP 401, origine HTTPS HTTP 401."
