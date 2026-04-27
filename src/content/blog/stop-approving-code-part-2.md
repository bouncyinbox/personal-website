---
title: "Stop Approving Code You Didn't Read (Part 2): The Secrets, The Process, and The Human Side"
description: "Battle-tested code review secrets covering security, structured logging, error handling, concurrency bugs, performance, and the human side of giving feedback."
pubDate: 2026-03-27
draft: false
---

*Part 2 is about how you think about what you find*

If you haven't read Part 1, go read that first. It covers the risk framework and the 8 design lenses I apply to every PR. This part builds on that foundation.

The eight lenses give you a systematic way to evaluate code structure and design. But there are deeper patterns that I've only learned through years of production incidents and post-mortems. These are the things that catch the bugs that slip through design review. The stuff that doesn't show up in textbooks but absolutely shows up in your PagerDuty at 3am.

## The Secrets That Separate Good Reviewers From Great Ones

### Read the Tests Before the Code

The tests tell you what the author intended the code to do. If there are no tests, that's your first comment. If the tests only cover the happy path, the code isn't production-ready. Full stop.

And here's something Google's eng practices point out that I think is underappreciated: tests are also code that has to be maintained. Don't accept complexity in tests just because they aren't part of the main binary. Tests that are too clever become a burden themselves.

What one should look for specifically: Are edge cases covered? Empty arrays, null values, zero, negative numbers? Are error paths tested? What happens when the database is down? Are tests isolated, or do they depend on execution order? And most importantly, are they testing behaviour or implementation?

```javascript
// Bad test -- testing implementation details
it('should call sendEmail method', async () => {
  const spy = jest.spyOn(service, 'sendEmail');
  await service.placeOrder(userId, items);
  expect(spy).toHaveBeenCalled(); // breaks if you rename the method
});

// Good test -- testing observable behaviour
it('should notify user after successful order', async () => {
  const fakeMailer = new FakeMailer();
  const service = new OrderService(fakeDb, fakeMailer, fakePayment);
  await service.placeOrder(userId, items);
  expect(fakeMailer.sentMessages).toHaveLength(1);
  expect(fakeMailer.sentMessages[0].to).toBe(user.email);
});
```

The first test breaks every time you refactor internals. The second test only breaks when actual behaviour changes. That's a massive difference when your team is trying to move fast.

Will the tests actually fail when the code is broken? This is a question worth asking more often. If the code changes beneath them and they keep passing, you've got a false sense of security that's worse than having no tests at all.

### Security Lives in the Details

Security vulnerabilities rarely look dangerous in a PR. They look like convenience. That's what makes them so insidious.

SQL Injection is somehow still a thing in 2025. Still seen in PRs from experienced engineers. Not because they don't know better, but because the unsafe version reads more cleanly:

Same thing in Go:

```go
// Bad
row := db.QueryRow(fmt.Sprintf("SELECT * FROM users WHERE id = '%s'", userID))

// Good
row := db.QueryRow("SELECT * FROM users WHERE id = $1", userID)
```

Secrets in logs is another one that bites teams constantly:

```javascript
// Bad -- API keys and passwords visible in logs forever
logger.info('Charging customer', {
  stripeKey: process.env.STRIPE_SECRET_KEY,
  cardNumber: payment.cardNumber,
  userId
});

// Good -- log only what you need to debug
logger.info('payment.initiated', {
  userId,
  orderId,
  amountCents: total,
  traceId: context.traceId
});
```

You'd be shocked how often API keys end up in log aggregators because someone logged the entire config object or request payload. And once it's in Datadog or CloudWatch, it's there until someone manually purges it.

And the JWT trap that catches a lot of people:

```javascript
// Bad -- trusting algorithm from token header
const decoded = jwt.verify(token, secret, {});

// Good -- always specify allowed algorithms
const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
```

Google's practices specifically call out security as something where you should make sure there's a qualified reviewer looking at it. If you're not confident about the security implications of a change, say so and pull someone in who is. There's no shame in that. In fact it's the responsible thing to do.

### Structured Logging is Non-Negotiable

This is the single thing that separates engineers who can debug production in minutes from engineers who spend hours grepping through log files.

