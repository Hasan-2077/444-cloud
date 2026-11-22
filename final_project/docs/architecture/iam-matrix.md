# IAM Permission Matrix

| Capability | Advisor Role | Weather Role |

| Read Gemini SecureString | Allow | Deny |
| Read weather cache | Allow only if architecture requires it | Allow |
| Write weather cache | Deny | Allow |
| Read saved reports | Allow | Deny |
| Write saved reports | Allow | Deny |
| Update Gemini counter | Allow | Deny |
| Send SES email | Allow | Deny |
| Manage AWS infrastructure | Deny | Deny |

## IAM Design Rules

- No wildcard actions
- No wildcard resource ARNs
- Each policy references the exact AWS resource it requires
- Weather role cannot access the Gemini secret
- Weather role cannot send email
- Advisor role cannot modify unrelated DynamoDB resources
