#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
export AWS_PAGER=""

trap 'echo "ERROR on line $LINENO. Check the output above before retrying." >&2' ERR

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example and fill in your settings."
  exit 1
fi

set -a
source .env
set +a

# Backward compatibility with the previous lab's variable name.
APP_SECURITY_GROUP_ID="${APP_SECURITY_GROUP_ID:-${APP_SG_ID:-}}"
export APP_SECURITY_GROUP_ID

for tool in aws python3 base64; do
  command -v "$tool" >/dev/null || {
    echo "Missing required tool: $tool"
    exit 1
  }
done

required_settings=(
  AWS_REGION
  AMI_ID
  INSTANCE_TYPE
  KEY_NAME
  BUCKET_NAME
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
  UPLOADER_LISTENER_PORT
  VIEWER_LISTENER_PORT
  AZ_A
  AZ_B
  RECOVERY_SLO_SECONDS
)

for setting in "${required_settings[@]}"; do
  if [[ -z "${!setting:-}" ]]; then
    echo "Missing setting in .env: $setting"
    exit 1
  fi
done

APP_PORT="${APP_PORT:-3000}"
export APP_PORT

for app in uploader viewer; do
  for file in app.js package.json; do
    if [[ ! -s "lab03/${app}-app/$file" ]]; then
      echo "Missing or empty file: lab03/${app}-app/$file"
      exit 1
    fi
  done
  python3 -m json.tool "lab03/${app}-app/package.json" >/dev/null
done

mkdir -p .generated .stack-state
chmod 700 .generated .stack-state

echo "Configuration and local app files checked."

echo "Checking AWS identity..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS account: $ACCOUNT_ID"

echo "Looking up the default VPC and subnets in both Availability Zones..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region "$AWS_REGION")

if [[ -z "$VPC_ID" || "$VPC_ID" == "None" ]]; then
  echo "No default VPC found in $AWS_REGION."
  exit 1
fi

SUBNET_A=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=$AZ_A" \
  --query "Subnets[0].SubnetId" \
  --output text \
  --region "$AWS_REGION")

SUBNET_B=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=$AZ_B" \
  --query "Subnets[0].SubnetId" \
  --output text \
  --region "$AWS_REGION")

if [[ -z "$SUBNET_A" || "$SUBNET_A" == "None" || -z "$SUBNET_B" || "$SUBNET_B" == "None" ]]; then
  echo "Could not find valid subnets in $AZ_A and $AZ_B."
  exit 1
fi

echo "$AZ_A subnet: $SUBNET_A"
echo "$AZ_B subnet: $SUBNET_B"

echo "Preparing the application security group..."
APP_SG_EXISTS=""
if [[ -n "$APP_SECURITY_GROUP_ID" ]]; then
  APP_SG_EXISTS=$(aws ec2 describe-security-groups \
    --group-ids "$APP_SECURITY_GROUP_ID" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || true)
fi

if [[ -z "$APP_SG_EXISTS" || "$APP_SG_EXISTS" == "None" ]]; then
  APP_SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=itmo-444-544-app-sg" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || true)

  if [[ -z "$APP_SECURITY_GROUP_ID" || "$APP_SECURITY_GROUP_ID" == "None" ]]; then
    APP_SECURITY_GROUP_ID=$(aws ec2 create-security-group \
      --group-name "itmo-444-544-app-sg" \
      --description "Assignment 4 application instances" \
      --vpc-id "$VPC_ID" \
      --query "GroupId" \
      --output text \
      --region "$AWS_REGION")
  fi
fi

export APP_SECURITY_GROUP_ID
echo "Application security group: $APP_SECURITY_GROUP_ID"

# Preserve SSH access from the previous lab if ALLOWED_CIDR is configured.
if [[ -n "${ALLOWED_CIDR:-}" ]]; then
  aws ec2 authorize-security-group-ingress \
    --group-id "$APP_SECURITY_GROUP_ID" \
    --protocol tcp \
    --port 22 \
    --cidr "$ALLOWED_CIDR" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
fi

echo "Preparing S3 bucket..."
OWNED_BUCKET=$(aws s3api list-buckets \
  --query "Buckets[?Name=='${BUCKET_NAME}'].Name" \
  --output text)

if [[ -z "$OWNED_BUCKET" ]]; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" \
      --region "$AWS_REGION"
  fi
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --expected-bucket-owner "$ACCOUNT_ID" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' \
  --region "$AWS_REGION"

cat > .generated/trust-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
JSON

python3 <<'PY'
import json
import os
from pathlib import Path

bucket = os.environ["BUCKET_NAME"]

