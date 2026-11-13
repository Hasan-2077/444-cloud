#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
export AWS_PAGER=""

trap 'echo "Cleanup failed on line $LINENO. Fix the error, then rerun." >&2' ERR

if [[ ! -f .env ]]; then
  echo "Missing .env."
  exit 1
fi

set -a
source .env
if [[ -f stack_outputs.env ]]; then
  source stack_outputs.env
fi
set +a

# Backward compatibility with the previous lab's variable name.
APP_SECURITY_GROUP_ID="${APP_SECURITY_GROUP_ID:-${APP_SG_ID:-}}"

required_settings=(
  AWS_REGION
  BUCKET_NAME
  APP_SECURITY_GROUP_ID
  UPLOADER_ROLE_NAME
  UPLOADER_PROFILE_NAME
  UPLOADER_LT_NAME
  VIEWER_ROLE_NAME
  VIEWER_PROFILE_NAME
  VIEWER_LT_NAME
  UPLOADER_TG_NAME
  VIEWER_TG_NAME
  UPLOADER_ASG_NAME
  VIEWER_ASG_NAME
  ALB_NAME
  ALB_SG_NAME
)

for setting in "${required_settings[@]}"; do
  if [[ -z "${!setting:-}" ]]; then
    echo "Missing setting: $setting"
    exit 1
  fi
done

APP_PORT="${APP_PORT:-3000}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "== Deleting Auto Scaling Groups (this also terminates their instances) =="

for ASG_NAME in "$UPLOADER_ASG_NAME" "$VIEWER_ASG_NAME"; do
  EXISTING_ASG=$(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --region "$AWS_REGION" \
    --query "AutoScalingGroups[0].AutoScalingGroupName" \
    --output text 2>/dev/null || true)

  if [[ -n "$EXISTING_ASG" && "$EXISTING_ASG" != "None" ]]; then
    aws autoscaling delete-auto-scaling-group \
      --auto-scaling-group-name "$ASG_NAME" \
      --force-delete \
      --region "$AWS_REGION"
    echo "Delete requested for $ASG_NAME"
  else
    echo "$ASG_NAME is already absent."
  fi
done

echo "Waiting for Auto Scaling Groups to disappear..."
for ASG_NAME in "$UPLOADER_ASG_NAME" "$VIEWER_ASG_NAME"; do
  deleted=false
  for i in $(seq 1 20); do
    EXISTING_ASG=$(aws autoscaling describe-auto-scaling-groups \
      --auto-scaling-group-names "$ASG_NAME" \
      --region "$AWS_REGION" \
      --query "AutoScalingGroups[0].AutoScalingGroupName" \
      --output text 2>/dev/null || true)

    if [[ -z "$EXISTING_ASG" || "$EXISTING_ASG" == "None" ]]; then
      echo "$ASG_NAME deleted."
      deleted=true
      break
    fi

    echo "Still waiting for $ASG_NAME to delete... ($i/20)"
    sleep 15
  done

  if [[ "$deleted" != true ]]; then
    echo "Timed out waiting for $ASG_NAME to disappear."
    exit 1
  fi
done

echo "== Deleting the Application Load Balancer =="

ALB_ARN="${ALB_ARN:-}"
if [[ -z "$ALB_ARN" ]]; then
  ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names "$ALB_NAME" \
    --region "$AWS_REGION" \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text 2>/dev/null || true)
fi

if [[ -n "$ALB_ARN" && "$ALB_ARN" != "None" ]]; then
  aws elbv2 delete-load-balancer \
    --load-balancer-arn "$ALB_ARN" \
    --region "$AWS_REGION"

  echo "Waiting for load balancer deletion..."
  aws elbv2 wait load-balancers-deleted \
    --load-balancer-arns "$ALB_ARN" \
    --region "$AWS_REGION" 2>/dev/null || true

  echo "Deleted load balancer $ALB_NAME"
else
  echo "Load balancer $ALB_NAME is already absent."
fi

echo "== Deleting target groups =="

for TG_NAME in "$UPLOADER_TG_NAME" "$VIEWER_TG_NAME"; do
  TG_ARN=$(aws elbv2 describe-target-groups \
    --names "$TG_NAME" \
    --region "$AWS_REGION" \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text 2>/dev/null || true)

  if [[ -n "$TG_ARN" && "$TG_ARN" != "None" ]]; then
    # ALB ENIs/listener dependencies can take a few seconds to disappear.
    deleted=false
    for i in $(seq 1 12); do
      if aws elbv2 delete-target-group \
        --target-group-arn "$TG_ARN" \
        --region "$AWS_REGION" >/dev/null 2>&1; then
        echo "Deleted target group $TG_NAME"
        deleted=true
        break
      fi
      echo "Waiting to delete target group $TG_NAME... ($i/12)"
      sleep 10
    done

    if [[ "$deleted" != true ]]; then
      echo "Could not delete target group $TG_NAME."
      exit 1
    fi
  else
    echo "Target group $TG_NAME is already absent."
  fi
done

echo "== Restoring the app security group to its previous-lab state =="

ALB_SECURITY_GROUP_ID="${ALB_SECURITY_GROUP_ID:-}"
if [[ -z "$ALB_SECURITY_GROUP_ID" ]]; then
  VPC_ID="${VPC_ID:-$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --query "Vpcs[0].VpcId" \
    --output text \
    --region "$AWS_REGION")}"

  ALB_SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$ALB_SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || true)
fi

if [[ -n "$ALB_SECURITY_GROUP_ID" && "$ALB_SECURITY_GROUP_ID" != "None" ]]; then
  aws ec2 revoke-security-group-ingress \
    --group-id "$APP_SECURITY_GROUP_ID" \
    --protocol tcp \
    --port "$APP_PORT" \
    --source-group "$ALB_SECURITY_GROUP_ID" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
