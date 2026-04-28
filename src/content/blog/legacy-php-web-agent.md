---
title: "Your Legacy PHP App Is a Black Box. Here's How to X-Ray It with a Web Agent."
description: "How to use visual web agents like MolmoWeb to document and reverse-engineer legacy PHP applications for modernization."
pubDate: 2026-04-09
draft: false
---

You've been asked to rebuild a 300-page monolith without breaking the business. The first problem isn't architecture -- it's archaeology.

Multiple databases. Three hundred pages. Zero documentation. One business that cannot go offline. This is not a horror story -- it's most engineering organisations' Tuesday morning.

In a recent discussion with an engineering leader I was asked. You have a PHP application. It's old enough that the engineers who built it are long gone. It talks to MySQL for transactional data, PostgreSQL for reporting, and Google Bigtable for something that someone once described as "the event log" -- though nobody is entirely sure what events, or why Bigtable, or what would happen if you turned it off.

The application has about 300 pages. Some of them do things you understand. Many of them do things that are... unclear. There are forms that submit to endpoints you can't find in the routing table. There are pages that show data aggregated in ways that seem mathematically interesting but aren't documented anywhere. There's a report that the finance team runs every Friday that the CTO has described as "mission critical" and that nobody on the engineering team has ever actually opened. There are forms to change configs depending upon the situations / events.

Leadership has made a decision: rebuild it to actually own it. Modern microservices, proper frontend framework, observability baked in from day one, the works. But -- and this is the part that keeps you up at night -- the legacy system cannot be deprecated. It has to run in parallel, handling real traffic, while the new system is built alongside it.

So. Where do you start?

## The Archaeology Problem

The conventional answer is: you start by understanding the existing system. You read the code, trace the data flows, run database queries to infer what the schema is actually storing, schedule interviews with any stakeholders who remember how things were supposed to work, and gradually build a requirements document that describes what the new system needs to do.

This approach works. It also takes six to twelve months, produces a document that's already partially wrong by the time it's reviewed, and consumes your most senior engineers during exactly the period when you need them focused on the new architecture.

The specific pain point isn't that the work is hard -- it's that most of it is mechanical. Someone has to methodically click through every page. Someone has to record what each form field is called, what validation rules apply, what happens when you submit with missing data. Someone has to trace which pages link to which other pages, which data created on one page shows up on another, which workflows span multiple steps across multiple screens.

This is not the kind of work that requires a senior engineer. It's the kind of work that requires a very patient, very systematic person with infinite time and perfect memory. Which is to say: it's the kind of work that's now a reasonable thing to give to a machine.

The legacy system doesn't need to be readable. It just needs to be runnable. And if it's runnable, a visual web agent can observe it systematically, tirelessly, at scale.

## What Visual Web Agents Actually Do

Let me be specific about what I mean, because "AI agent" has become a term that can mean almost anything.

A visual web agent -- MolmoWeb, released in March 2026 by the Allen Institute for AI, is the open-source example -- operates a browser the way a human does. You give it a task in plain English. It takes a screenshot of the current browser state, decides what to do next, executes that action (click, type, scroll, navigate), and repeats. It's not reading HTML. It's not parsing the DOM. It's looking at what's on the screen, exactly as a human would.

That last point matters more than it sounds. Legacy PHP applications routinely produce non-standard HTML, inline styles, deprecated elements, and DOM structures that make programmatic scraping a nightmare. But the browser renders them just fine. The page looks the way it's supposed to look, even if the underlying markup is a historical artefact. A visual agent sees the rendered output -- the same thing your users see -- which means it works on any web application, regardless of how the underlying code is structured.

### Why screenshots beat source code for this job

Source code tells you what the developer intended. Screenshots tell you what the system actually does. For a legacy app where the two have diverged significantly -- and they always have -- the screenshots are the ground truth. The agent documents behaviour, not intention.

### How MolmoWeb slots into the legacy documentation pipeline

MolmoWeb specifically adds something that makes it particularly interesting for this use case: it was designed for batch workflows. You can give it a list of 300 URLs and a set of task templates -- "visit this page, identify all form fields, record their labels and types, submit with empty data and record any validation messages" -- and run it overnight. You come back in the morning to a structured log of what it found on every page.

## The Four-Phase Documentation Workflow

Based on what I've been exploring, here's how I'd structure an agent-assisted legacy documentation project. This is not theory -- each phase produces a concrete, usable output.

### Phase 1: Visual inventory -- every page, every state

The agent crawls the entire application -- every URL in the sitemap, every navigation path it can discover -- and captures a screenshot of each page in its default loaded state. The output is a complete visual catalogue: what every screen in the system looks like, right now, today. No interpretation, no inference. Just pixels. This alone, generated in a few hours, gives your team something they've never had: a single place to look at the entire application.

### Phase 2: Workflow execution -- watching the system work

For each identified workflow -- create a record, edit a record, run a report, process a transaction, export data -- the agent executes the workflow step by step, capturing the screen before and after each action. The result is a trajectory: an ordered sequence of screenshots and actions that documents the exact user experience of every business process in the system. This is your de facto requirements catalogue. Not what the system was supposed to do. What it actually does.

### Phase 3: Structured extraction -- from pixels to requirements

A second LLM pass -- you don't need MolmoWeb for this, any capable vision model works -- reads the trajectory screenshots and produces structured output: field names, data types, validation rules (inferred from the error messages that appear when you submit incorrectly), mandatory vs optional fields, dropdown options, conditional display logic. Each extracted requirement traces back to the screenshot that produced it. That traceability is important -- when a stakeholder questions a requirement, you can show them the screenshot of the legacy system doing exactly that thing.

### Phase 4: Dependency mapping -- the invisible architecture