policies = {
    "uploader": [
        {
            "Effect": "Allow",
            "Action": "s3:PutObject",
            "Resource": f"arn:aws:s3:::{bucket}/shared.txt",
        }
    ],
    "viewer": [
        {
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{bucket}/shared.txt",
        },
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": f"arn:aws:s3:::{bucket}",
        },
    ],
}

for app, statements in policies.items():
    policy = {"Version": "2012-10-17", "Statement": statements}
    Path(f".generated/{app}-policy.json").write_text(
        json.dumps(policy, indent=2) + "\n"
    )
PY

for app in uploader viewer; do
  if [[ "$app" == "uploader" ]]; then
    ROLE="$UPLOADER_ROLE_NAME"
    PROFILE="$UPLOADER_PROFILE_NAME"
  else
    ROLE="$VIEWER_ROLE_NAME"
    PROFILE="$VIEWER_PROFILE_NAME"
  fi

  echo "Preparing $ROLE..."

  EXISTING_ROLE=$(aws iam list-roles \
    --query "Roles[?RoleName=='${ROLE}'].RoleName" \
    --output text)

  if [[ -z "$EXISTING_ROLE" ]]; then
    aws iam create-role \
      --role-name "$ROLE" \
      --assume-role-policy-document file://.generated/trust-policy.json \
      >/dev/null
  fi

  aws iam wait role-exists --role-name "$ROLE"

  aws iam put-role-policy \
    --role-name "$ROLE" \
    --policy-name "${app}-s3-policy" \
    --policy-document "file://.generated/${app}-policy.json"

  EXISTING_PROFILE=$(aws iam list-instance-profiles \
    --query "InstanceProfiles[?InstanceProfileName=='${PROFILE}'].InstanceProfileName" \
    --output text)

  if [[ -z "$EXISTING_PROFILE" ]]; then
    aws iam create-instance-profile \
      --instance-profile-name "$PROFILE" \
      >/dev/null
  fi

  aws iam wait instance-profile-exists \
    --instance-profile-name "$PROFILE"

  ATTACHED_ROLE=$(aws iam get-instance-profile \
    --instance-profile-name "$PROFILE" \
    --query 'InstanceProfile.Roles[].RoleName' \
    --output text)

  if [[ -z "$ATTACHED_ROLE" ]]; then
    aws iam add-role-to-instance-profile \
      --instance-profile-name "$PROFILE" \
      --role-name "$ROLE"
  elif [[ "$ATTACHED_ROLE" != "$ROLE" ]]; then
    echo "Unexpected role in $PROFILE: $ATTACHED_ROLE"
    exit 1
  fi
done

echo "S3 bucket and both IAM instance profiles are ready."

echo "Generating startup scripts and launch-template settings..."

python3 <<'PY'
import base64
import json
import os
import re
import subprocess
from pathlib import Path

region = os.environ["AWS_REGION"]
bucket = os.environ["BUCKET_NAME"]
app_sg = os.environ["APP_SECURITY_GROUP_ID"]
app_port = os.environ.get("APP_PORT", "3000")

if not re.fullmatch(r"[a-z0-9-]+", region):
    raise SystemExit("Invalid AWS_REGION")
if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket):
    raise SystemExit("Invalid BUCKET_NAME")

