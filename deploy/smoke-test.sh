#!/bin/sh
# Starts the built image and checks that what nginx and the sync server do
# together still works: the app and data are served with the security headers,
# login and sync round-trip, the login rate limit holds for every spelling of
# the path, and the sync server runs as the unprivileged node user.
#
#   deploy/smoke-test.sh <image>          (CI runs it before publishing)
#
# Needs docker, curl and jq. Uses host port 18080.
set -eu

IMAGE="$1"
NAME="pokedex-smoke-$$"
BASE="http://127.0.0.1:18080"

fail() {
  echo "FAIL: $*" >&2
  echo "── container logs ──" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -p 18080:80 \
  -e APP_USER=smoke -e APP_PASSWORD=smoke-password -e SYNC_TOKEN=smoke-token \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  curl -fs "$BASE/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fs "$BASE/health" | jq -e '.ok and .loginEnabled and .syncEnabled' >/dev/null || fail "/health"
echo "ok   /health"

curl -fs "$BASE/" | grep -q '<div id="root">' || fail "index.html"
curl -fsI "$BASE/" | grep -qi '^content-security-policy:' || fail "no Content-Security-Policy on /"
curl -fsI "$BASE/data/pokemon.json" | grep -qi '^content-security-policy:' || fail "no security headers on /data/"
curl -fs -o /dev/null "$BASE/data/pokemon.json" || fail "/data/pokemon.json"
echo "ok   app, data and security headers"

login() { curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2"; }
TOKEN=$(curl -fs -X POST "$BASE/api/login" -H 'Content-Type: application/json' \
  -d '{"username":"smoke","password":"smoke-password"}' | jq -r .token)
[ "$TOKEN" = "smoke-token" ] || fail "login did not hand out the token"
[ "$(login /api/Login '{"username":"smoke","password":"smoke-password"}')" = 404 ] || fail "/api/Login answered"
[ "$(login /api/login/ '{"username":"smoke","password":"smoke-password"}')" = 404 ] || fail "/api/login/ answered"
echo "ok   login, and only on its exact path"

AUTH="Authorization: Bearer $TOKEN"
curl -fs -X POST "$BASE/api/push" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"data":{"version":2,"smoke":true},"baseVersion":0}' | jq -e '.version == 1' >/dev/null || fail "push"
curl -fs "$BASE/api/pull" -H "$AUTH" | jq -e '.data.smoke == true and (.serverTime | type == "number")' >/dev/null || fail "pull"
curl -fs "$BASE/api/pull?since=1" -H "$AUTH" | jq -e '.unchanged == true' >/dev/null || fail "pull ?since"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/pull")" = 401 ] || fail "pull without a token"
echo "ok   push, pull, auth"

# The sync server runs as node, and what it wrote is node's
USER_OF_SERVER=$(docker exec "$NAME" sh -c 'ps -o user,args | grep "[s]ync-server/server.js" | head -1' | awk '{print $1}')
[ "$USER_OF_SERVER" = "node" ] || fail "sync server runs as '$USER_OF_SERVER', not node"
[ "$(docker exec "$NAME" stat -c %U /data/sync.json)" = "node" ] || fail "/data/sync.json isn't owned by node"
echo "ok   sync server runs as node"

# Login rate limit: 10/minute with a burst of 5, for every spelling of the path
LIMITED=0
for path in /api/login /api/Login /api/login/ /api/LOGIN /api/login /api/Login /api/login/ /api/LOGIN \
            /api/login /api/Login /api/login/ /api/LOGIN /api/login /api/Login; do
  [ "$(login "$path" '{"username":"x","password":"y"}')" = 503 ] && LIMITED=$((LIMITED + 1))
done
[ "$LIMITED" -ge 5 ] || fail "only $LIMITED of 14 rapid logins were rate-limited"
echo "ok   login rate limit ($LIMITED of 14 refused)"

echo "Smoke test passed"
