---
title: "Stop Approving Code You Didn't Read (Part 1): The 8 Lenses That Catch What Linters Can't"
description: "A risk framework and 8 design lenses for effective code review, covering modularity, reusability, readability, extendability, and SOLID principles."
pubDate: 2026-03-27
draft: false
---

*Part 1 is about what you look at*

As an engineering manager now, I see many developers being a terrible code reviewer. Engineers scan for typos, argue about formatting, approve PRs they barely read, and then wonder why production breaks every other sprint. Managers drop a thumbs up emoji and call it "leadership."

The engineers who actually move the needle do something completely different. They read code the way a cardiologist reads an ECG. Not looking for the obvious stuff, but listening for patterns that predict failure before it shows up.

This is a two-part series where I'm putting down everything I've learned about doing code review well. Not through vague platitudes, but through real code, concrete frameworks, and the mental models I've picked up over the years. In this first part, I'll cover the risk framework I use and the 8 design lenses I apply to every PR. In Part 2, I'll get into the battle-tested secrets, the actual review process, and the human side that nobody talks about but honestly matters just as much.

Whether you're an IC trying to level up or an EM trying to shape your team's culture, I think there's something here for you.

## The Mental Model I Use: Layers of Risk

Before I read a single line of code in a PR, I mentally map the change against four layers of risk:

**Layer 1: Correctness.** Does this code actually do what it claims to do? This is where most reviewers start and stop. Google's engineering practices talk about this as "functionality" and they're right that you should be thinking about edge cases, concurrency problems, and trying to think like a user. But correctness alone is not enough.

**Layer 2: Safety.** Could this change harm users, data, or systems? Think SQL injection, data leaks, missing auth checks. These bugs rarely look dangerous in a diff. They look like convenience.

**Layer 3: Scalability.** Does this survive 10x traffic or 10x data? The code might work beautifully with 100 users and completely fall apart at 100,000.

**Layer 4: Sustainability.** Can the next engineer who touches this code understand it and change it without breaking everything? Google puts it well when they say "too complex" usually means "can't be understood quickly by code readers" or "developers are likely to introduce bugs when they try to call or modify this code."

Most engineers only check Layer 1. The best reviewers I've worked with check all four, in that order, and weight their feedback accordingly. A naming issue is Layer 4. A SQL injection is Layer 2. Both deserve attention, but not equal urgency. Getting this hierarchy right is honestly half the battle.

## The 8 Lenses I Review Every PR Through

Over the years I've developed a set of lenses that I apply to every PR. Think of them as different X-ray frequencies. Each one reveals a different kind of structural problem that's invisible to the others. None of them are about syntax or formatting. We have linters for that.

### Lens 1: Modularity — Is This Doing Too Much?

The first question I ask myself: how many reasons does this class or function have to change? Every "and" in your mental description of what it does is a warning signal. Here's a pattern I see constantly:

```typescript
// This function has 5 reasons to change
async function processOrder(userId: string, items: CartItem[]) {
  const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
  let total = 0;
  for (const item of items) {
    const product = await db.query(`SELECT * FROM products WHERE id = '${item.productId}'`);
    total += product.price * item.quantity;
  }
  const charge = await stripe.charge({ amount: total, customer: user.stripeId });
  await db.query(`INSERT INTO orders (user_id, total) VALUES ('${userId}', '${total}')`);
  await sendEmail(user.email, 'Order confirmed', `Your total: $${total}`);
}
```

This function fetches users, calculates pricing, processes payment, persists state, and sends notifications. Five different teams could legitimately demand changes to this single function. That's five reasons to change and a textbook modularity failure.

What I want to see instead:

```typescript
class OrderService {
  constructor(
    private userService: UserService,
    private pricingService: PricingService,
    private paymentService: PaymentService,
    private orderRepository: OrderRepository,
    private notificationService: NotificationService
  ) {}

  async placeOrder(userId: string, items: CartItem[]): Promise<OrderResult> {
    const user = await this.userService.getById(userId);
    const total = await this.pricingService.calculate(items);
    await this.paymentService.charge(user, total);
    await this.orderRepository.save(userId, total);
    await this.notificationService.sendOrderConfirmation(user, total);
    return { success: true, total };
  }
}
```

OrderService is now a pure orchestrator. Each line delegates to a specialist. It only changes when the orchestration logic itself changes, not when the email template changes or the payment provider switches.

One quick heuristic that's saved me a lot of time: count the imports at the top of a file. A file importing from 8 different subsystems is almost always doing too much. This catches about 80% of modularity problems before you even read a single function.

### Lens 2: Reusability — What's Hardcoded That Shouldn't Be?