for app in ("uploader", "viewer"):
    folder = Path(f"lab03/{app}-app")
    app_b64 = base64.b64encode((folder / "app.js").read_bytes()).decode()
    package_b64 = base64.b64encode((folder / "package.json").read_bytes()).decode()

    startup = f"""#!/bin/bash
set -euxo pipefail

dnf install -y nodejs22 nodejs22-npm
id appuser >/dev/null 2>&1 || useradd --system --create-home appuser
mkdir -p /opt/file-app

printf '%s' '{app_b64}' | base64 --decode > /opt/file-app/app.js
printf '%s' '{package_b64}' | base64 --decode > /opt/file-app/package.json

cd /opt/file-app
/usr/bin/node-22 --check app.js
/usr/bin/npm-22 install --omit=dev
chown -R appuser:appuser /opt/file-app

cat > /etc/systemd/system/file-app.service <<'SERVICE'
[Unit]
Description=Assignment 4 {app} application
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/file-app
Environment=NODE_ENV=production
Environment=AWS_REGION={region}
Environment=BUCKET_NAME={bucket}
Environment=PORT={app_port}
ExecStart=/usr/bin/node-22 /opt/file-app/app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now file-app.service
"""

    if len(startup.encode()) > 16384:
        raise SystemExit(f"{app}: startup data exceeds 16 KiB")

    startup_path = Path(f".generated/{app}-user-data.sh")
    startup_path.write_text(startup)
    subprocess.run(["bash", "-n", str(startup_path)], check=True)

    profile_name = (
        os.environ["UPLOADER_PROFILE_NAME"]
        if app == "uploader"
        else os.environ["VIEWER_PROFILE_NAME"]
    )

    # IMPORTANT for the Multi-AZ lab:
    # Do not pin a subnet inside the Launch Template. The ASG chooses between
    # SUBNET_A and SUBNET_B through its VPC zone identifier.
    template = {
        "ImageId": os.environ["AMI_ID"],
        "InstanceType": os.environ["INSTANCE_TYPE"],
        "KeyName": os.environ["KEY_NAME"],
        "IamInstanceProfile": {"Name": profile_name},
        "SecurityGroupIds": [app_sg],
        "MetadataOptions": {
            "HttpEndpoint": "enabled",
            "HttpTokens": "required",
        },
        "UserData": base64.b64encode(startup.encode()).decode(),
        "TagSpecifications": [
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": f"{app}-app"},
                    {"Key": "Project", "Value": "itmo-444-544-assignment04"},
                    {"Key": "App", "Value": app},
                ],
            }
        ],
    }

    Path(f".generated/{app}-template.json").write_text(
        json.dumps(template, indent=2) + "\n"
    )
    print(f"Generated {app} startup data and template settings.")
PY

for app in uploader viewer; do
  if [[ "$app" == "uploader" ]]; then
    TEMPLATE_NAME="$UPLOADER_LT_NAME"
  else
    TEMPLATE_NAME="$VIEWER_LT_NAME"
  fi

  TEMPLATE_ID=$(aws ec2 describe-launch-templates \
    --filters "Name=launch-template-name,Values=$TEMPLATE_NAME" \
    --query 'LaunchTemplates[0].LaunchTemplateId' \
    --output text \
    --region "$AWS_REGION")

  if [[ "$TEMPLATE_ID" == "None" || -z "$TEMPLATE_ID" ]]; then
    TEMPLATE_ID=$(aws ec2 create-launch-template \
      --launch-template-name "$TEMPLATE_NAME" \
      --version-description "Initial Assignment 4 local app source" \
      --launch-template-data "file://.generated/${app}-template.json" \
      --query 'LaunchTemplate.LaunchTemplateId' \
      --output text \
      --region "$AWS_REGION")
    VERSION=1
  else
    VERSION=$(aws ec2 create-launch-template-version \
      --launch-template-id "$TEMPLATE_ID" \
      --version-description "Updated Assignment 4 local app source" \
      --launch-template-data "file://.generated/${app}-template.json" \
      --query 'LaunchTemplateVersion.VersionNumber' \
      --output text \
      --region "$AWS_REGION")
  fi

  aws ec2 modify-launch-template \
    --launch-template-id "$TEMPLATE_ID" \
    --default-version "$VERSION" \
    --region "$AWS_REGION" \
    >/dev/null

  printf '%s\n' "$TEMPLATE_ID" > ".stack-state/${app}-template-id"
  printf '%s\n' "$VERSION" > ".stack-state/${app}-template-version"

  echo "$app launch template: $TEMPLATE_ID, version $VERSION"
done

echo "Preparing the ALB security group..."
ALB_SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$ALB_SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || true)

if [[ -z "$ALB_SECURITY_GROUP_ID" || "$ALB_SECURITY_GROUP_ID" == "None" ]]; then
  ALB_SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name "$ALB_SG_NAME" \
    --description "Allow inbound to Assignment 4 ALB listener ports" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text \
    --region "$AWS_REGION")
fi

aws ec2 authorize-security-group-ingress \
  --group-id "$ALB_SECURITY_GROUP_ID" \
  --protocol tcp \
  --port "$UPLOADER_LISTENER_PORT" \
  --cidr 0.0.0.0/0 \
  --region "$AWS_REGION" >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "$ALB_SECURITY_GROUP_ID" \
  --protocol tcp \
  --port "$VIEWER_LISTENER_PORT" \
  --cidr 0.0.0.0/0 \
  --region "$AWS_REGION" >/dev/null 2>&1 || true

echo "ALB security group: $ALB_SECURITY_GROUP_ID"

echo "Tightening the app security group so port $APP_PORT only accepts traffic from the ALB..."
aws ec2 revoke-security-group-ingress \
  --group-id "$APP_SECURITY_GROUP_ID" \
  --protocol tcp \
  --port "$APP_PORT" \
  --cidr 0.0.0.0/0 \
  --region "$AWS_REGION" >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "$APP_SECURITY_GROUP_ID" \
  --protocol tcp \
  --port "$APP_PORT" \
  --source-group "$ALB_SECURITY_GROUP_ID" \
  --region "$AWS_REGION" >/dev/null 2>&1 || true

