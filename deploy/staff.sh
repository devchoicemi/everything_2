#!/usr/bin/env bash
# Manage ChoiceMi's own staff accounts. Run on the server in /opt/choicemi.
# The admin token never leaves the server: the call is made from inside the app container.
#
#   ./staff.sh invite you@choicemi.com super_admin     emails a personal link to create the sign-in (staff site)
#   ./staff.sh list                                    who is on the team, with their roles
#   ./staff.sh roles                                   the roles and what each may do
#
# Roles: super_admin, admin, support_agent, kyc_officer, partner_manager, moderator, auditor.
# After the first super admin exists, they invite everyone else from https://admin.choicemi.com (Team & roles).
set -euo pipefail
cd "$(dirname "$0")"

CMD="${1:-list}"
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

case "$CMD" in
  invite) [[ $# -ge 2 ]] || { echo "usage: ./staff.sh invite you@choicemi.com super_admin"; exit 2; }
          call POST /api/v1/admin/staff/invite "{\"email\":\"$1\",\"role\":\"$2\"}" ;;
  list)   call GET /api/v1/admin/staff ;;
  roles)  call GET /api/v1/admin/staff | sed -n '/"roles"/,$p' ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
