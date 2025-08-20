# Codex Hints (PR Milestones)

The sync workflow falls back to a `Milestone:` prefix in the PR title if the header line is missing and will automatically create the milestone if it does not already exist.

Example:
```
Milestone: 🧬 Feature Development
Scope: camera-proxy, web-app
Linked Issues: #123
```


When opening a PR, always include these header lines at the top of the PR body:

Milestone: <EXACT TITLE FROM MILESTONES LIST>
Scope: <comma-separated components>
Linked Issues: <#issue, #issue>

### Valid Milestones (copy **exactly**, including emoji):
- 🛠️ Project Initialization
- 🧪 Planning and Setup
- 🧬 Feature Development
- 🎯 Prototype and Validation
- 🛠️ Refinement and Optimization
- 🧪 Staging and Testing
- 🎉 Public Release
- 🎯 Post-Release and Maintenance

If unsure, default to **🧬 Feature Development**.

### Commit / PR Checklist
- Change is self-contained & idempotent.
- No unnecessary files or dependencies added.
- Tests added or updated.
- Docs / OpenAPI / Events updated.
- Conventional commit message (feat, fix, …).
- Milestone set from list below.

### 📆 Milestones
- Assign one of the GitHub milestones below to every PR and mention it in the PR body so Codex can surface the phase in its output.
    - 🛠️ Project Initialization – Foundation layer - Initializing the project.
    - 🧪 Planning and Setup – Initial stage focused on defining project scope, requirements, and setting up basic project infrastructure.
    - 🧬 Feature Development – Stage for building and implementing core project features and functionality.
    - 🎯 Prototype and Validation – Creating a prototype for validation, testing the feasibility, and refining key project aspects.
    - 🛠️ Refinement and Optimization – Focusing on refining features and optimizing performance before staging.
    - 🧪 Staging and Testing – Setting up the staging environment for final tests and quality assurance before release.
    - 🎉 Public Release – Launching the project to the public and ensuring stable deployment.
    - 🎯 Post-Release and Maintenance – Ongoing maintenance, bug fixes, and feature improvements after public release.


All new scripts or workflows must be idempotent and documented per repository standards.

- Always include a `Milestone:` line at the very top of the PR body.
- Use the exact milestone title, emoji included. Titles are case-sensitive.
- If unsure which milestone applies, default to `🧬 Feature Development` but try keep them sorted by closest milestone type
- Keep `Scope:` listing the components or services touched.
