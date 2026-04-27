---
title: "Engineering Management Notes"
description: "A placeholder post with realistic structure: headings, lists, and a code block."
pubDate: 2026-01-15
draft: false
---

This is a placeholder post used to exercise the blog layout. Replace the body when you have something real to say.

## What "good" looks like in a weekly review

A weekly team review is the smallest unit of work that compounds. The shape I keep coming back to:

1. **What shipped** — links, not adjectives.
2. **What's stuck** — name the blocker and the owner.
3. **What we learned** — one bullet, often skipped, always the most valuable.
4. **Next week's bets** — the two or three things that justify the rest of the calendar.

If a meeting can't fill those four sections honestly, it isn't a review — it's a status update with extra steps.

## A note on metrics

Most team metrics fail the same way: they measure what's easy to count rather than what matters. A short checklist before adopting a number:

- Could a reasonable engineer game this without improving the underlying thing? If yes, retire it.
- Does it move on the timescale of the decisions it informs?
- Is it durable across reorgs, or is it tied to a specific tool?

## A small example

Here's the kind of script I'd actually paste — the point is layout, not the snippet.

```ts
function summarize(reviews: Review[]) {
  return reviews
    .filter((r) => !r.skipped)
    .map((r) => ({ team: r.team, shipped: r.shipped.length }))
    .sort((a, b) => b.shipped - a.shipped);
}
```

> The job isn't to look busy. It's to be the kind of leader whose team can answer "what did we ship and why does it matter?" without flinching.

That's it for the placeholder. Real posts to follow.
