# Codex Hints (PR Milestones)

- Always include a `Milestone:` line at the very top of the PR body.
- Use the exact milestone title, emoji included. Titles are case-sensitive.
- If unsure which milestone applies, default to `🧬 Feature Development`.
- Keep `Scope:` listing the components or services touched.

The sync workflow falls back to a `Milestone:` prefix in the PR title if the header line is missing and will automatically create the milestone if it does not already exist.

Example:
```
Milestone: 🧬 Feature Development
Scope: camera-proxy, web-app
Linked Issues: #123
```