```javascript
// Bad -- unsearchable, unstructured noise
logger.info('Order placed for user: ' + userId);
logger.error('Payment failed: ' + error.message);

// Good -- structured, queryable, complete context
logger.info('order.placed', {
  userId,
  orderId: order.id,
  amountCents: total,
  durationMs: Date.now() - startTime,
  traceId: context.traceId
});

logger.error('payment.failed', {
  userId,
  orderId: order.id,
  errorCode: error.code,
  provider: 'stripe',
  traceId: context.traceId
});
```

The structured version is filterable, alertable, and dashboardable. The string version is a haystack with no needle.

Every log event should have at minimum these five fields: userId (who), action (what), traceId (correlation), durationMs (performance), and timestamp (when). I flag any PR that introduces unstructured logging.

### Error Handling Reveals System Thinking

How a developer handles errors tells you more about their engineering maturity than almost any other single signal. Here are the failure modes I watch for.

Swallowing errors silently is the worst offender:

```javascript
// Bad -- error vanishes, system looks healthy while broken
try {
  await sendEmail(user.email, 'Welcome!', body);
} catch (e) {
  // nothing. the error is gone forever.
}

// Good -- fail loudly or handle explicitly
try {
  await sendEmail(user.email, 'Welcome!', body);
} catch (error) {
  logger.error('notification.email.failed', {
    userId: user.id,
    error: error.message,
    traceId: context.traceId
  });
  await alertingService.notify('email_failure', { userId: user.id });
}
```

Missing retry logic for transient failures is another common one. A single network hiccup shouldn't permanently fail an entire operation:

```javascript
// Bad -- one hiccup, permanent failure
const charge = await stripe.charge({ amount: total, customer: stripeId });

// Good -- transient failures retried with backoff
const charge = await retry(
  () => stripe.charge({ amount: total, customer: stripeId }),
  {
    attempts: 3,
    backoff: 'exponential',
    initialMs: 100,
    retryOn: (err) => err.type === 'StripeConnectionError'
  }
);
```

And for services that depend on other services, missing circuit breakers can cascade a single dependency failure into a system-wide outage:

```go
var breaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "payment-service",
    MaxRequests: 5,
    Interval:    10 * time.Second,
    Timeout:     30 * time.Second,
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        return counts.ConsecutiveFailures > 3
    },
})

func chargeCustomer(customerID string, amount int64) (*Charge, error) {
    result, err := breaker.Execute(func() (interface{}, error) {
        return paymentClient.Charge(customerID, amount)
    })
    if err != nil {
        return nil, fmt.Errorf("payment service unavailable: %w", err)
    }
    return result.(*Charge), nil
}
```

### Concurrency Bugs Are the Hardest to Catch

They don't appear in unit tests. They appear in production under load, intermittently, and almost never reproducibly. This is one area where Google's eng practices are very explicit: parallel programming in a CL that could theoretically cause deadlocks or race conditions needs someone to think through it carefully. You can't just run the code and hope.

Race condition that looks completely innocent:

```typescript
// Bad -- race condition on concurrent requests for same user
async function getUserPoints(userId: string): Promise<number> {
  const user = await db.getUser(userId);
  const points = user.points + 100;
  await db.updatePoints(userId, points);
  return points;
  // Two simultaneous requests: both read 500, both write 600
  // 100 points silently lost
}

// Good -- atomic update at database level
async function addUserPoints(userId: string, amount: number): Promise<number> {
  const result = await db.query(
    'UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points',
    [amount, userId]
  );
  return result.points;
}
```

And in Go, goroutine leaks are a classic that I catch in reviews regularly:

```go
// Bad -- goroutine blocks forever if nobody reads the channel
func fetchData(url string) chan Result {
    ch := make(chan Result)
    go func() {
        result, err := http.Get(url)
        ch <- Result{result, err} // blocks if caller abandoned the channel
    }()
    return ch
}

// Good -- context cancellation + buffered channel prevents leak
func fetchData(ctx context.Context, url string) chan Result {
    ch := make(chan Result, 1)
    go func() {
        req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
        result, err := http.DefaultClient.Do(req)
        select {
        case ch <- Result{result, err}:
        case <-ctx.Done():
        }
    }()
    return ch
}
```

The review signal I always recommend to look for: any shared mutable state accessed by more than one goroutine or async operation without synchronization is a race condition waiting to happen. Shared maps, counters, and slices accessed concurrently without mutexes or atomic operations. When I spot it, I flag it every single time.

### Performance Regressions Hide in Abstractions