echo "Preparing target groups..."

UPLOADER_TG_ARN=$(aws elbv2 describe-target-groups \
  --names "$UPLOADER_TG_NAME" \
  --region "$AWS_REGION" \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text 2>/dev/null || true)

if [[ -z "$UPLOADER_TG_ARN" || "$UPLOADER_TG_ARN" == "None" ]]; then
  UPLOADER_TG_ARN=$(aws elbv2 create-target-group \
    --name "$UPLOADER_TG_NAME" \
    --protocol HTTP \
    --port "$APP_PORT" \
    --vpc-id "$VPC_ID" \
    --target-type instance \
    --health-check-protocol HTTP \
    --health-check-path / \
    --health-check-interval-seconds 10 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --region "$AWS_REGION" \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)
else
  aws elbv2 modify-target-group \
    --target-group-arn "$UPLOADER_TG_ARN" \
    --health-check-protocol HTTP \
    --health-check-path / \
    --health-check-interval-seconds 10 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --region "$AWS_REGION" >/dev/null
fi

VIEWER_TG_ARN=$(aws elbv2 describe-target-groups \
  --names "$VIEWER_TG_NAME" \
  --region "$AWS_REGION" \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text 2>/dev/null || true)

if [[ -z "$VIEWER_TG_ARN" || "$VIEWER_TG_ARN" == "None" ]]; then
  VIEWER_TG_ARN=$(aws elbv2 create-target-group \
    --name "$VIEWER_TG_NAME" \
    --protocol HTTP \
    --port "$APP_PORT" \
    --vpc-id "$VPC_ID" \
    --target-type instance \
    --health-check-protocol HTTP \
    --health-check-path / \
    --health-check-interval-seconds 10 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --region "$AWS_REGION" \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)
else
  aws elbv2 modify-target-group \
    --target-group-arn "$VIEWER_TG_ARN" \
    --health-check-protocol HTTP \
    --health-check-path / \
    --health-check-interval-seconds 10 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --region "$AWS_REGION" >/dev/null
fi

echo "Uploader target group: $UPLOADER_TG_ARN"
echo "Viewer target group:   $VIEWER_TG_ARN"

echo "Preparing the Application Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --region "$AWS_REGION" \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text 2>/dev/null || true)

if [[ -z "$ALB_ARN" || "$ALB_ARN" == "None" ]]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets "$SUBNET_A" "$SUBNET_B" \
    --security-groups "$ALB_SECURITY_GROUP_ID" \
    --scheme internet-facing \
    --type application \
    --region "$AWS_REGION" \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text)

  echo "Waiting for the ALB to become active..."
  aws elbv2 wait load-balancer-available \
    --load-balancer-arns "$ALB_ARN" \
    --region "$AWS_REGION"
else
  echo "Load balancer $ALB_NAME already exists."
fi

ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --query "LoadBalancers[0].DNSName" \
  --output text \
  --region "$AWS_REGION")

echo "Preparing ALB listeners..."
EXISTING_PORTS=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$ALB_ARN" \
  --region "$AWS_REGION" \
  --query "Listeners[].Port" \
  --output text 2>/dev/null || true)

if echo "$EXISTING_PORTS" | tr '\t' '\n' | grep -qx "$UPLOADER_LISTENER_PORT"; then
  echo "Listener on port $UPLOADER_LISTENER_PORT already exists."
else
  aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port "$UPLOADER_LISTENER_PORT" \
    --default-actions "Type=forward,TargetGroupArn=$UPLOADER_TG_ARN" \
    --region "$AWS_REGION" \
    >/dev/null
fi

if echo "$EXISTING_PORTS" | tr '\t' '\n' | grep -qx "$VIEWER_LISTENER_PORT"; then
  echo "Listener on port $VIEWER_LISTENER_PORT already exists."
else
  aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port "$VIEWER_LISTENER_PORT" \
    --default-actions "Type=forward,TargetGroupArn=$VIEWER_TG_ARN" \
    --region "$AWS_REGION" \
    >/dev/null
fi

echo "Preparing Auto Scaling Groups..."

UPLOADER_ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$UPLOADER_ASG_NAME" \
  --region "$AWS_REGION" \
  --query "AutoScalingGroups[0].AutoScalingGroupName" \
  --output text 2>/dev/null || true)