Hardcoding is probably the most common form of technical debt, and it hides in plain sight because it looks so clean.

```typescript
function applyCoupon(total: number, code: string): number {
  if (code === 'SAVE10') return total * 0.9;
  if (code === 'SAVE20') return total * 0.8;
  if (code === 'BLACKFRIDAY') return total * 0.5;
  return total;
}
```

Looks innocent enough right? But every new coupon is a code change, a PR, a review cycle, a deployment. Marketing can't move at their speed because they're blocked on engineering for something that should be a config change. This looks like a small thing. At scale, it becomes a bottleneck that blocks an entire business function.

```typescript
interface Coupon {
  code: string;
  discount: number;
  expiresAt: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

async function applyCoupon(total: number, code: string): Promise<number> {
  const coupon = await couponRepo.findByCode(code);
  if (!coupon) throw new Error('Invalid coupon');
  if (!coupon.isActive) throw new Error('Coupon inactive');
  if (coupon.expiresAt < new Date()) throw new Error('Coupon expired');
  if (coupon.usedCount >= coupon.usageLimit) throw new Error('Coupon exhausted');
  await couponRepo.incrementUsage(code);
  return total * (1 - coupon.discount);
}
```

Now adding SUMMER15 means inserting one database row. Zero code changes. Zero deployments. Marketing ships at their own speed.

The question I ask about every hardcoded value: "Who would need to change this, and do they have access to the codebase?" If the answer is a non-engineer, it belongs in a database or config system, not in code.

### Lens 3: Readability — Can the Next Engineer Navigate This in 60 Seconds?

Readability isn't about pretty formatting. Its about cognitive load. How much working memory does a reader need to hold simultaneously to understand what the code is doing?

Google's engineering practices make a really good point here that I want to highlight: comments should explain WHY code exists, not WHAT the code is doing. If you need comments to explain what code does, the code should be made simpler. The exceptions are things like regex patterns and complex algorithms where a "what" comment genuinely helps.

But the naming matters even more than comments. Look at this:

```go
func p(u *User, o []Order) float64 {
    var t float64
    for _, x := range o {
        if x.S == 1 {
            t += x.A
        }
    }
    if u.T == "p" {
        t *= 0.9
    }
    return t
}
```

To understand this function, you need to simultaneously decode what `p`, `S`, `A`, `T`, and `"p"` all mean while tracking the loop logic. That's five unknowns you're holding in your head at once. Now imagine its 2am and production is down and you're trying to figure out why this function is returning wrong numbers.

```go
func calculateTotalForPremiumUser(user *User, orders []Order) float64 {
    var subtotal float64
    for _, order := range orders {
        if order.Status == OrderStatusCompleted {
            subtotal += order.Amount
        }
    }
    if user.Type == UserTypePremium {
        const premiumDiscount = 0.10
        subtotal *= (1 - premiumDiscount)
    }
    return subtotal
}
```

Same logic. Zero ambiguity. The oncall engineer at 2am will thank you.

Here's the real test of readability, and I use this a lot when coaching my team: the test isn't whether YOU understand it. You wrote it, you have the full context. The test is whether someone who just joined the team can understand it during an incident at 2am when production is on fire. Does this code tell them where to look?

### Lens 4: Extendability — What Breaks When Requirements Change?

Good code bends. Brittle code breaks. This lens asks one simple question: what happens when the product manager walks in on Monday with a new requirement?

```typescript
async function notifyUser(user: User, message: string) {
  await sendEmail(user.email, 'Notification', message);
  // PM: "Also add SMS" -> now you modify this function
  // PM: "Also add push" -> now you modify it again
  // PM: "Also add WhatsApp" -> this function is a time bomb
}
```

Every new channel means touching tested code. Every touch means risk. Compare that with the Strategy Pattern approach:

```typescript
interface NotificationChannel {
  send(user: User, message: NotificationMessage): Promise<void>;
}

class EmailChannel implements NotificationChannel {
  async send(user: User, msg: NotificationMessage): Promise<void> {
    await emailClient.send(user.email, msg.subject, msg.body);
  }
}

class SmsChannel implements NotificationChannel {
  async send(user: User, msg: NotificationMessage): Promise<void> {
    await smsClient.send(user.phone, msg.body);
  }
}

class WhatsAppChannel implements NotificationChannel {
  async send(user: User, msg: NotificationMessage): Promise<void> {
    await whatsappClient.send(user.phone, msg.body);
  }
}

class NotificationService {
  constructor(private channels: NotificationChannel[]) {}

  async notify(user: User, message: NotificationMessage): Promise<void> {
    const results = await Promise.allSettled(
      this.channels.map(ch => ch.send(user, message))
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.error('notification.failed', {
          channel: this.channels[i].constructor.name,
          error: result.reason
        });
      }
    });
  }
}

const notificationService = new NotificationService([
  new EmailChannel(),
  new SmsChannel(),
  new WhatsAppChannel(),
]);
```

