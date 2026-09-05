# Agent Execution Rules
- Strictly respect the user-selected model from the UI combo box (e.g., Gemini 3.5 Flash).
- NEVER automatically route, cascade, or upgrade any sub-task to Gemini Pro without manual user confirmation.
- Only run operations compatible with the current active chat model window.
- DO NOT create implementation plans for simple tasks (static/marketing pages, minor visual tweaks, navigation links). Only create plans for structural database changes or complex authentication flows.
- STRICTLY FORBIDDEN to use `run_command` for reading, inspecting, or searching files and directories (e.g. `cat`, `Get-Content`, `type`, `head`, `tail`, `grep`, `findstr`, `dir`, `ls`, `git show`).
- For ANY file or directory inspection, EXCLUSIVELY use the IDE native tools:
  * File reading: `view_file`
  * Text/pattern search: `grep_search`
  * Directory listing: `list_dir`
  * `run_command` is strictly restricted to operations that actually alter state or execute ecosystem commands (`npm install`, `npm run build`, servers, `git`).
- Upon COMPLETING any user request or code modification:
  1. Immediately run `npm run build` to verify there are no compilation or TypeScript errors;
  2. If any build errors occur: diagnose and apply all required fixes until clean;
  3. If the build succeeds: proactively offer the git commands formatted as a single one-liner using `;` (Windows PowerShell compatible, e.g. `git add ...; git commit -m "..."; git push`).