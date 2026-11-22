# Final Project Architecture Documentation

This directory contains the design records for the Graduate Weather Advisor Final Project.

## Files

architecture-decisions.md
Records the major architectural decisions and their rationale.

component-responsibilities.md
Defines what each cloud/application component owns and must not do.

request-flows.md
Defines the report-generation flow and email-delivery flow.

data-classification.md
Separates authoritative weather facts, deterministic derived categories, AI advice, and user data.

data-model.md
Defines the logical DynamoDB entities.

iam-matrix.md
Defines the least-privilege permissions for each application tier.

abuse-controls.md
Defines controls against Gemini abuse, email abuse, prompt injection, repeated requests, and malicious external content.

failure-matrix.md
Defines the expected system and user-visible behavior when dependencies fail.

threat-table.md
Records major threats and their controls.

architecture.mmd
Mermaid source for the architecture diagram.