fi

aws ec2 authorize-security-group-ingress \
  --group-id "$APP_SECURITY_GROUP_ID" \
  --protocol tcp \
  --port "$APP_PORT" \
  --cidr 0.0.0.0/0 \
  --region "$AWS_REGION" >/dev/null 2>&1 || true

echo "== Deleting the ALB security group =="

if [[ -n "$ALB_SECURITY_GROUP_ID" && "$ALB_SECURITY_GROUP_ID" != "None" ]]; then
  deleted=false
  for i in $(seq 1 12); do
    if aws ec2 delete-security-group \
      --group-id "$ALB_SECURITY_GROUP_ID" \
      --region "$AWS_REGION" >/dev/null 2>&1; then
      echo "Deleted ALB security group: $ALB_SECURITY_GROUP_ID"
      deleted=true
      break
    fi
    echo "Waiting to delete ALB security group... ($i/12)"
    sleep 10
  done

  if [[ "$deleted" != true ]]; then
    echo "Could not delete ALB security group yet. Re-run this script after a minute."
    exit 1
  fi
else
  echo "ALB security group is already absent."
fi

echo "== Deleting launch templates =="

for TEMPLATE_NAME in "$UPLOADER_LT_NAME" "$VIEWER_LT_NAME"; do
  TEMPLATE_ID=$(aws ec2 describe-launch-templates \
    --filters "Name=launch-template-name,Values=$TEMPLATE_NAME" \
    --query "LaunchTemplates[0].LaunchTemplateId" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || true)

  if [[ -n "$TEMPLATE_ID" && "$TEMPLATE_ID" != "None" ]]; then
    aws ec2 delete-launch-template \
      --launch-template-id "$TEMPLATE_ID" \
      --region "$AWS_REGION" >/dev/null
    echo "Deleted $TEMPLATE_NAME"
  else
    echo "$TEMPLATE_NAME is already absent."
  fi
done

echo "== Removing IAM instance profiles and roles =="

for app in uploader viewer; do
  if [[ "$app" == "uploader" ]]; then
    ROLE="$UPLOADER_ROLE_NAME"
    PROFILE="$UPLOADER_PROFILE_NAME"
  else
    ROLE="$VIEWER_ROLE_NAME"
    PROFILE="$VIEWER_PROFILE_NAME"
  fi

  EXISTING_PROFILE=$(aws iam list-instance-profiles \
    --query "InstanceProfiles[?InstanceProfileName=='${PROFILE}'].InstanceProfileName" \
    --output text)

  if [[ -n "$EXISTING_PROFILE" ]]; then
    ATTACHED_ROLE=$(aws iam get-instance-profile \
      --instance-profile-name "$PROFILE" \
      --query 'InstanceProfile.Roles[].RoleName' \
      --output text)

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
  else
    echo "$PROFILE is already absent."
  fi

  EXISTING_ROLE=$(aws iam list-roles \
    --query "Roles[?RoleName=='${ROLE}'].RoleName" \
    --output text)

  if [[ -n "$EXISTING_ROLE" ]]; then
    POLICY_NAME="${app}-s3-policy"
    EXISTING_POLICY=$(aws iam list-role-policies \
      --role-name "$ROLE" \
      --query "PolicyNames[?@=='${POLICY_NAME}']" \
      --output text)

    if [[ -n "$EXISTING_POLICY" ]]; then
      aws iam delete-role-policy \
        --role-name "$ROLE" \
        --policy-name "$POLICY_NAME"
    fi

    aws iam delete-role \
      --role-name "$ROLE"
    echo "Deleted $ROLE"
  else
    echo "$ROLE is already absent."
  fi
done

echo "== Emptying and deleting S3 bucket =="

OWNED_BUCKET=$(aws s3api list-buckets \
  --query "Buckets[?Name=='${BUCKET_NAME}'].Name" \
  --output text)

if [[ -n "$OWNED_BUCKET" ]]; then
  aws s3 rm "s3://$BUCKET_NAME" \
    --recursive \
    --region "$AWS_REGION" >/dev/null 2>&1 || true

  aws s3api delete-bucket \
    --bucket "$BUCKET_NAME" \
    --expected-bucket-owner "$ACCOUNT_ID" \
    --region "$AWS_REGION"

  echo "Deleted bucket: $BUCKET_NAME"
else
  echo "Assignment bucket is already absent from this account."
fi

echo "== Deleting the app security group =="

EXISTING_APP_SG=$(aws ec2 describe-security-groups \
  --group-ids "$APP_SECURITY_GROUP_ID" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || true)

if [[ -n "$EXISTING_APP_SG" && "$EXISTING_APP_SG" != "None" ]]; then
  deleted=false
  for i in $(seq 1 12); do
    if aws ec2 delete-security-group \
      --group-id "$APP_SECURITY_GROUP_ID" \
      --region "$AWS_REGION" >/dev/null 2>&1; then
      echo "Deleted app security group: $APP_SECURITY_GROUP_ID"
      deleted=true
      break
    fi
    echo "Waiting to delete app security group... ($i/12)"
    sleep 10
  done

  if [[ "$deleted" != true ]]; then
    echo "Could not delete app security group yet. Re-run this script after a minute."
    exit 1
  fi
else
  echo "App security group is already absent."
fi

rm -f stack_outputs.env
rm -rf .generated .stack-state
rm -f uploader-lt-data.json viewer-lt-data.json
rm -f user-data-uploader.sh user-data-viewer.sh
rm -f uploader-policy.json viewer-policy.json trust-policy.json

echo "Assignment 4 cleanup complete."