The most expensive operations in any system are network calls, disk I/O, and database queries. Clean abstractions hide them, and thats when reviewers stop seeing them.

```typescript
// This looks like a simple loop over objects in memory
for (const user of users) {
  await enrichUserWithProfile(user); // hidden DB call inside
}
// Reality: N database queries for N users
// At 10,000 users: your database is on its knees
```

```typescript
// Make I/O explicit and batch it
async function enrichUsersWithProfiles(users: User[]): Promise<EnrichedUser[]> {
  const userIds = users.map(u => u.id);
  const profiles = await profileRepo.findByIds(userIds);
  const profileMap = new Map(profiles.map(p => [p.userId, p]));
  return users.map(user => ({
    ...user,
    profile: profileMap.get(user.id)
  }));
}
```

My heuristic: any time I see `await` inside a `for` loop, alarm bells go off. It's not always wrong, but it's wrong often enough that its worth flagging every single time. The fix is almost always the same: collect IDs, batch query, build a Map, join in memory.

### The Real Definition of "Done"

A feature isn't done when the code works. It's done when it's observable, operable, and reversible.

**Observable:** Is there a metric, log, and alert for this feature? If it silently breaks at 2am, how do you know?

```javascript
await metrics.increment('order.placed', {
  region: user.region,
  tier: user.subscriptionTier
});
await metrics.timing('order.processing_ms', duration);
```

**Operable:** Can the system be gracefully degraded when this feature is broken? Feature flags aren't just a product manager's toy. They're a first-class engineering concern.

```javascript
if (await featureFlags.isEnabled('new-recommendation-engine', { userId })) {
  recommendations = await newRecommendationEngine.get(userId);
} else {
  recommendations = await legacyRecommendationEngine.get(userId);
}
```

**Reversible:** Can this change be rolled back without a data migration? Database migrations that drop columns or delete data are irreversible deployments disguised as routine code changes. I always pay extra attention to these in review.

## How I Actually Recommend To Review a PR — The Process

Alright, so you've got the lenses from Part 1 and the patterns from above. But what does the actual process look like when I sit down with a PR? Here's how I step through it.

**Step 1: Read the PR description first (2 minutes).** If there's no description, that's your first comment. You shouldn't have to read code to understand why a change exists. A good PR description answers four things: what changed, why it changed, what was considered and rejected, and how to test it.

**Step 2: Understand the blast radius (3 minutes).** Before reading a single line of code, ask yourself: which systems does this touch? What's the worst-case failure mode? Is this change reversible? This determines how deeply you need to review. Google makes a great point about context here that I want to echo. Look at the change in the context of the whole file, not just the diff. Sometimes the review tool shows you four new lines, but when you look at the whole file those four lines are in a 50-line method that desperately needs to be broken up. Don't accept changes that degrade the overall code health of the system, even if the individual change looks fine in isolation.

**Step 3: Read the tests (5 minutes).** Tests are the specification. They tell you what the author intended. Missing tests tell you what the author didn't think about.

**Step 4: Read the implementation (15 minutes).** Now read the code, applying the lenses from Part 1 and the patterns from above. Make notes. Don't comment yet. Let the full picture form before you start writing feedback. And yes, look at every line. I know thats obvious but I see reviewers skip over data files, config changes, and migration scripts all the time. Those are often where the most dangerous changes hide.

**Step 5: Write feedback at the right level.** Not all feedback is equal. I calibrate my language with clear severity signals:

- **Blocker:** "This will cause data loss / security breach / outage." Must be fixed before merge, no exceptions.
- **Should fix:** "This will cause problems at scale or make the system fragile." Strongly recommended but we can discuss.
- **Suggestion:** "This is a style or readability preference. Take it or leave it."
- **Nit:** "Minor thing, not blocking." I prefix these with "nit:" so the author knows they can ignore them. Google does this too and its one of the best conventions I've adopted.

Mixing severity levels without being explicit makes authors treat everything as optional. Or worse, treat everything as blocking. Either way, you lose.

## The Human Side — How You Say It Changes Everything

This is the section that gets ignored in most articles about code review, and honestly its the part that matters most for team health.

I've seen genuinely brilliant engineers whose review comments were so abrasive that junior devs would avoid working on certain parts of the codebase entirely. Not because the code was scary, but because the reviewer was scary. That's not "high standards." That's a culture problem wearing a technical costume.

