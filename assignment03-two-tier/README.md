# Assignment 3: Two-Tier File Upload and Display

Student: Mahmudul Hasan
AWS region: us-east-2

## Overview
Two separate EC2 instances run Node.js applications on port 3000.
The uploader stores an accepted text file in a private S3 bucket as
shared.txt. The viewer retrieves and displays that object's current
contents. A new valid upload replaces the previous file.

## Files
- lab03/uploader-app/: uploader source and package.json
- lab03/viewer-app/: viewer source and package.json
- create_app_stack.sh: provisioning and deployment
- delete_app_stack.sh: resource cleanup
- .env.example: configuration template
- evidence/: IAM policy exports and screenshots

## Validation
The uploader requires a .txt extension and text/plain MIME type.
The maximum size is 1,048,576 bytes (1 MiB). Unsupported types and
oversized files are rejected without replacing the existing object.
The viewer retrieves the object on each request and escapes text
before displaying it in HTML.

## IAM and Security
The applications use separate IAM roles and instance profiles.
The uploader has s3:PutObject permission only on shared.txt.
The viewer has s3:GetObject permission only on shared.txt and
s3:ListBucket permission on the bucket.

Both roles trust the EC2 service. The AWS SDK obtains temporary
credentials through the instance profiles. No static AWS access
keys are embedded in the applications.

S3 public access is blocked. The security group restricts inbound
TCP ports 22 and 3000 to the client's public IPv4 address (/32).

Policy exports:
- evidence/uploader-role-policy.json
- evidence/viewer-role-policy.json

## Setup
Prerequisites: Bash, AWS CLI, Python 3, and base64.
Configure AWS CLI credentials with the necessary provisioning permissions.

Copy .env.example to .env and configure AWS_REGION, AMI_ID,
INSTANCE_TYPE, KEY_NAME, SUBNET_ID, APP_SG_ID, BUCKET_NAME,
and ALLOWED_CIDR.

Use a compatible Amazon Linux 2023 AMI, an existing EC2 key pair,
and a public subnet with internet access.

Before running deployment, create ITMO-444-544-lab03-app-sg in
the subnet's VPC. Allow inbound TCP ports 22 and 3000 from your
public IPv4 address (/32), and allow outbound internet access.
Set APP_SG_ID to this security group's ID.

The script expects the security group to exist. Changing
ALLOWED_CIDR in .env does not automatically change security-group
rules. Update the rules when your public IP changes.

Choose a globally unique bucket name. Do not commit .env,
private keys, AWS credentials, or GitHub tokens.

## Deployment
From the assignment directory, run:
    chmod +x create_app_stack.sh delete_app_stack.sh
    ./create_app_stack.sh

The script configures the bucket, roles, profiles, and launch
templates, then launches one instance for each application.
It prints the instance IDs and application URLs.

User data installs Node.js and dependencies, writes the embedded
application source, and enables a systemd service. Applications
run under a dedicated non-root user.

Application files are embedded in user data using base64, so no
private repository clone or code-fetch credentials are required.
Base64 is encoding, not encryption.

Application installation can continue after EC2 status checks pass.
Allow additional startup time before opening the application URLs.

## Application Update
The uploader heading was changed to "Uploader - Version 2".
Running the deployment script again created new launch-template
versions and new instances with the updated application source.

Template version 1 was created before a launch-command correction.
Version 2 was used for the initial successful deployment.
Version 3 contained the application update.

Each deployment run creates additional instances and new template
versions. It does not automatically terminate older instances.

## Testing
The lab checks covered:
- Successful upload of a valid text file
- Viewer display of the uploaded text
- Rejection of an oversized file
- Rejection of an unsupported file type
- Replacement of shared.txt with a second valid upload
- Viewer display of the replacement text
- Creation of new launch-template versions
- Successful cleanup and repeat cleanup

Screenshots provide evidence of application behavior, deployment,
launch-template versions, and cleanup.

## Cleanup
Run:
    ./delete_app_stack.sh

Cleanup terminates instances with the assignment project tag and
deletes the launch templates, instance profiles, inline policies,
roles, bucket contents, bucket, and assignment security group.

Cleanup completed successfully. A second run also completed
without errors, reporting no remaining assignment instances
and an already-absent bucket.

Local source and evidence files are retained.

Before deploying again after cleanup, recreate the security group
and update APP_SG_ID in .env.
