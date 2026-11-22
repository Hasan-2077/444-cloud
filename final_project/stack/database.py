"""RDS PostgreSQL helpers for Assignment 6."""

from __future__ import annotations

import secrets
from pathlib import Path

from botocore.exceptions import ClientError

from stack.config import Settings


def find_default_vpc(ec2) -> str:
    """Return the default VPC ID."""

    response = ec2.describe_vpcs(
        Filters=[
            {
                "Name": "isDefault",
                "Values": ["true"],
            }
        ]
    )

    vpcs = response.get("Vpcs", [])

    if not vpcs:
        raise RuntimeError(
            "No default VPC was found."
        )

    return vpcs[0]["VpcId"]


def find_subnet_in_az(
    ec2,
    vpc_id: str,
    availability_zone: str,
) -> str:
    """Return one subnet in the requested AZ."""

    response = ec2.describe_subnets(
        Filters=[
            {
                "Name": "vpc-id",
                "Values": [vpc_id],
            },
            {
                "Name": "availability-zone",
                "Values": [availability_zone],
            },
        ]
    )

    subnets = response.get("Subnets", [])

    if not subnets:
        raise RuntimeError(
            f"No subnet found in {availability_zone}."
        )

    return subnets[0]["SubnetId"]


def find_security_group(
    ec2,
    group_name: str,
    vpc_id: str,
) -> str | None:
    """Return a security group ID by name, or None."""

    response = ec2.describe_security_groups(
        Filters=[
            {
                "Name": "group-name",
                "Values": [group_name],
            },
            {
                "Name": "vpc-id",
                "Values": [vpc_id],
            },
        ]
    )

    groups = response.get(
        "SecurityGroups",
        [],
    )

    if not groups:
        return None

    return groups[0]["GroupId"]


def ensure_database_security_group(
    ec2,
    settings: Settings,
    vpc_id: str,
) -> str:
    """Create the DB security group if needed."""

    existing = find_security_group(
        ec2,
        settings.database.security_group_name,
        vpc_id,
    )

    if existing:
        print(
            "Database security group already exists:",
            existing,
        )
        group_id = existing
    else:
        response = ec2.create_security_group(
            GroupName=
                settings.database.security_group_name,

            Description=
                "PostgreSQL access from app instances only",

            VpcId=vpc_id,
        )

        group_id = response["GroupId"]

        print(
            "Created database security group:",
            group_id,
        )

    ensure_database_ingress(
        ec2,
        group_id,
        settings,
    )

    return group_id


def ensure_database_ingress(
    ec2,
    db_security_group_id: str,
    settings: Settings,
) -> None:
    """Allow PostgreSQL only from the app SG."""

    try:
        ec2.authorize_security_group_ingress(
            GroupId=db_security_group_id,

            IpPermissions=[
                {
                    "IpProtocol": "tcp",

                    "FromPort":
                        settings.database.port,

                    "ToPort":
                        settings.database.port,

                    "UserIdGroupPairs": [
                        {
                            "GroupId":
                                settings
                                .app_security_group_id,
                        }
                    ],
                }
            ],
        )

        print(
            "Added PostgreSQL ingress from app security group."
        )

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "InvalidPermission.Duplicate":
            print(
                "Database ingress rule already exists."
            )
            return

        raise


def subnet_group_exists(
    rds,
    name: str,
) -> bool:
    """Return True if the DB subnet group exists."""

    try:
        rds.describe_db_subnet_groups(
            DBSubnetGroupName=name
        )
        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "DBSubnetGroupNotFoundFault":
            return False

        raise


def ensure_db_subnet_group(
    rds,
    settings: Settings,
    subnet_a: str,
    subnet_b: str,
) -> None:
    """Create the RDS subnet group if needed."""

    name = settings.database.subnet_group_name

    if subnet_group_exists(rds, name):
        print(
            "DB subnet group already exists:",
            name,
        )
        return

    rds.create_db_subnet_group(
        DBSubnetGroupName=name,

        DBSubnetGroupDescription=
            "Lab subnets for the weather database",

        SubnetIds=[
            subnet_a,
            subnet_b,
        ],
    )

    print(
        "Created DB subnet group:",
        name,
    )


def parameter_exists(
    ssm,
    name: str,
) -> bool:
    """Return True if an SSM parameter exists."""

    try:
        ssm.get_parameter(
            Name=name
        )
        return True

    except ssm.exceptions.ParameterNotFound:
        return False