if [[ -z "$UPLOADER_ASG_EXISTS" || "$UPLOADER_ASG_EXISTS" == "None" ]]; then
  aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name "$UPLOADER_ASG_NAME" \
    --launch-template "LaunchTemplateName=$UPLOADER_LT_NAME,Version=\$Latest" \
    --min-size 1 \
    --max-size 1 \
    --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_A,$SUBNET_B" \
    --target-group-arns "$UPLOADER_TG_ARN" \
    --health-check-type ELB \
    --health-check-grace-period 120 \
    --tags "ResourceId=$UPLOADER_ASG_NAME,ResourceType=auto-scaling-group,Key=Name,Value=uploader-app,PropagateAtLaunch=true" \
    --region "$AWS_REGION"
else
  aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$UPLOADER_ASG_NAME" \
    --launch-template "LaunchTemplateName=$UPLOADER_LT_NAME,Version=\$Latest" \
    --min-size 1 \
    --max-size 1 \
    --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_A,$SUBNET_B" \
    --health-check-type ELB \
    --health-check-grace-period 120 \
    --region "$AWS_REGION"

  aws autoscaling attach-load-balancer-target-groups \
    --auto-scaling-group-name "$UPLOADER_ASG_NAME" \
    --target-group-arns "$UPLOADER_TG_ARN" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
fi

VIEWER_ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$VIEWER_ASG_NAME" \
  --region "$AWS_REGION" \
  --query "AutoScalingGroups[0].AutoScalingGroupName" \
  --output text 2>/dev/null || true)

if [[ -z "$VIEWER_ASG_EXISTS" || "$VIEWER_ASG_EXISTS" == "None" ]]; then
  aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name "$VIEWER_ASG_NAME" \
    --launch-template "LaunchTemplateName=$VIEWER_LT_NAME,Version=\$Latest" \
    --min-size 1 \
    --max-size 1 \
    --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_A,$SUBNET_B" \
    --target-group-arns "$VIEWER_TG_ARN" \
    --health-check-type ELB \
    --health-check-grace-period 120 \
    --tags "ResourceId=$VIEWER_ASG_NAME,ResourceType=auto-scaling-group,Key=Name,Value=viewer-app,PropagateAtLaunch=true" \
    --region "$AWS_REGION"
else
  aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$VIEWER_ASG_NAME" \
    --launch-template "LaunchTemplateName=$VIEWER_LT_NAME,Version=\$Latest" \
    --min-size 1 \
    --max-size 1 \
    --desired-capacity 1 \
    --vpc-zone-identifier "$SUBNET_A,$SUBNET_B" \
    --health-check-type ELB \
    --health-check-grace-period 120 \
    --region "$AWS_REGION"

  aws autoscaling attach-load-balancer-target-groups \
    --auto-scaling-group-name "$VIEWER_ASG_NAME" \
    --target-group-arns "$VIEWER_TG_ARN" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
fi

cat > stack_outputs.env <<EOF
VPC_ID=$VPC_ID
SUBNET_A=$SUBNET_A
SUBNET_B=$SUBNET_B
APP_SECURITY_GROUP_ID=$APP_SECURITY_GROUP_ID
ALB_SECURITY_GROUP_ID=$ALB_SECURITY_GROUP_ID
ALB_ARN=$ALB_ARN
ALB_DNS_NAME=$ALB_DNS_NAME
UPLOADER_TG_ARN=$UPLOADER_TG_ARN
VIEWER_TG_ARN=$VIEWER_TG_ARN
EOF

chmod 600 stack_outputs.env

{
  echo "Assignment 4 Multi-AZ deployment complete"
  echo "VPC: $VPC_ID"
  echo "Subnets: $SUBNET_A ($AZ_A), $SUBNET_B ($AZ_B)"
  echo "Application security group: $APP_SECURITY_GROUP_ID"
  echo "ALB security group: $ALB_SECURITY_GROUP_ID"
  echo "ALB DNS name: $ALB_DNS_NAME"
  echo "Uploader: http://${ALB_DNS_NAME}:${UPLOADER_LISTENER_PORT}/"
  echo "Viewer:   http://${ALB_DNS_NAME}:${VIEWER_LISTENER_PORT}/"
  echo "Give the target groups 1-2 minutes to report healthy."
  echo "Uploader health check:"
  echo "  aws elbv2 describe-target-health --target-group-arn $UPLOADER_TG_ARN --region $AWS_REGION"
  echo "Viewer health check:"
  echo "  aws elbv2 describe-target-health --target-group-arn $VIEWER_TG_ARN --region $AWS_REGION"
} | tee .stack-state/deployment-summary.txt
