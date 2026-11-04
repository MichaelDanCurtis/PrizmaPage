#!/usr/bin/env bash
# Copilot OAuth one-shot: requests device code, opens browser, polls until
# token received, stores it in the keychain, then verifies with a live
# completion. Michael's only action: click Authorize at github.com/login/device.
#
# Usage: bash scripts/copilot-oauth-oneshot.sh
set -euo pipefail

CLIENT_ID="Iv1.b507a08c87ecfe98"
SERVICE="com.prizmapage.app"
ACCOUNT="copilot"
COMPLETIONS_URL="https://api.githubcopilot.com/v1/chat/completions"

echo "=== 1. Requesting device code from GitHub ==="
RESP=$(curl -sS -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -d "client_id=${CLIENT_ID}" \
  -d "scope=read:user")
DEVICE_CODE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['device_code'])")
USER_CODE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user_code'])")
VERIFY_URI=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['verification_uri'])")
INTERVAL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('interval',5))")
echo "user_code: $USER_CODE"
echo "verification_uri: $VERIFY_URI"

echo ""
echo "=== 2. Opening browser (click Authorize as yourself) ==="
open "$VERIFY_URI" 2>/dev/null || echo "(could not auto-open; visit $VERIFY_URI manually)"
echo "   Enter this code if prompted: $USER_CODE"
echo "   Then click Authorize."

echo ""
echo "=== 3. Polling for token (this completes within ~30s of you clicking Authorize) ==="
TOKEN=""
for i in $(seq 1 180); do
  sleep "$INTERVAL"
  POLL=$(curl -sS -X POST https://github.com/login/oauth/access_token \
    -H "Accept: application/json" \
    -d "client_id=${CLIENT_ID}" \
    -d "device_code=${DEVICE_CODE}" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:device_code")
  ERR=$(echo "$POLL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null || echo "")
  if [ "$ERR" = "authorization_pending" ] || [ "$ERR" = "slow_down" ]; then
    printf "."
    continue
  fi
  if [ -z "$ERR" ]; then
    TOKEN=$(echo "$POLL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
    if [ -n "$TOKEN" ]; then
      echo ""
      echo "✅ TOKEN RECEIVED (prefix: ${TOKEN:0:8}...)"
      break
    fi
  fi
  echo ""
  echo "❌ OAuth error: $ERR"
  echo "   Full response: $POLL"
  exit 1
done

if [ -z "$TOKEN" ]; then
  echo ""
  echo "❌ Timed out after 180 polls. Did you click Authorize?"
  exit 1
fi

echo ""
echo "=== 4. Storing token in macOS keychain (as PrizmaPage would) ==="
security add-generic-password -s "$SERVICE" -a "$ACCOUNT" -w "$TOKEN" -U 2>&1
echo "✅ Stored. Verifying retrieval:"
RET=$(security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w 2>/dev/null || echo "FAILED")
if [ "${RET:0:8}" = "${TOKEN:0:8}" ]; then
  echo "✅ Keychain round-trip OK"
else
  echo "❌ Keychain retrieval mismatch"
  exit 1
fi

echo ""
echo "=== 5. Proving the full chain with a LIVE completion via Copilot ==="
echo "   (POSTing a real prompt to $COMPLETIONS_URL with the bearer token)"
COMPLETION=$(curl -sS -X POST "$COMPLETIONS_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Reply with exactly: copilot live verified"}]}' \
  --max-time 30)
echo "Raw completion response:"
echo "$COMPLETION" | python3 -m json.tool 2>/dev/null || echo "$COMPLETION"

echo ""
echo "=== 6. Extracting the assistant's text ==="
TEXT=$(echo "$COMPLETION" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'])" 2>/dev/null || echo "(could not parse)")
echo "Copilot replied: $TEXT"

echo ""
echo "=== DONE ==="
echo "If step 5 returned real text, OAuth for Copilot is LIVE-VERIFIED end-to-end."
echo "Reply to the agent with the output above (especially the 'Copilot replied:' line)."