Adding a new channel now means creating one new class and adding one line to the wiring. Zero changes to existing code. Zero risk to existing functionality. And one channel failing doesn't block the others thanks to `Promise.allSettled`.

Now I want to add a nuance here that Google's eng practices articulate really well. There's a fine line between extendability and over-engineering. You should encourage developers to solve the problem they KNOW needs to be solved now, not the problem they speculate might need to be solved in the future. The notification example above is a good case for the pattern because notification channels are a known, predictable axis of change. But don't build a plugin architecture for something that's only ever going to have one implementation. Solve the future problem when the future arrives and you can see its actual shape.

Extendability violations always look cheap to write and expensive to fix. The question isn't "does this work today?" Its "does the design make the next requirement cheap or expensive?"

### Lens 5: Inheritance vs Composition — Are You Building a Trap?

Inheritance is one of the most misused tools in object-oriented programming. Deep inheritance hierarchies look elegant when you build them and become completely unmaintainable six months later.

```typescript
class Animal {
  move() { console.log('Moving'); }
  breathe() { console.log('Breathing'); }
}
class Bird extends Animal {
  fly() { console.log('Flying'); }
}
class Duck extends Bird {
  quack() { console.log('Quack'); }
}
// Now add a Penguin. It's a Bird. But it can't fly.
// Your hierarchy is broken.
class Penguin extends Bird {
  fly() { throw new Error("Penguins can't fly!"); } // Liskov violation
}
```

The moment you throw an exception to undo something a parent class promises, your inheritance hierarchy is lying to its consumers. This is a Liskov Substitution violation and it leads to runtime crashes in places where code rightfully assumes a Bird can fly.

```typescript
interface Swimmer { swim(): void; }
interface Flyer { fly(): void; }
interface Speaker { speak(): void; }

const canSwim = (): Swimmer => ({ swim: () => console.log('Swimming') });
const canFly = (): Flyer => ({ fly: () => console.log('Flying') });
const canQuack = (): Speaker => ({ speak: () => console.log('Quack') });
const canSquawk = (): Speaker => ({ speak: () => console.log('Squawk') });

// Duck = swim + fly + quack
const duck = { ...canSwim(), ...canFly(), ...canQuack() };
// Penguin = swim + squawk (no fly - and that's fine)
const penguin = { ...canSwim(), ...canSquawk() };
```

The rule of thumb I use: favour composition over inheritance when the relationship is "has-a" or "can-do" rather than "is-a". A Duck is an Animal, inheritance makes sense there. A UserService has email-sending capability, that's composition.

More than two levels of inheritance in application code (not framework code) is almost always a design smell. When you see deep hierarchies in review, ask yourself: could these be independent capabilities composed together? The answer is usually yes.

### Lens 6: Dependency Injection — Are Dependencies Hardcoded?

This is where the gap between junior and senior thinking is most visible to me. Hardcoded dependencies make code untestable, inflexible, and tightly coupled to infrastructure.

```typescript
class OrderService {
  private db = new PostgresDatabase();
  private mailer = new SendGridMailer();
  private stripe = new StripePaymentGateway();

  async placeOrder(userId: string, items: Item[]) {
    // Can't test this without a real DB, real Stripe, real SendGrid
  }
}
```

You literally cannot write a unit test for this class without spinning up actual infrastructure. That's not a testing problem. That's a design problem.

```typescript
interface Database { query<T>(sql: string, params: unknown[]): Promise<T>; }
interface Mailer { send(to: string, subject: string, body: string): Promise<void>; }
interface PaymentGateway { charge(customerId: string, amount: number): Promise<Charge>; }

class OrderService {
  constructor(
    private db: Database,
    private mailer: Mailer,
    private payment: PaymentGateway
  ) {}

  async placeOrder(userId: string, items: Item[]) {
    // Now fully testable with mocks
  }
}

// Production
const service = new OrderService(
  new PostgresDatabase(config.db),
  new SendGridMailer(config.sendgrid),
  new StripePaymentGateway(config.stripe)
);

// Tests
const service = new OrderService(
  new InMemoryDatabase(),
  new FakeMailer(),
  new MockPaymentGateway({ shouldSucceed: true })
);
```

