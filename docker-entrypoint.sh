#!/bin/sh
# =============================================================================
# docker-entrypoint.sh
# Writes runtime environment variables into env.js so the SPA can access them
# without baking secrets into the image layers.
#
# Usage in the app:
#   <script src="/quark-customer-success/env.js"></script>
#   const apiKey = window.__ENV__?.GEMINI_API_KEY ?? '';
# =============================================================================

set -e

ENV_JS_PATH="/usr/share/nginx/html/quark-customer-success/env.js"

echo "=== Generating runtime env.js ==="
cat > "${ENV_JS_PATH}" <<EOF
window.__ENV__ = {
  GEMINI_API_KEY: "${GEMINI_API_KEY:-}",
  APP_URL: "${APP_URL:-}"
};
EOF

echo "=== env.js written to ${ENV_JS_PATH} ==="

exec "$@"
