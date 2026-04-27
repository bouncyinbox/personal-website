---
title: "Concurrency in Go: How It Works, Why It Matters, and How to Tune It"
description: "A practical guide to goroutines, the Go scheduler, GOMAXPROCS, and how Go compares to Java, Node.js, and Python."
pubDate: 2026-02-21
draft: false
---

A practical guide to goroutines, the Go scheduler, GOMAXPROCS, and how Go compares to Java, Node.js, and Python.

## The Problem

Your backend receives 10,000 simultaneous requests. Each one queries a database, maybe calls an external API, and sends a response. The database alone takes 5-10ms to respond.

How do you handle all of this without making user #5,000 wait for everyone before them to finish? This is the concurrency problem, and how a language solves it defines the kind of backend you can build with it.

## How Languages Tried to Solve This

### Java and the Thread-Per-Request Model

For the first two decades of the web, the answer was simple: one request gets one OS thread. An OS thread is managed directly by the operating system and costs about 2MB of memory just for its stack.

```
10,000 requests -> 10,000 OS threads -> 20GB RAM
```

At low traffic this works fine. At scale it collapses, and the reason is something called a context switch.

Your CPU can only execute one thread at a time per core. To create the illusion of simultaneous execution, the OS rapidly switches between threads. Each switch requires saving the current thread's entire execution state (which instruction it was on, the values in CPU registers, the call stack) and loading another thread's state. This costs roughly 1-10 microseconds per switch and, more importantly, it destroys your CPU cache.

Your CPU cache is tiny but extremely fast. ~1 nanosecond to read from cache vs ~100 nanoseconds from RAM. When Thread 1 is running, the cache fills with its data. A context switch to Thread 2 evicts that data. When Thread 1 runs again, it reloads everything from RAM. With thousands of threads switching constantly, your CPU spends more time moving data around than actually running your application.

This is why Java servers at high concurrency felt sluggish and needed large, expensive machines.

### Node.js and the Single-Thread Workaround

Node.js went the opposite direction in 2009. One thread, never block, use callbacks for everything.

```javascript
// When the DB responds, call me back
db.getUser(id, function(err, user) {
  db.getPosts(user.id, function(err, posts) {
    res.json({ user, posts });
  });
});
```

The memory problem was solved. One thread handles everything. But CPU-intensive work blocks every other request because there is no other thread to fall back to. And the nested callback code was genuinely hard to maintain. The community eventually moved to async/await which reads better, but the single-threaded constraint never went away.

### Go's Answer: Goroutines

Go introduced goroutines — lightweight units of execution managed by the Go runtime rather than the OS.

```go
go handleRequest(request)  // spawn a goroutine
```

The difference in scale:

A goroutine starts at 2KB and grows dynamically only as needed. You can run hundreds of thousands of them on a regular server without issue.

What makes goroutines special is how the code looks:

```go
func handleRequest(userID int) {
    user, _ := db.GetUser(userID)    // reads like blocking code
    posts, _ := db.GetPosts(userID)  // simple and sequential
    sendResponse(user, posts)
}
```

No callbacks. No async/await. Just sequential code that the Go runtime turns into highly concurrent execution. When a goroutine blocks waiting for the database, Go's scheduler parks it and runs a different goroutine on that same OS thread. The thread never sits idle. When the database responds, the original goroutine picks up right where it left off.

You get readable synchronous code with the performance of async execution.

### Goroutines Running in Parallel

When you need two things done at the same time, channels let goroutines communicate safely:

```go
func fetchUserData(userID int) (*User, []*Post) {
    userCh := make(chan *User)
    postsCh := make(chan []*Post)
    go func() { user, _ := db.GetUser(userID); userCh <- user }()
    go func() { posts, _ := db.GetPosts(userID); postsCh <- posts }()
    return <-userCh, <-postsCh
}
```

Sequential execution: 100ms + 100ms = 200ms total. With goroutines: both run at the same time, 100ms total.

## GOMAXPROCS: Using Your CPU Correctly

GOMAXPROCS controls how many OS threads can execute Go code simultaneously. By default it equals your CPU core count, which is correct for most services.

```go
import "runtime"
fmt.Println(runtime.GOMAXPROCS(0)) // 0 means query, not change
```

### When to Think About Changing It

Most backend services are I/O bound, meaning the CPU spends most of its time waiting on databases, caches, and external APIs. For these services the default is almost always right. Changing GOMAXPROCS will not help you if your database query is the bottleneck.

CPU bound services are different. Cryptography, image processing, video encoding, machine learning inference — these keep the CPU constantly busy. For these workloads more threads means more parallelism, but only up to your physical core count. Beyond that you are just adding context switch overhead with zero benefit.

The simplest question to ask yourself: is my CPU utilization above 80%? If yes, you are CPU bound. If your CPU sits at 30% while your latency is high, your bottleneck is somewhere else and GOMAXPROCS is not the answer.

### How to Benchmark It

If you want data rather than intuition:

