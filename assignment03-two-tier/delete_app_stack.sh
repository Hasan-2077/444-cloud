#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
export AWS_PAGER=""

trap 'echo "Cleanup failed on line $LINENO. Fix the error, then rerun." >&2' ERR

set -a
source .env
set +a

: "${AWS_REGION:?Missing AWS_REGION}"
: "${BUCKET_NAME:?Missing BUCKET_NAME}"
: "${APP_SG_ID:?Missing APP_SG_ID}"

STACK_NAME="itmo-444-544-lab03"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Finding assignment instances..."
INSTANCE_IDS=$(aws ec2 describe-instances \
  --filters \
    "Name=tag:Project,Values=$STACK_NAME" \
    "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down" \
  --query 'Reservations[].Instances[].InstanceId' \
  --output text --region "$AWS_REGION")

if [[ -n "$INSTANCE_IDS" ]]; then
  read -r -a IDS <<< "$(echo "$INSTANCE_IDS" | tr '\n' ' ')"

  aws ec2 terminate-instances \
    --instance-ids "${IDS[@]}" \
    --region "$AWS_REGION" >/dev/null

  echo "Waiting for instances to terminate..."
  aws ec2 wait instance-terminated \
    --instance-ids "${IDS[@]}" \
    --region "$AWS_REGION"
else
  echo "No assignment instances remain."
fi

for app in uploader viewer; do
  TEMPLATE_NAME="itmo-444-544-${app}-lt"

  TEMPLATE_ID=$(aws ec2 describe-launch-templates \
    --filters "Name=launch-template-name,Values=$TEMPLATE_NAME" \
    --query 'LaunchTemplates[0].LaunchTemplateId' \
    --output text --region "$AWS_REGION")

  if [[ -n "$TEMPLATE_ID" && "$TEMPLATE_ID" != "None" ]]; then
    aws ec2 delete-launch-template \
      --launch-template-id "$TEMPLATE_ID" \
      --region "$AWS_REGION" >/dev/null
    echo "Deleted $TEMPLATE_NAME"
  fi
done

for app in uploader viewer; do
  ROLE="itmo-444-544-${app}-role"
  PROFILE="itmo-444-544-${app}-profile"

  EXISTING_PROFILE=$(aws iam list-instance-profiles \
    --query "InstanceProfiles[?InstanceProfileName=='${PROFILE}'].InstanceProfileName" \
    --output text)

  if [[ -n "$EXISTING_PROFILE" ]]; then
    ATTACHED_ROLE=$(aws iam get-instance-profile \
      --instance-profile-name "$PROFILE" \
      --query 'InstanceProfile.Roles[].RoleName' --output text)

    if [[ -n "$ATTACHED_ROLE" ]]; then
      if [[ "$ATTACHED_ROLE" != "$ROLE" ]]; then
        echo "Unexpected role in $PROFILE; stopping cleanup."
        exit 1
      fi

      aws iam remove-role-from-instance-profile \
        --instance-profile-name "$PROFILE" \
        --role-name "$ROLE"
    fi

    aws iam delete-instance-profile \
      --instance-profile-name "$PROFILE"
    echo "Deleted $PROFILE"
  fi

  EXISTING_ROLE=$(aws iam list-roles \
    --query "Roles[?RoleName=='${ROLE}'].RoleName" --output text)

  if [[ -n "$EXISTING_ROLE" ]]; then
    POLICY_NAME="${app}-s3-policy"
    EXISTING_POLICY=$(aws iam list-role-policies \
      --role-name "$ROLE" \
      --query "PolicyNames[?@=='${POLICY_NAME}']" --output text)

    if [[ -n "$EXISTING_POLICY" ]]; then
      aws iam delete-role-policy \
        --role-name "$ROLE" \
        --policy-name "$POLICY_NAME"
    fi

    aws iam delete-role --role-name "$ROLE"
    echo "Deleted $ROLE"
  fi
done

OWNED_BUCKET=$(aws s3api list-buckets \
  --query "Buckets[?Name=='${BUCKET_NAME}'].Name" --output text)

if [[ -n "$OWNED_BUCKET" ]]; then
  aws s3 rm "s3://$BUCKET_NAME" --recursive --region "$AWS_REGION"

  aws s3api delete-bucket \
    --bucket "$BUCKET_NAME" \
    --expected-bucket-owner "$ACCOUNT_ID" \
    --region "$AWS_REGION"

  echo "Deleted bucket: $BUCKET_NAME"
else
  echo "Assignment bucket is already absent from this account."
fi

EXISTING_SG=$(aws ec2 describe-security-groups \
  --filters \
    "Name=group-id,Values=$APP_SG_ID" \
    "Name=group-name,Values=ITMO-444-544-lab03-app-sg" \
  --query 'SecurityGroups[].GroupId' \
  --output text --region "$AWS_REGION")

if [[ -n "$EXISTING_SG" ]]; then
  aws ec2 delete-security-group \
    --group-id "$EXISTING_SG" \
    --region "$AWS_REGION"
  echo "Deleted security group: $EXISTING_SG"
fi

echo "Assignment 3 cleanup complete."
