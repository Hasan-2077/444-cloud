#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
export AWS_PAGER=""

if [[ ! -f .env ]]; then
  echo "Missing .env."
  exit 1
fi

set -a
source .env
set +a

: "${AWS_REGION:?Missing AWS_REGION}"

if [[ ! -s instance_ids.txt ]]; then
  echo "No instance IDs found. Check EC2 before assuming cleanup is complete."
  exit 1
fi

mapfile -t IDS < instance_ids.txt

for id in "${IDS[@]}"; do
  if [[ ! "$id" =~ ^i-[0-9a-f]+$ ]]; then
    echo "Invalid instance ID: $id"
    exit 1
  fi
done

echo "Terminating instances:"
printf '%s\n' "${IDS[@]}"

aws ec2 terminate-instances \
  --instance-ids "${IDS[@]}" \
  --region "$AWS_REGION"

echo "Waiting for instances to terminate..."

aws ec2 wait instance-terminated \
  --instance-ids "${IDS[@]}" \
  --region "$AWS_REGION"

echo "All instances terminated successfully."
rm instance_ids.txt
