#!/usr/bin/env bash
# Inject google-services.json from EAS secret file into project root before build
if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
  echo "google-services.json injected from EAS secret."
else
  echo "WARNING: GOOGLE_SERVICES_JSON secret not set."
fi