If a class constructs its own dependencies with `new` inside the constructor or method body, it's doing two jobs simultaneously: building its collaborators and using them. That's a Single Responsibility violation hiding inside a Dependency Inversion violation. The smell is `new` inside a non-factory class. Once you start spotting it, you see it everywhere.

### Lens 7: Data Structures — Is the Right Tool Being Used?

Wrong data structures don't crash your application. They silently degrade it at scale. And the code looks perfectly fine until you hit real production volumes.

```typescript
async function getOrdersWithProducts(orders: Order[]): Promise<EnrichedOrder[]> {
  const enriched: EnrichedOrder[] = [];
  for (const order of orders) {
    const product = await db.query(
      'SELECT * FROM products WHERE id = $1', [order.productId]
    );
    enriched.push({ ...order, product });
  }
  return enriched;
}
```

With 1,000 orders this fires 1,001 database queries. With 10,000 it fires 10,001. This is the N+1 problem and it's one of the most common performance killers in production systems.

```typescript
async function getOrdersWithProducts(orders: Order[]): Promise<EnrichedOrder[]> {
  const productIds = orders.map(o => o.productId);
  const products = await db.query(
    'SELECT * FROM products WHERE id = ANY($1)', [productIds]
  );
  const productMap = new Map(products.map(p => [p.id, p]));
  return orders.map(order => ({
    ...order,
    product: productMap.get(order.productId)
  }));
}
```

One query regardless of order count, O(1) lookup via Map. The same pattern applies in Go:

```go
// Bad — O(n) lookup per product
func enrichOrders(orders []Order, products []Product) []EnrichedOrder {
    enriched := make([]EnrichedOrder, 0, len(orders))
    for _, order := range orders {
        for _, product := range products {
            if product.ID == order.ProductID {
                enriched = append(enriched, EnrichedOrder{Order: order, Product: product})
                break
            }
        }
    }
    return enriched
}

// Good - O(1) lookup via map
func enrichOrders(orders []Order, products []Product) []EnrichedOrder {
    productMap := make(map[string]Product, len(products))
    for _, p := range products {
        productMap[p.ID] = p
    }
    enriched := make([]EnrichedOrder, 0, len(orders))
    for _, order := range orders {
        enriched = append(enriched, EnrichedOrder{
            Order:   order,
            Product: productMap[order.ProductID],
        })
    }
    return enriched
}
```

Here's a quick mental cheat sheet I keep in my head when reviewing:

- Need a lookup by key? Use a Map or HashMap, never an array with `.find()`.
- Need uniqueness? Use a Set, not an array with `.includes()`.
- Need to count frequencies? Use `Map<K, number>`, not nested loops.
- Need ordered processing? Use a Queue or channel, not array shift.

The hidden pattern: every `.find()`, `.filter()`, or `.includes()` inside a loop is a candidate for replacement with a Map or Set. The code looks identical at small scale. The difference only surfaces in production with real data volumes.

### Lens 8: Design Principles — Which SOLID Rule Is Being Broken?

SOLID violations are the root cause behind most code that's painful to change. I've found it helpful to map each principle to the specific production pain it causes:

- **Single Responsibility** violations show up as merge conflicts every sprint because everyone is touching the same god class.
- **Open/Closed** violations show up as every new feature breaking existing ones because you keep adding branches to a growing switch statement.
- **Liskov Substitution** violations cause runtime crashes on polymorphic calls.
- **Interface Segregation** violations force implementations of unused methods.
- **Dependency Inversion** violations mean you can't test without infrastructure.

The most violated principle that nobody talks about is Liskov Substitution. The classic example:

```typescript
class Rectangle {
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) { this.width = this.height = w; }
  setHeight(h: number) { this.width = this.height = h; }
}

function doubleWidth(shape: Rectangle) {
  const originalHeight = shape.area() / shape.getWidth();
  shape.setWidth(shape.getWidth() * 2);
  // With Rectangle: area doubles. With Square: area quadruples. Silent bug.
}
```

The fix is to not force inheritance where it breaks contracts:

```typescript
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area() { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area() { return this.side * this.side; }
}
```

No broken promises. No silent bugs.

---

That's the framework. Eight lenses that, when applied consistently, catch the vast majority of design and structural issues before they become production problems.

But design review is only half the story. In Part 2, I'll cover the battle-tested secrets that catch the bugs design review misses: security patterns, concurrency traps, performance regressions hiding in abstractions, the actual step-by-step process I follow when reviewing a PR, and the human side of code review that honestly matters just as much as the technical side.

If you found this useful, follow along for Part 2. And if you disagree with anything here, I genuinely want to hear it. Some of the best refinements to my thinking have come from people who told me I was wrong.
