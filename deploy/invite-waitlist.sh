#!/usr/bin/env bash
# Manage the waitlist and send invitations. Run on the server in /opt/choicemi.
# The admin token never leaves the server: the call is made from inside the app container.
#
#   ./invite-waitlist.sh status                  counts: waiting / invited / joined
#   ./invite-waitlist.sh list [waiting|invited|joined]
#   ./invite-waitlist.sh preview [N]             who WOULD be invited (nothing is sent)
#   ./invite-waitlist.sh send [N]                email invitations to the oldest N waiting (default 25)
#   ./invite-waitlist.sh send-to a@x.com b@y.com invite these specific waitlisted people
#   ./invite-waitlist.sh send-to --direct me@x.com  invite someone who is NOT on the waitlist (e.g. yourself, to test)
#   ./invite-waitlist.sh auto                    for cron: sends INVITES_PER_RUN invitations, only if INVITES_AUTO=1 in .env
#
# Invitations are emailed through Resend, so RESEND_API_KEY and MAIL_FROM must be set first.
set -euo pipefail
cd "$(dirname "$0")"

CMD="${1:-status}"
shift || true

call() { # method path [json-body]
  docker compose exec -T app node -e '
    const [method, path, body] = process.argv.slice(1);
    fetch("http://127.0.0.1:3000" + path, {
      method,
      headers: { Authorization: "Bearer " + process.env.ADMIN_TOKEN, "Content-Type": "application/json" },
      body: method === "GET" ? undefined : body || "{}",
    }).then(async (r) => {
      const text = await r.text();
      let out = text;
      try { out = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      console.log("HTTP " + r.status + "\n" + out);
      process.exit(r.ok ? 0 : 1);
    }).catch((e) => { console.error("request failed: " + e.message); process.exit(1); });
  ' "$@" </dev/null
}

env_value() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d "'\"" || true; }

case "$CMD" in
  status)  call GET "/api/v1/admin/waitlist?limit=1" | sed -n '1,12p' ;;
  list)    call GET "/api/v1/admin/waitlist?limit=500${1:+&status=$1}" ;;
  preview) call POST /api/v1/admin/invites "{\"limit\":${1:-25},\"dryRun\":true}" ;;
  send)    call POST /api/v1/admin/invites "{\"limit\":${1:-25}}" ;;
  send-to)
    direct=false; [[ "${1:-}" == "--direct" ]] && { direct=true; shift; }
    [[ $# -ge 1 ]] || { echo "give at least one email address"; exit 2; }
    emails=$(printf '"%s",' "$@"); call POST /api/v1/admin/invites "{\"emails\":[${emails%,}],\"allowDirect\":$direct}" ;;
  auto)
    [[ "$(env_value INVITES_AUTO)" == "1" ]] || exit 0
    n="$(env_value INVITES_PER_RUN)"; n="${n:-25}"
    echo "$(date -u +%FT%TZ) auto-invite up to $n"
    call POST /api/v1/admin/invites "{\"limit\":$n}" ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
