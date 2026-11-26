#!/usr/bin/env bash
# Set up a restaurant ChoiceMi has agreed with directly. Run on the server in /opt/choicemi.
# The admin token never leaves the server: the call is made from inside the app container.
#
#   ./partners.sh add "Venue name" owner@x.com ["Area"] ["Street address"]
#                                  creates the venue and emails the owner a link to create their sign-in
#
# Restaurants that find us themselves start an application at https://restaurant.choicemi.com, and ChoiceMi staff
# review it at https://admin.choicemi.com (Venues). Only staff accounts can approve: see ./staff.sh.
# Invitations are emailed, so mail must be set up (see check-mail.sh).
set -euo pipefail
cd "$(dirname "$0")"

CMD="${1:-}"
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

json_str() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

case "$CMD" in
  add) [[ $# -ge 2 ]] || { echo "usage: ./partners.sh add \"Venue name\" owner@x.com [\"Area\"] [\"Street address\"]"; exit 2; }
       call POST /api/v1/admin/partners/create "{\"venueName\":\"$(json_str "$1")\",\"email\":\"$(json_str "$2")\",\"area\":\"$(json_str "${3:-}")\",\"address\":\"$(json_str "${4:-}")\"}" ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