**Always explain the why.** "This should use a Map instead of a for loop" is a mediocre review comment. It asserts authority without transferring knowledge. "A Map would be clearer here because we're transforming each element without side effects, and it makes the data flow immediately obvious to the next reader" actually teaches something. The second version takes 30 extra seconds to write. But it makes the author better, not just the code better. And over time, that compounds enormously.

**Acknowledge good stuff.** Google's eng practices say this explicitly and I couldn't agree more: if you see something nice, tell the developer. Code reviews tend to focus entirely on mistakes, but recognition for good practices is sometimes even more valuable in terms of mentoring. I leave at least one genuinely positive comment on every PR I review. "Nice catch handling the nil case here" or "This abstraction is really clean, I might steal this pattern." It costs nothing and completely changes the vibe from "here's everything wrong with your code" to "here's what I noticed about your work."

**Ask questions instead of making declarations.** "Have you considered what happens if this list is empty?" hits completely differently than "This will crash on an empty list." Even if the fix is the same, the relationship impact is worlds apart. The first assumes competence and invites discussion. The second assumes a mistake.

I know this sounds like soft skills stuff that doesn't belong in a technical article. But I've been managing engineers long enough to tell you that the teams with the best code are invariably the teams where people feel safe being reviewed. That's not a coincidence.

## What One Should Look For as an Engineering Manager

My lens as an EM is different from when I was an IC. When I look at code reviews on my team, I'm not optimizing for any single PR. I'm looking at patterns that tell me about the team's health.

**Healthy signals:** PRs are small and frequent, under 400 lines. Authors write meaningful PR descriptions without being asked. Reviewers separate blocking issues from preferences. Discussions happen in PR comments, not in private Slack DMs. Junior engineers get explanations, not just corrections. PRs get approved and merged within 24 hours.

**Unhealthy signals:** PRs sit unreviewed for days. Reviews are rubber stamps with "LGTM" and nothing else. Authors get defensive. Reviewers get personal. The same architectural mistakes show up again and again because nobody is teaching, just gatekeeping.

The highest-leverage thing a senior engineer can do isn't writing great code. It's writing great review comments that teach others to write great code. Every review comment that explains the "why" behind a suggestion is worth more than an hour of formal training. Code review is the highest-leverage teaching moment your team has, and as an EM, it's your job to make sure your senior engineers understand that.

## The Compound Effect

Every shortcut in a code review compounds. An unreviewed N+1 query becomes a pattern. A pattern becomes a convention. A convention becomes "that's just how we do things here." And then one day your database melts and everyone acts surprised, even though the warning signs were in every other PR for the past year. Google's practices make the same observation: most systems become complex through many small changes that add up, so it's important to prevent even small complexities in new changes.

The flip side is also true. Every thoughtful review comment compounds too. An engineer who learns about race conditions from a review comment catches them in their own code next time. And in the PR they review after that. Knowledge spreads through teams via code review faster than any other mechanism I've found.

The engineers who make it to principal level aren't the ones who write the most code or ship the most features. They're the ones who raise the floor everywhere they go. Every codebase they touch gets a little better. Every engineer they review learns something. That effect compounds over years and its honestly the most impactful thing you can do in this career.

## The Reviewer's Checklist

Before I approve any PR, I mentally run through these. Not as a rigid checklist, but as a final sanity pass:

**Correctness:** Does it handle null, empty, and zero edge cases? Are error paths tested and handled explicitly? Is there a race condition on any shared state?

**Security:** Are all DB queries parameterized? Are secrets absent from logs? Is input validated before processing?

**Performance:** Is there an `await` inside a loop? Is the right data structure being used for the access pattern? Are there unbounded queries missing a `LIMIT`?

**Design:** Does each class or module have one reason to change? Are dependencies injected rather than hardcoded? Does the design survive the next likely requirement change?

**Observability:** Are key operations logged with structured context? Is there a metric for this feature? Can it be monitored and alerted on?

**Tests:** Are error paths tested? Are tests testing behaviour, not implementation? Would these tests actually catch a regression?

---

Code review isn't a chore. It's not a gate. It's not something that slows you down from "real work." It is the work. The engineers who understand that are the ones who end up making every codebase they touch better than they found it, one review at a time.

Thanks for reading both parts. If any of this resonated with you or sparked a disagreement, I'd love to hear about it. I'm always refining how I think about this stuff, and some of the best insights I've gotten came from people who told me I was wrong about something.
