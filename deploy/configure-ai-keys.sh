#!/usr/bin/env bash
# Run this ON THE VPS (72.62.185.212) as root.
#
# Recommended — pass keys as environment variables (avoids terminal paste
# issues entirely, since there's no interactive read involved):
#
#   DEEPSEEK_API_KEY='sk-...' OPENAI_API_KEY='sk-...' bash configure-ai-keys.sh
#
# You can pass just one if you only have one ready:
#   DEEPSEEK_API_KEY='sk-...' bash configure-ai-keys.sh
#
# Or run with no variables set for interactive hidden-input prompts instead.
#
# DeepSeek powers chat (GRIK Mini) + photo analysis (GRIK Vision).
# OpenAI powers voice (transcription + text-to-speech).
# Each key is verified against the real provider before being saved —
# nothing is written to disk until it's confirmed to actually work.
set -euo pipefail

ENV_FILE="/var/www/agrik/api/.env"
SERVICE_NAME="agrik-api"

if [ "$EUID" -ne 0 ]; then
  echo "Run this as root (sudo bash configure-ai-keys.sh)." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Cannot find $ENV_FILE — run this on the VPS, not locally." >&2
  exit 1
fi

# Strip everything but printable, non-whitespace characters. Guards against
# stray newlines/spaces/control characters riding along with a pasted key.
clean_key() {
  printf '%s' "$1" | tr -d '[:space:]'
}

set_env_var() {
  local key="$1"
  local value="$2"
  grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp" || true
  echo "${key}=${value}" >> "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  chown agrik:agrik "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

echo "=== AGRIK AI configuration ==="
echo

DEEPSEEK_KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$DEEPSEEK_KEY" ]; then
  echo "DeepSeek powers chat (GRIK Mini) and photo analysis (GRIK Vision)."
  read -rsp "DEEPSEEK_API_KEY (hidden, blank to skip): " DEEPSEEK_KEY
  echo
fi
DEEPSEEK_KEY=$(clean_key "$DEEPSEEK_KEY")

if [ -z "$DEEPSEEK_KEY" ]; then
  echo "Skipped DeepSeek."
else
  echo "Verifying against the live DeepSeek API (key ends in ...${DEEPSEEK_KEY: -4})..."
  DS_RESPONSE=$(curl -s -w "\n%{http_code}" https://api.deepseek.com/models -H "Authorization: Bearer $DEEPSEEK_KEY")
  DS_STATUS=$(echo "$DS_RESPONSE" | tail -n1)
  if [ "$DS_STATUS" = "200" ]; then
    echo "DeepSeek key verified."
    set_env_var "DEEPSEEK_API_KEY" "$DEEPSEEK_KEY"
  else
    echo "DeepSeek check failed (HTTP $DS_STATUS). Response:" >&2
    echo "$DS_RESPONSE" | sed '$d' >&2
    echo "Nothing was saved." >&2
    echo "If you're sure this key is correct, re-run with it as an env var to rule out paste corruption:" >&2
    echo "  DEEPSEEK_API_KEY='...' bash configure-ai-keys.sh" >&2
    exit 1
  fi
fi

echo
OPENAI_KEY="${OPENAI_API_KEY:-}"
if [ -z "$OPENAI_KEY" ]; then
  echo "OpenAI powers voice: transcription and text-to-speech."
  read -rsp "OPENAI_API_KEY (hidden, blank to skip): " OPENAI_KEY
  echo
fi
OPENAI_KEY=$(clean_key "$OPENAI_KEY")

if [ -z "$OPENAI_KEY" ]; then
  echo "Skipped OpenAI."
else
  echo "Verifying against the live OpenAI API (key ends in ...${OPENAI_KEY: -4})..."
  OA_RESPONSE=$(curl -s -w "\n%{http_code}" https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_KEY")
  OA_STATUS=$(echo "$OA_RESPONSE" | tail -n1)
  if [ "$OA_STATUS" = "200" ]; then
    echo "OpenAI key verified."
    set_env_var "OPENAI_API_KEY" "$OPENAI_KEY"
  else
    echo "OpenAI check failed (HTTP $OA_STATUS). Response:" >&2
    echo "$OA_RESPONSE" | sed '$d' >&2
    echo "Nothing was saved." >&2
    echo "If you're sure this key is correct, re-run with it as an env var to rule out paste corruption:" >&2
    echo "  OPENAI_API_KEY='...' bash configure-ai-keys.sh" >&2
    exit 1
  fi
fi

echo
echo "Restarting $SERVICE_NAME..."
systemctl restart "$SERVICE_NAME"
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "Service is running."
else
  echo "Service failed to restart — check: journalctl -u $SERVICE_NAME -n 50" >&2
  exit 1
fi

echo
curl -s http://127.0.0.1:8000/health
echo
echo "Done. Sign in to the app and try GRIK Brain — chat, photo analysis, and voice should all work now."