By watching which pages link to which, which data created on one screen appears on another, and which actions navigate to specific destinations, the agent builds an implicit information architecture. This is arguably the most valuable output -- it captures the data flows and page relationships that nobody ever wrote down, because when the system was built, everyone just knew. Now, finally, it's documented.

## The Number That Changes the Conversation

I said earlier that manual archaeology takes six to twelve months. Let's pressure-test that against the agent-assisted approach.

**Phase 1** -- full visual inventory of 300 pages -- runs overnight. One night. You wake up to screenshots of every page in the application, automatically organised by the URL structure.

**Phase 2** -- workflow execution -- is where the time investment sits. You need to define the workflows first, which requires some human judgment. But once defined, the agent executes them. A team of one engineer scoping workflows plus one agent running them can cover the major business processes in a week. The edge cases and minor flows take another week. Call it two weeks for 80% coverage.

**Phase 3** -- structured extraction -- is another overnight job. You batch the trajectories, run them through a vision LLM with a structured output prompt, and get a requirements CSV or JSON the next morning.

**Phase 4** -- dependency mapping -- is partly automated (the agent logs every navigation action it takes) and partly a human analysis job. A week of work by someone who understands the domain.

**Total: four to six weeks**, with the actual engineering effort concentrated in workflow scoping and output review rather than manual clicking. Compared to six to twelve months. With three to four engineers instead of ten.

> **The key mental shift:** The goal isn't a perfect requirements document. It's a good enough requirements document, produced fast enough that your engineers can start building before they forget why they were excited about the new architecture. A 90% complete document in five weeks is worth more than a 100% complete document in ten months. The 10% that's missing is exactly what stakeholder reviews and QA testing are for.

## But What About the 10% It Gets Wrong?

I want to be honest about the limitations, because this is a Medium article written by a person who still has to apply and see what would be the runtime challenges.

Visual agents make mistakes. MolmoWeb's technical report is candid about this: small text rendered at low resolution can be misread. Complex data tables -- the kind that legacy PHP systems love to produce -- can be partially misinterpreted. The agent cannot see inside database transactions; it can only observe what the UI exposes. Some validation rules are enforced server-side and only triggered by very specific inputs that the agent might not think to try.

These are real limitations. They're also manageable ones, with the right workflow design.

The pattern that works is **agent drafts, engineer reviews**. The agent produces a first pass. Engineers -- specifically, domain-knowledgeable engineers who understand the business context -- review the output, not to rewrite it from scratch, but to annotate, correct, and fill gaps. The review is fast because the draft is detailed. You're not starting from a blank page; you're editing a document that's 85% right. That's a fundamentally different cognitive task, and a much faster one.

Team runs a weekly "archaeology review" session where a domain expert and a product manager go through the week's agent output together. The agent runs Monday to Thursday. Friday is review. It's become a rhythm. The product manager, who spent most of his/her career trying to extract information from engineers who were too busy to document anything, describes it as "finally having a conversation about the system that's based on evidence rather than memory."

## The Benefit Nobody Talks About: Version Control for Reality

Here's the thing about legacy systems: they change. The business still runs on this PHP application while you're building the replacement. Things get patched. Edge cases get fixed. Someone adds a field to a form without telling anyone. A report changes its rounding logic.

With manual documentation, you have no good answer to this. The document becomes stale the moment it's written, and there's no practical way to detect what changed.

With agent-assisted documentation, you have something remarkable: a re-runnable process. Schedule the agent to re-crawl the application monthly. Diff the trajectory outputs against the previous run. The diff tells you exactly what changed -- which pages look different, which workflows produce different outputs, which form fields appeared or disappeared. Your requirements document becomes a living thing, not an archaeological artefact.

When your new microservice is being built for a specific domain -- say, order management -- and someone patches the order management flows in the legacy system two weeks before your cutover, you'll know. Because the agent will tell you.

## How to Actually Start Tomorrow

If you're reading this and you have a legacy system and a modernisation mandate, here's the most practical on-ramp I can offer.

Don't try to document everything at once. Pick the one domain that's blocking your first microservice -- probably your most critical, probably the one everyone is most nervous about. Set up MolmoWeb locally (it runs against a local Chromium, and the setup is a couple of hours of work), define five to ten core workflows for that domain, and run them. Look at the trajectory output. Show it to a stakeholder who knows that domain well.

That conversation -- engineer and stakeholder, looking at screenshots of the legacy system doing actual things -- is worth more than three weeks of requirements meetings. The screenshots make the abstract concrete. "Is this what should happen when a user submits without filling in the customer reference?" is a question you can now ask while both parties are looking at evidence.

If that goes well, expand. If it surfaces problems with the agent's output -- and it will -- fix the workflow definition and re-run. The iteration cycle is fast because the agent is fast.

The repository is at `github.com/allenai/molmoweb`. The weights are on HuggingFace, Apache 2.0 licensed, HuggingFace-Transformers compatible. The inference library gives you a Python API that's genuinely usable. You don't need a GPU cluster -- the 4B model runs on a single A100.

## The Broader Point

What I've described here is not, at heart, a story about a specific AI model. It's a story about what happens when you correctly identify which parts of a hard problem are mechanical and which parts require genuine judgment -- and then stop assigning mechanical work to people who are expensive precisely because of their judgment.

Systematically clicking through 300 pages and writing down what you see is mechanical. Understanding which of those 300 pages represent genuine business logic that needs to be faithfully replicated versus historical accidents that should be deliberately improved -- that's judgment. The agent does the former. Your engineers do the latter. Everyone ends up doing the work they're actually good at.

Your legacy PHP app has been a black box for years, not because it's inherently mysterious, but because nobody had the time and patience to observe it systematically. Now something does.

The box is getting a lot more transparent.
