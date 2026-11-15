#!/bin/bash
# Package VeggieConnect3_3 deliverable zip (source project, ready to run:
# npm install -> npm run dev). Excludes sandbox-only dirs and heavy artifacts.
set -euo pipefail
cd /home/z/my-project

OUT=download/VeggieConnect3_3.zip
mkdir -p download
rm -f "$OUT"

zip -r -q "$OUT" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "download/*" \
  -x "upload/*" \
  -x "skills/*" \
  -x ".aistudio/*" \
  -x "Backup/*" \
  -x "scripts/server_up.sh" \
  -x "scripts/e2e_*" \
  -x "scripts/test_*" \
  -x "data/server_store.json" \
  -x "*.log" \
  -x ".env"

echo "== packaged: $OUT =="
ls -la "$OUT"
echo "== integrity check: key files =="
unzip -l "$OUT" | rg "src/components/(WalletView|RequestCropsModal|AddProduceModal|MobileFrame|AdminApp|VerificationReviewModal|LoginRegisterView)|src/utils/(sourcing|orderDates|pricing|verification)|src/data/(daPricesData|produceSuggestions)|server.ts|package.json" || echo "MISSING FILES!"