def ensure_database_password(
    ssm,
    parameter_name: str,
) -> str:
    """Create or reuse the DB password SecureString."""

    if parameter_exists(
        ssm,
        parameter_name,
    ):
        print(
            "Database password parameter already exists."
        )

        response = ssm.get_parameter(
            Name=parameter_name,
            WithDecryption=True,
        )

        return response["Parameter"]["Value"]

    password = secrets.token_hex(16)

    ssm.put_parameter(
        Name=parameter_name,
        Type="SecureString",
        Value=password,
        Overwrite=False,
    )

    print(
        "Created database password SecureString."
    )

    return password


def database_exists(
    rds,
    instance_id: str,
) -> bool:
    """Return True if the RDS instance exists."""

    try:
        rds.describe_db_instances(
            DBInstanceIdentifier=instance_id
        )
        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "DBInstanceNotFound":
            return False

        raise


def ensure_database_instance(
    rds,
    settings: Settings,
    db_security_group_id: str,
    password: str,
) -> None:
    """Create the PostgreSQL RDS instance if needed."""

    db = settings.database

    if database_exists(
        rds,
        db.instance_id,
    ):
        print(
            "Database already exists:",
            db.instance_id,
        )
        return

    rds.create_db_instance(
        DBInstanceIdentifier=
            db.instance_id,

        DBInstanceClass=
            db.instance_class,

        Engine=
            "postgres",

        AllocatedStorage=
            db.allocated_storage,

        StorageType=
            db.storage_type,

        StorageEncrypted=
            True,

        MasterUsername=
            db.user,

        MasterUserPassword=
            password,

        DBName=
            db.name,

        DBSubnetGroupName=
            db.subnet_group_name,

        VpcSecurityGroupIds=[
            db_security_group_id
        ],

        AvailabilityZone=
            settings.az_a,

        BackupRetentionPeriod=
            0,

        MultiAZ=
            False,

        PubliclyAccessible=
            False,

        AutoMinorVersionUpgrade=
            False,

        DeletionProtection=
            False,
    )

    print(
        "Started PostgreSQL database creation:",
        db.instance_id,
    )


def wait_for_database(
    rds,
    instance_id: str,
) -> None:
    """Wait until RDS reports the database available."""

    print(
        "Waiting for database to become available..."
    )

    waiter = rds.get_waiter(
        "db_instance_available"
    )

    waiter.wait(
        DBInstanceIdentifier=instance_id,
        WaiterConfig={
            "Delay": 30,
            "MaxAttempts": 40,
        },
    )

    print(
        "Database is available."
    )


def get_database_host(
    rds,
    instance_id: str,
) -> str:
    """Return the database endpoint hostname."""

    response = rds.describe_db_instances(
        DBInstanceIdentifier=instance_id
    )

    return (
        response["DBInstances"][0]
        ["Endpoint"]["Address"]
    )


def write_database_outputs(
    path: str | Path,
    host: str,
    security_group_id: str,
) -> None:
    """Write non-secret database outputs."""

    output_path = Path(path)

    output_path.write_text(
        f"DB_HOST={host}\n"
        f"DB_SECURITY_GROUP_ID={security_group_id}\n"
    )


def create_database(
    ec2,
    rds,
    ssm,
    settings: Settings,
    output_path: str | Path = "db_outputs.env",
) -> dict[str, str]:
    """Create all database resources idempotently."""

    print(
        "== Default VPC and subnets =="
    )

    vpc_id = find_default_vpc(ec2)

    subnet_a = find_subnet_in_az(
        ec2,
        vpc_id,
        settings.az_a,
    )

    subnet_b = find_subnet_in_az(
        ec2,
        vpc_id,
        settings.az_b,
    )

    print("VPC:", vpc_id)
    print("Subnet A:", subnet_a)
    print("Subnet B:", subnet_b)

    print(
        "== Database security group =="
    )

    db_security_group_id = (
        ensure_database_security_group(
            ec2,
            settings,
            vpc_id,
        )
    )

    print(
        "== DB subnet group =="
    )

    ensure_db_subnet_group(
        rds,
        settings,
        subnet_a,
        subnet_b,
    )

    print(
        "== Database password =="
    )

    password = ensure_database_password(
        ssm,
        settings.database.password_param,
    )

    try:
        print(
            "== PostgreSQL RDS instance =="
        )

        ensure_database_instance(
            rds,
            settings,
            db_security_group_id,
            password,
        )

        wait_for_database(
            rds,
            settings.database.instance_id,
        )

        host = get_database_host(
            rds,
            settings.database.instance_id,
        )

    finally:
        password = None

    write_database_outputs(
        output_path,
        host,
        db_security_group_id,
    )

    print(
        "Database endpoint:",
        host,
    )

    print(
        "Automated backup retention: 0"
    )

    print(
        "Database is private and single-AZ."
    )

    return {
        "DB_HOST":
            host,

        "DB_SECURITY_GROUP_ID":
            db_security_group_id,
    }