```go
func BenchmarkHandler(b *testing.B) {
    for _, procs := range []int{1, 2, 4, 8, 16} {
        runtime.GOMAXPROCS(procs)
        b.Run(fmt.Sprintf("procs-%d", procs), func(b *testing.B) {
            for i := 0; i < b.N; i++ {
                yourHandler()
            }
        })
    }
}
```

Run `go test -bench=. -benchmem` and look at ns/op across values. The lowest is your sweet spot. If the numbers are all similar, you are I/O bound and this exercise confirmed you should not change anything.

### The Container Problem

This is where most Go services in production are misconfigured and nobody notices until traffic spikes.

Go reads the host machine's CPU count at startup. When running inside a container with a CPU limit set, Go does not see that limit by default.

```
Host machine: 64 CPU cores
Container CPU limit: 2 cores
Go reads: 64 cores
GOMAXPROCS defaults to: 64
What you actually have: 2
```

Now Go creates 64 OS threads fighting for 2 cores. Constant context switching, degraded performance, confused engineers looking at dashboards.

The fix is one import:

```go
import _ "go.uber.org/automaxprocs"

func main() {
    // GOMAXPROCS is now correctly set to match your container's CPU quota
}
```

If you deploy to Kubernetes, ECS, or any containerized environment, add `automaxprocs`. It reads the Linux cgroups CPU quota and sets the right value automatically. This is not optional for production services.

## How Other Languages Compare

### Java Before and After Java 21

Java's evolution on concurrency is the most significant shift in the industry over the last few years.

Before Java 21, the options were OS threads (expensive at scale) or reactive programming:

```java
// Reactive Java — it works, but production debugging is painful
public Mono<User> getUser(Long id) {
    return database.findByIdAsync(id)
        .flatMap(user -> posts.findByUserAsync(user.getId())
            .map(posts -> { user.setPosts(posts); return user; }));
}
```

Most teams avoided reactive programming. It was too hard to debug, too hard to onboard new engineers, and too easy to introduce subtle bugs in the async chain.

Java 21 introduced Virtual Threads as a production-ready feature. The concept is almost identical to goroutines: lightweight threads managed by the JVM rather than the OS, same parking behavior on I/O, same ability to run millions of them.

```java
// Java 21 — identical code to the old OS thread model, completely different behavior
@GetMapping("/user/{id}")
public User getUser(@PathVariable Long id) {
    return database.findById(id);  // virtual thread parks here, not an OS thread
}
```

Enable it in Spring Boot with one line in your config:

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

Your existing blocking code now runs on virtual threads. No rewrites required.

Java 21 closed the gap on concurrency meaningfully. What Go still has over Java is startup time (milliseconds vs several seconds for JVM init), idle memory footprint (tens of MB vs hundreds of MB for a Spring application), and no JIT warmup period where early requests are slower than steady-state. For teams already on the JVM with years of Java libraries and infrastructure, staying is now a reasonable technical decision.

### Node.js

Node.js solved the callback readability problem with async/await but the underlying architecture never changed. It is still single threaded.

```javascript
// Modern Node.js — much more readable
async function handleRequest(id) {
    const user = await getUser(id);
    const posts = await getPosts(user.id);
    return { user, posts };
}
```

For I/O heavy workloads this is great. For CPU intensive work it still blocks everything, and worker_threads solve this only partially with significant coordination overhead. Node.js is a good fit for API gateways, real-time services, and teams that live in JavaScript.

### Python

Python carries the GIL (Global Interpreter Lock) which means only one thread executes Python bytecode at a time, regardless of how many cores you have. asyncio helped for I/O bound work:

```python
async def handle_request(id):
    user = await db.get_user(id)
    posts = await db.get_posts(id)
    return {"user": user, "posts": posts}
```

Python 3.13 introduced an experimental no-GIL mode, but it is not production-ready for most use cases yet. Python is the right choice when your backend is tightly coupled to data science or ML tooling. It is not the right choice when concurrency and throughput are primary concerns.

## Why Go Feels Different

Performance aside, there is something qualitatively different about writing concurrent Go code. Go's model is based on CSP (Communicating Sequential Processes), a formal model where independent processes communicate by passing messages rather than sharing memory.

Rob Pike put it simply: "Don't communicate by sharing memory. Share memory by communicating."

In practice, this means one goroutine owns a piece of data and others send it messages through channels. No locks to forget, no race conditions from multiple writers, no shared mutable state to reason about across the codebase. This is what makes concurrent Go code feel manageable even in large teams.

## The Bottom Line

Go's concurrency model is not accidental. Every piece of it, goroutines, the M:N scheduler, channels, was designed to solve a specific real problem that earlier languages created. The result is a system where you write simple sequential code and get concurrent performance, where a $20 server can handle tens of thousands of connections, and where the correctness of your concurrent code is something you can actually reason about.

Java 21 closed the performance gap. Node.js is still excellent for the right workloads. But for building high-concurrency backend services from scratch today, Go remains the clearest and most composable choice.
