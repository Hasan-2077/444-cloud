data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "tier" {
  for_each = local.tiers

  name               = "${var.name_prefix}-${each.key}-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_instance_profile" "tier" {
  for_each = local.tiers

  name = "${var.name_prefix}-${each.key}-profile"
  role = aws_iam_role.tier[each.key].name
}

data "aws_iam_policy_document" "weather" {
  statement {
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Scan"
    ]

    resources = [
      aws_dynamodb_table.weather.arn
    ]
  }
}

data "aws_iam_policy_document" "advisor" {
  statement {
    effect = "Allow"

    actions = [
      "ssm:GetParameter"
    ]

    resources = [
      aws_ssm_parameter.gemini.arn
    ]
  }
}

resource "aws_iam_role_policy" "weather" {
  name   = "${var.name_prefix}-weather-policy"
  role   = aws_iam_role.tier["weather"].id
  policy = data.aws_iam_policy_document.weather.json
}

resource "aws_iam_role_policy" "advisor" {
  name   = "${var.name_prefix}-advisor-policy"
  role   = aws_iam_role.tier["advisor"].id
  policy = data.aws_iam_policy_document.advisor.json
}
