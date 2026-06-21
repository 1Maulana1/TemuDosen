# Claude Workspace Instructions

This workspace contains multiple areas. Prefer working in the folder that matches the user's request:

- `library-management` for the application code
- `gsd-new-project` for GSD workflow artifacts and planning files

When acting on this repository:

- Make the smallest change that solves the request.
- Keep edits focused on the relevant folder and avoid touching unrelated files.
- Use the existing VS Code task `Jalankan Claude CLI` to launch Claude from the editor.
- If you need to verify behavior, run the narrowest relevant check first.

If a task or workflow file already points to a different instruction file, treat this file as the workspace root default.