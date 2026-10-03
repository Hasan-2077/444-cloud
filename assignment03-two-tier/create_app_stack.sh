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

for tool in aws python3 base64; do
  command -v "$tool" >/dev/null || {
    echo "Missing required tool: $tool"
    exit 1
  }
done

for setting in AWS_REGION AMI_ID INSTANCE_TYPE KEY_NAME SUBNET_ID APP_SG_ID BUCKET_NAME; do
  if [[ -z "${!setting:-}" ]]; then
    echo "Missing setting in .env: $setting"
    exit 1
  fi
done

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

STACK_NAME="itmo-444-544-lab03"
UPLOADER_ROLE="itmo-444-544-uploader-role"
VIEWER_ROLE="itmo-444-544-viewer-role"
UPLOADER_PROFILE="itmo-444-544-uploader-profile"
VIEWER_PROFILE="itmo-444-544-viewer-profile"
UPLOADER_TEMPLATE="itmo-444-544-uploader-lt"
VIEWER_TEMPLATE="itmo-444-544-viewer-lt"

echo "Configuration and local app files checked."

echo "Checking AWS identity..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Preparing S3 bucket..."
OWNED_BUCKET=$(aws s3api list-buckets \
  --query "Buckets[?Name=='${BUCKET_NAME}'].Name" --output text)

if [[ -z "$OWNED_BUCKET" ]]; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" --region "$AWS_REGION"
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
            "Resource": f"arn:aws:s3:::{bucket}/shared.txt"
        }
    ],
    "viewer": [
        {
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{bucket}/shared.txt"
        },
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": f"arn:aws:s3:::{bucket}"
        }
    ]
}

for app, statements in policies.items():
    policy = {"Version": "2012-10-17", "Statement": statements}
    Path(f".generated/{app}-policy.json").write_text(
        json.dumps(policy, indent=2) + "\n"
    )
PY

for app in uploader viewer; do
  ROLE="itmo-444-544-${app}-role"
  PROFILE="itmo-444-544-${app}-profile"

  echo "Preparing $ROLE..."

  EXISTING_ROLE=$(aws iam list-roles \
    --query "Roles[?RoleName=='${ROLE}'].RoleName" --output text)

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
      --instance-profile-name "$PROFILE" >/dev/null
  fi

  aws iam wait instance-profile-exists \
    --instance-profile-name "$PROFILE"

  ATTACHED_ROLE=$(aws iam get-instance-profile \
    --instance-profile-name "$PROFILE" \
    --query 'InstanceProfile.Roles[].RoleName' --output text)

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

if not re.fullmatch(r"[a-z0-9-]+", region):
    raise SystemExit("Invalid AWS_REGION")
if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket):
    raise SystemExit("Invalid BUCKET_NAME")

for app in ("uploader", "viewer"):
    folder = Path(f"lab03/{app}-app")
    app_b64 = base64.b64encode(
        (folder / "app.js").read_bytes()
    ).decode()
    package_b64 = base64.b64encode(
        (folder / "package.json").read_bytes()
    ).decode()

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
Description=Assignment 3 {app} application
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/file-app
Environment=NODE_ENV=production
Environment=AWS_REGION={region}
Environment=BUCKET_NAME={bucket}
Environment=PORT=3000
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

    template = {
        "ImageId": os.environ["AMI_ID"],
        "InstanceType": os.environ["INSTANCE_TYPE"],
        "KeyName": os.environ["KEY_NAME"],
        "IamInstanceProfile": {
            "Name": f"itmo-444-544-{app}-profile"
        },
        "NetworkInterfaces": [{
            "DeviceIndex": 0,
            "AssociatePublicIpAddress": True,
            "DeleteOnTermination": True,
            "SubnetId": os.environ["SUBNET_ID"],
            "Groups": [os.environ["APP_SG_ID"]]
        }],
        "MetadataOptions": {
            "HttpEndpoint": "enabled",
            "HttpTokens": "required"
        },
        "UserData": base64.b64encode(startup.encode()).decode(),
        "TagSpecifications": [{
            "ResourceType": "instance",
            "Tags": [
                {"Key": "Name", "Value": f"lab03-{app}"},
                {"Key": "Project", "Value": "itmo-444-544-lab03"},
                {"Key": "App", "Value": app}
            ]
        }]
    }

    Path(f".generated/{app}-template.json").write_text(
        json.dumps(template, indent=2) + "\n"
    )
    print(f"Generated {app} startup data and template settings.")
PY

