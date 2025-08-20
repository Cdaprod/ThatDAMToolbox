# Codex PR Authoring Rules

When opening a PR, always include these header lines at the top of the PR body:

Milestone: <EXACT TITLE FROM MILESTONES LIST>
Scope: <comma-separated components>
Linked Issues: <#issue, #issue>

Valid Milestones (copy **exactly**, including emoji):
- 🛠️ Project Initialization
- 🧪 Planning and Setup
- 🧬 Feature Development
- 🎯 Prototype and Validation
- 🛠️ Refinement and Optimization
- 🧪 Staging and Testing
- 🎉 Public Release
- 🎯 Post-Release and Maintenance

If unsure, default to **🧬 Feature Development**.

The milestone sync workflow will create a new milestone automatically if the title does not yet exist in the repository. It also falls back to parsing the PR title for a `Milestone:` prefix, though the header block above remains required.

All new scripts or workflows must be idempotent and documented per repository standards.
