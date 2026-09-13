#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
export AWS_PAGER=""

if [[ ! -f .env ]]; then
  echo "Missing .env. Create it using .env.example."
  exit 1
fi

set -a
source .env
set +a

: "${AWS_REGION:?Missing AWS_REGION}"
: "${AMI_ID:?Missing AMI_ID}"
: "${KEY_NAME:?Missing KEY_NAME}"
: "${SECURITY_GROUP_ID:?Missing SECURITY_GROUP_ID}"
: "${SUBNET_ID:?Missing SUBNET_ID}"
: "${INSTANCE_TYPE:?Missing INSTANCE_TYPE}"
: "${INSTANCE_COUNT:?Missing INSTANCE_COUNT}"
: "${NAME_TAG:?Missing NAME_TAG}"

if [[ -f instance_ids.txt ]]; then
  echo "instance_ids.txt already exists."
  echo "Clean up the previous instances before launching another set."
  exit 1
fi

echo "Launching $INSTANCE_COUNT instance(s) in $AWS_REGION..."

OUTPUT=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SECURITY_GROUP_ID" \
  --count "$INSTANCE_COUNT" \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=$NAME_TAG}]" \
  --region "$AWS_REGION" \
  --query 'Instances[*].InstanceId' \
  --output text)

printf '%s\n' "$OUTPUT" | tr '\t' '\n' > instance_ids.txt

echo "Launched instance IDs:"
cat instance_ids.txt
echo "Instance IDs saved to instance_ids.txt"
