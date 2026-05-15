# pi-extensions (curated fork)

A trimmed personal fork of the upstream [Pi extensions collection](https://github.com/badlogic/pi-mono).

This repo keeps only the extensions currently enabled by the local Pi config (`~/.pi/agent/settings.json`) and removes the rest of the upstream code to make ongoing maintenance simpler.

## Included extensions

| Extension | Description |
|-----------|-------------|
| [tab-status](tab-status/) | Manage parallel Pi sessions with terminal tab indicators: ✅ done / 🚧 stuck / 🛑 timed out |
| [/paste](raw-paste/) | Paste editable text, not `[paste #1 +21 lines]` |
| [/code](code-actions/) | Pick code blocks or inline snippets from assistant messages to copy, insert, or run |
| [/usage](usage-extension/) | Usage statistics dashboard for cost, tokens, and messages |

## Install

Install from your own fork:

```bash
pi install git:github.com/<your-account>/pi-extensions
```

Because this fork is already pruned, no extra package filtering is needed.

## Quick Setup

If you keep a local clone, add only the remaining extensions to your `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "~/pi-extensions/tab-status/tab-status.ts",
    "~/pi-extensions/raw-paste/index.ts",
    "~/pi-extensions/code-actions/index.ts",
    "~/pi-extensions/usage-extension/index.ts"
  ]
}
```

See each extension's README for details.
