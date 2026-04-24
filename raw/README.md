# raw/

Drop anything here that's *about* the codebase but isn't code.

- Bug reports, customer messages, Slack screenshots
- Design decisions, "why we chose X" notes
- Meeting summaries, interview transcripts
- Paper PDFs, article links, competitor analyses
- Half-formed thoughts, hypotheses, open questions

No structure required. Plain markdown is best. The LLM (via `/graphify raw --update` or the git hook) will read this folder and connect concepts here to code nodes in the graph — especially via `rationale_for` edges ("this Slack thread is the *why* behind that service's design").

Files in this folder are not tracked by the git hook's auto-rebuild (which only handles code). After adding to `raw/`, run manually:

```
/graphify raw --update
```

to pull the new rationale nodes into the graph.

## Why this exists

From Karpathy's LLM Wiki pattern: the hard part of a knowledge base isn't storing answers, it's capturing the *context* that explains why the code looks the way it does. That context lives in Slack, heads, and old chats. Dumping it here — even messy — is enough; the LLM will structure it.