for app in uploader viewer; do
  TEMPLATE_NAME="itmo-444-544-${app}-lt"

  TEMPLATE_ID=$(aws ec2 describe-launch-templates \
    --filters "Name=launch-template-name,Values=$TEMPLATE_NAME" \
    --query 'LaunchTemplates[0].LaunchTemplateId' \
    --output text --region "$AWS_REGION")

  if [[ "$TEMPLATE_ID" == "None" || -z "$TEMPLATE_ID" ]]; then
    TEMPLATE_ID=$(aws ec2 create-launch-template \
      --launch-template-name "$TEMPLATE_NAME" \
      --version-description "Initial local app source" \
      --launch-template-data "file://.generated/${app}-template.json" \
      --query 'LaunchTemplate.LaunchTemplateId' \
      --output text --region "$AWS_REGION")
    VERSION=1
  else
    VERSION=$(aws ec2 create-launch-template-version \
      --launch-template-id "$TEMPLATE_ID" \
      --version-description "Updated local app source" \
      --launch-template-data "file://.generated/${app}-template.json" \
      --query 'LaunchTemplateVersion.VersionNumber' \
      --output text --region "$AWS_REGION")
  fi

  aws ec2 modify-launch-template \
    --launch-template-id "$TEMPLATE_ID" \
    --default-version "$VERSION" \
    --region "$AWS_REGION" >/dev/null

  printf '%s\n' "$TEMPLATE_ID" > ".stack-state/${app}-template-id"
  printf '%s\n' "$VERSION" > ".stack-state/${app}-template-version"

  echo "$app launch template: $TEMPLATE_ID, version $VERSION"
done

for app in uploader viewer; do
  TEMPLATE_ID=$(cat ".stack-state/${app}-template-id")
  VERSION=$(cat ".stack-state/${app}-template-version")

  TOKEN_FILE=".stack-state/${app}-${TEMPLATE_ID}-${VERSION}-token"
  if [[ ! -s "$TOKEN_FILE" ]]; then
    python3 -c 'import uuid; print(uuid.uuid4())' > "$TOKEN_FILE"
  fi
  CLIENT_TOKEN=$(cat "$TOKEN_FILE")

  echo "Launching $app using template version $VERSION..."
  INSTANCE_ID=""

  for attempt in {1..12}; do
    if INSTANCE_ID=$(aws ec2 run-instances \
      --launch-template "LaunchTemplateId=$TEMPLATE_ID,Version=$VERSION" \
      --count 1 \
      --client-token "$CLIENT_TOKEN" \
      --query 'Instances[0].InstanceId' \
      --output text --region "$AWS_REGION" \
      2>".generated/${app}-launch-error.txt"); then
      break
    fi

    if grep -qi 'Invalid IAM Instance Profile' \
      ".generated/${app}-launch-error.txt" && (( attempt < 12 )); then
      echo "Waiting for IAM profile propagation: attempt $attempt/12..."
      sleep 10
    else
      cat ".generated/${app}-launch-error.txt" >&2
      exit 1
    fi
  done

  if [[ "$INSTANCE_ID" != i-* ]]; then
    echo "Launch did not return a valid instance ID."
    exit 1
  fi

  printf '%s\n' "$INSTANCE_ID" >> .stack-state/all-instance-ids
  sort -u .stack-state/all-instance-ids \
    -o .stack-state/all-instance-ids
  printf '%s\n' "$INSTANCE_ID" > ".stack-state/${app}-instance-id"

  echo "$app instance: $INSTANCE_ID"
done

UPLOADER_ID=$(cat .stack-state/uploader-instance-id)
VIEWER_ID=$(cat .stack-state/viewer-instance-id)

echo "Waiting for both instances to enter the running state..."
aws ec2 wait instance-running \
  --instance-ids "$UPLOADER_ID" "$VIEWER_ID" \
  --region "$AWS_REGION"

echo "Waiting for EC2 status checks..."
aws ec2 wait instance-status-ok \
  --instance-ids "$UPLOADER_ID" "$VIEWER_ID" \
  --region "$AWS_REGION"

UPLOADER_IP=$(aws ec2 describe-instances \
  --instance-ids "$UPLOADER_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region "$AWS_REGION")

VIEWER_IP=$(aws ec2 describe-instances \
  --instance-ids "$VIEWER_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region "$AWS_REGION")

{
  echo "EC2 deployment complete"
  echo "Bucket: $BUCKET_NAME"
  echo "Uploader instance: $UPLOADER_ID"
  echo "Viewer instance: $VIEWER_ID"
  echo "Uploader URL: http://${UPLOADER_IP}:3000"
  echo "Viewer URL: http://${VIEWER_IP}:3000"
  echo "App installation may take a few more minutes."
} | tee .stack-state/deployment-summary.txt
