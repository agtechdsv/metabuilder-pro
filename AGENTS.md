<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# Agent Execution Rules
- Strictly respect the user-selected model from the UI combo box (e.g., Gemini 3.5 Flash).
- NEVER automatically route, cascade, or upgrade any sub-task to Gemini Pro without manual user confirmation.
- Only run operations compatible with the current active chat model window.
- Não crie planos de implementação para tarefas simples, como criação de páginas estáticas ou de marketing, pequenos ajustes visuais ou adição de links de navegação. Apenas crie planos para alterações estruturais no banco de dados ou fluxos complexos de autenticação.