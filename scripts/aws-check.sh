#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-iu-cloud-admin}"
REGION="${AWS_REGION:-eu-central-1}"

python3 -m py_compile scripts/aws-publish.py
node --check aws/lambda/index.js
node --check aws/lambda/handler.js
node --check aws/lambda/dynamo-store.js

if [[ ! -f aws/lambda/package-lock.json ]]; then
  echo "package-lock.json fehlt. Bitte zuerst ausführen:"
  echo "npm install --prefix aws/lambda"
  exit 1
fi

npm test

aws cloudformation validate-template \
  --template-body file://infra/aws/template.yaml \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output json >/dev/null

echo "AWS-Dateien syntaktisch geprüft, lokale Tests bestanden und CloudFormation-Template validiert. Keine Anwendungsressourcen erstellt."
