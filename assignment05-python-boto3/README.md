Assignment 5 - AWS CLI to Python
Overview
For this assignment, I converted the previous Multi-AZ AWS lab from Bash and AWS CLI into Python using boto3 and pytest.

The architecture stayed mostly the same. It still uses an uploader and viewer application, an S3 bucket for shared.txt, separate IAM roles, EC2 launch templates, an Application Load Balancer, two target groups, and Auto Scaling Groups across two Availability Zones.

The main change was moving the AWS management logic into Python modules so the code would be easier to organize, test, reuse, and troubleshoot.
Main Files
The main Python code is stored inside the stack folder.

config.py reads the values from the .env file.

clients.py creates the boto3 clients used for AWS services.

policies.py contains the IAM policies.

storage.py handles the S3 bucket, IAM roles, and instance profiles.

compute.py handles EC2 user data and launch templates.

network.py handles the VPC, subnets, and security groups.

balancer.py handles the Application Load Balancer, listeners, and target groups.

scaling.py handles the Auto Scaling Groups.

runner.py connects all the create and delete steps together.

The main commands for the assignment are python create_stack.py and python delete_stack.py.
Security
The uploader and viewer use separate IAM roles with different permissions.

The uploader is only allowed to use s3:PutObject on shared.txt.

The viewer can use s3:GetObject on shared.txt and s3:ListBucket.

The S3 bucket blocks public access.

Port 3000 on the application security group is also restricted so that only the Application Load Balancer can reach the applications.
Unit Testing
I used pytest and moto to test the Python code without creating real AWS resources.

Running pytest produced 19 passed tests.

The unit tests checked configuration, IAM policies, user-data generation, launch templates, networking, Auto Scaling Groups, resource creation, and cleanup.
Break-It Test
To prove that the tests were actually checking the security configuration, I temporarily changed the uploader permission from s3:PutObject to s3:*.

The policy test failed as expected because the uploader had more permissions than it should.

After the test, I changed the permission back to s3:PutObject.
Integration Testing
After deploying the real AWS stack, I ran pytest -m integration -v.

All 14 integration tests passed.

These tests checked the real S3 configuration, IAM permissions, Application Load Balancer, target groups, Auto Scaling Groups, Multi-AZ setup, security groups, uploader and viewer web pages, file uploads, and file validation.
Chaos Testing
I ran pytest -m chaos -s to test recovery.

The normal recovery SLO was 180 seconds.

The uploader recovered in about 91.57 seconds.

The viewer recovered in about 78.41 seconds.

Both passed the 180-second SLO.

I then temporarily changed the recovery SLO to 60 seconds.

The uploader recovered in about 86.85 seconds.

The viewer recovered in about 84.58 seconds.

Both failed because their recovery times were greater than the 60-second SLO.

After the test, I changed RECOVERY_SLO_SECONDS back to 180.
Cleanup
I removed the AWS resources using python delete_stack.py.

The cleanup removed the Auto Scaling Groups, EC2 instances controlled by the ASGs, Application Load Balancer, target groups, security groups, launch templates, IAM roles, instance profiles, and S3 bucket.

I ran the delete command again to confirm that the cleanup process was safe to repeat.

Final AWS checks showed that the lab ALB, Auto Scaling Groups, and IAM roles were removed.
What Moto Proved
Moto allowed me to test the boto3 code without creating real AWS resources.

It showed that the Python code was making the expected AWS API calls and creating resources with the correct configuration.

Moto could not prove that real EC2 instances would boot correctly, that the applications would start correctly, or that the websites would actually work.

That is why the real integration tests and chaos tests were also necessary.
Bash vs Python Error Handling
In Bash, errors could easily be hidden with commands such as 2>/dev/null || true.

In Python, I used targeted error handling such as ignore_errors("EntityAlreadyExists").

This is safer because it only ignores the specific error that is expected instead of hiding every possible error.
Reflection
The Bash version was shorter in some areas, especially error handling.

The Python version required more code, but it was easier to organize and test.

Separating the project into different Python modules also made it easier to understand which parts handled storage, compute, networking, load balancing, and scaling.
Evidence
The evidence folder contains screenshots showing the main assignment checkpoints.

The screenshots include the project setup, installed Python packages, Python test structure, 19 passing unit tests, the break-it test failure, successful Python stack creation, 14 passing integration tests, successful chaos testing, the failed 60-second SLO test, and successful repeated cleanup.
