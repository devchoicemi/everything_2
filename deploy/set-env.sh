#!/usr/bin/env bash
# Safely set a secret in /opt/choicemi/.env without it appearing in your shell history,
# a chat, or the process list. Prompts for the value (hidden).
#   ./set-env.sh RESEND_API_KEY
#   ./set-env.sh MAIL_FROM          (visible, not secret: use --show)
#   ./set-env.sh SIGNICAT_CLIENT_SECRET
#   ./set-env.sh SIGNICAT_ENC_PRIVATE_JWK --file key.json   (read the value from a file, e.g. a long JSON key)
# Then apply it with: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

KEY="${1:-}"; SHOW="${2:-}"
[[ "$KEY" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "usage: ./set-env.sh KEY_NAME [--show]"; exit 2; }
[[ -f .env ]] || { echo ".env not found in $(pwd)"; exit 1; }

if [[ "$SHOW" == "--file" ]]; then
  FILE="${3:-}"; [[ -f "$FILE" ]] || { echo "file not found: $FILE"; exit 1; }
  VAL="$(tr -d '
' < "$FILE")"
elif [[ "$SHOW" == "--show" ]]; then read -r -p "$KEY: " VAL
else read -r -s -p "$KEY (hidden): " VAL; echo; fi
# Terminals can wrap pasted text in invisible markers (ESC[200~ ... ESC[201~): strip them, then trim.
VAL="$(printf '%s' "$VAL" | sed -e $'s/\[20[01]~//g' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
[[ -n "$VAL" ]] || { echo "empty value, nothing changed"; exit 1; }
[[ "$VAL" != *"'"* ]] || { echo "value contains a single quote, which .env cannot hold safely"; exit 1; }

# Wrap in single quotes when the value has characters that need it (spaces, braces, quotes, <>, #).
if [[ "$VAL" =~ [[:space:]\{\}\"\<\>\#] ]]; then VAL="'$VAL'"; fi

umask 077
tmp="$(mktemp)"
grep -v -E "^$KEY=" .env > "$tmp" || true
printf '%s=%s\n' "$KEY" "$VAL" >> "$tmp"
cat "$tmp" > .env
rm -f "$tmp"
chmod 600 .env
echo "$KEY updated in .env. Apply it with: ./deploy.sh"
