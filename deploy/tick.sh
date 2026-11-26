#!/usr/bin/env bash
# Runs the booking clock: reminders, expiries, day-before notices, auto-close. Call it every 5 minutes from cron:
#   */5 * * * * /opt/choicemi/tick.sh >> /opt/choicemi/tick.log 2>&1
# It needs TICK_SECRET in /opt/choicemi/.env (a long random string; set it with ./set-env.sh TICK_SECRET).
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T app node -e '
  fetch("http://127.0.0.1:3000/api/v1/admin/tick", { method: "POST", headers: { "x-tick-secret": process.env.TICK_SECRET || "", "Content-Type": "application/json" }, body: "{}" })
    .then(async (r) => { console.log(new Date().toISOString() + " HTTP " + r.status + " " + (await r.text())); process.exit(r.ok ? 0 : 1); })
    .catch((e) => { console.error(new Date().toISOString() + " failed: " + e.message); process.exit(1); });
' </dev/null
