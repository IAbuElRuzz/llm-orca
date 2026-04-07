# Sample usage

```bash
llm-router doctor
llm-router template list
llm-router profile init default --provider claude --approval ask --sandbox workspace --default
llm-router rules add bug-fix --terms bug,error,crash --provider codex
llm-router run -p "review this repository" --template repo-review --with src,README.md
llm-router compare --providers claude,codex,gemini -p "find likely defects" --with src
llm-router tui
```
