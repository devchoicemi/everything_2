#!/usr/bin/env bash
# Tests the email connection WITHOUT sending anything or showing any secret.
#   cd /opt/choicemi && ./check-mail.sh
# For AhaSend it makes a "sandbox" request: AhaSend validates the key, the account id and that the
# sender domain is verified, but delivers nothing.
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T app node -e '
(async () => {
  const provider = (process.env.MAIL_PROVIDER || "").toLowerCase() || (process.env.AHASEND_API_KEY ? "ahasend" : process.env.RESEND_API_KEY ? "resend" : "none");
  console.log("provider in use:", provider, "| sender:", process.env.MAIL_FROM || "(not set)");
  if (provider === "ahasend") {
    const id = process.env.AHASEND_ACCOUNT_ID, key = process.env.AHASEND_API_KEY;
    console.log("account id set:", Boolean(id), "| key looks right (aha-sk-…):", /^aha-sk-/.test(key || ""), "| key length:", (key || "").length);
    const m = /^(.*?)\s*<([^>]+)>$/.exec(process.env.MAIL_FROM || "");
    const from = m ? { name: m[1].trim(), email: m[2].trim() } : { email: process.env.MAIL_FROM };
    const r = await fetch("https://api.ahasend.com/v2/accounts/" + id + "/messages", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, recipients: [{ email: "sandbox-check@example.com" }], subject: "ChoiceMi sandbox check", text_content: "Sandbox check. Nothing is delivered.", sandbox: true }),
    });
    const t = await r.text();
    console.log("AhaSend answered HTTP " + r.status + ":", t.slice(0, 300));
    console.log(r.status === 202 ? "OK: key, account and sender domain are accepted." : r.status === 401 ? "PROBLEM: the key or account id is wrong." : r.status === 403 ? "PROBLEM: the sender domain is not verified yet, or the key may not send from it." : "PROBLEM: see the answer above.");
    process.exit(r.status === 202 ? 0 : 1);
  }
  if (provider === "resend") {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY } });
    console.log("Resend answered HTTP " + r.status);
    process.exit(r.ok || r.status === 401 ? 0 : 1);
  }
  console.log("No email provider is set up yet."); process.exit(1);
})().catch((e) => { console.error("request failed: " + e.message); process.exit(1); });
' </dev/null
