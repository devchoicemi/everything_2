#!/usr/bin/env bash
# One command to connect AhaSend. No arguments; it asks for the two values.
#   ~/set-ahasend.sh
# Account ID is shown as you type (it is an identifier, not a secret). The API key is hidden.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

echo "Step 1 of 2: your AhaSend ACCOUNT ID (a UUID like 1b2c3d4e-....; find it in the AhaSend dashboard)."
./set-env.sh AHASEND_ACCOUNT_ID --show || exit 1
echo
echo "Step 2 of 2: your AhaSend API KEY (starts with aha-sk-). Paste it and press Enter; nothing shows."
./set-env.sh AHASEND_API_KEY || exit 1

if ! grep -q "^AHASEND_API_KEY=aha-sk-" .env; then
  echo "That does not look like an AhaSend key (they start with aha-sk-). Run ~/set-ahasend.sh again."
  exit 1
fi
printf 'ahasend\n' | ./set-env.sh MAIL_PROVIDER --show >/dev/null
echo "Saved. Restarting the app..."
./deploy.sh >/dev/null 2>&1
sleep 8
echo "Testing the connection (nothing is sent)..."
./check-mail.sh || { echo; echo "The connection test did not pass. Fix what it says, then run ~/set-ahasend.sh again."; exit 1; }
echo
echo "AhaSend is now the email provider. Test a real email with:  ./invite-waitlist.sh send-to --direct you@example.com"
