# Security Policy

Plasma reads local agent skill files and can optionally scan local session metadata. The skill scanner targets Codex-style `SKILL.md` directories plus any labeled local roots configured through `PLASMA_AGENT_SKILL_ROOTS`. Privacy and local filesystem safety are core product behavior across agent environments.

## Supported Versions

Security fixes target the latest `master` branch while the project is in beta.

## Reporting A Vulnerability

Please do not open a public issue for suspected vulnerabilities involving local file access, private paths, session data, or dependency compromise.

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not enabled yet, contact the repository owner privately and include:

- a concise description of the issue
- reproduction steps
- the affected operating system and Node.js version
- whether local generated data, session files, or environment variables are involved

## Security Expectations

- Default scans must remain local and read-only.
- Usage scans must remain explicit opt-in.
- Generated local data must stay ignored by git.
- New network access should be documented and justified before it is added.
