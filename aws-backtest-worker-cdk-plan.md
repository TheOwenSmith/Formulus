# AWS backtest pipeline (Option B) — CDK design plan

## Goal

Run **long-running backtests** (> 15 minutes, Docker/user code) with:

- **SQS** as the durable job queue (same logical role as today).
- **No always-on worker VM** — compute runs **only while jobs run**, scaled toward **zero** when idle.
- **AWS CDK** for infrastructure as code.

**Pattern:** `SQS → thin Lambda (dispatcher) → Fargate task (runner)`

(Optionally compare **AWS Batch** in §6 for heavier batch/spot savings.)

---

## High-level architecture

```text
Client → API (existing / separate stack) → Postgres
                    │
                    └── SendMessage(SQS) { submissionId }

SQS queue ──(event source mapping)──► Lambda Dispatcher
                    │
                    └── RunTask(ECS Fargate) with { submissionId, ... }
                              │
                              └── Container: current worker backtest logic
                                    │
                                    └── Postgres (read/write submission + results)
```

- **Lambda** does *not* run the backtest. It **validates the message**, applies **idempotency**, and **starts one Fargate task per message** (or batches if you redesign later).
- **Fargate task** runs the existing Node + Docker backtest workload (your `worker` image).
- **SQS visibility timeout** must exceed **worst-case backtest duration** (or use heartbeat pattern — see §5).

---

## CDK project layout (suggested)

Monorepo-friendly split:

| Stack / construct | Responsibility |
|-------------------|----------------|
| `NetworkStack` (optional) | VPC, subnets, optional NAT (cost hotspot — see §8). |
| `DataStack` (optional / existing) | RDS, secrets — may already exist. |
| `QueueStack` | SQS queue, **DLQ**, alarms. |
| `EcrStack` or inline | ECR repo for worker image. |
| `WorkerStack` | ECS cluster (Fargate), task definition, **no service** (only `RunTask`), IAM task role, log group, security groups. |
| `DispatcherStack` | Lambda function, SQS event source, IAM to `ecs:RunTask`, pass task overrides. |

Use **cross-stack references** (SSM or `export`/`import`) for queue URL, cluster name, task definition ARN, subnets, security groups.

---

## Components (detailed)

### 1. SQS

- **Main queue**: receives `{ submissionId }` (same contract as today).
- **Dead-letter queue (DLQ)**: after N receives, send poison messages for inspection.
- **Visibility timeout**: set to **≥ max expected job time** (e.g. 2–6 hours), aligned with Fargate timeout expectations. If jobs can exceed that, prefer **heartbeat / ChangeMessageVisibility** from the runner (more complex) or **Step Functions** orchestration (later).
- **Retention**: default or tuned for operational needs.

### 2. Lambda dispatcher (thin)

**Triggers:** SQS event source mapping (`batchSize: 1` recommended initially).

**Responsibilities:**

1. Parse and validate JSON body (`submissionId`).
2. **Idempotency** (recommended): before `RunTask`, check DB submission status (e.g. already `RUNNING` / `FINISHED`) *or* use a **deduplication id** in DynamoDB — prevents double `RunTask` if SQS redelivers.
3. Call `ecs:RunTask` with:
   - Cluster, task definition, **Fargate** launch type.
   - **Network configuration**: assign **public IP** *or* **private subnets + NAT** (see §8).
   - **Container overrides**: env vars `SUBMISSION_ID`, `QUEUE_URL` (if needed), `DATABASE_URL` from Secrets Manager (by reference, not in plain env in CDK output).
4. Return success so SQS deletes the message **only if** task start succeeded.

**Failure handling:**

- If `RunTask` fails → throw so Lambda retries and message returns after visibility timeout (or configure partial batch response if batching > 1).
- Align with DLQ maxReceiveCount.

**Runtime / size:** small memory, short timeout (e.g. 30–60 s) — only API calls.

### 3. ECS Fargate (runner)

- **Cluster:** Fargate-only; **no always-on service** (`desiredCount: 0` is implicit when you only `RunTask`).
- **Task definition:**
  - **CPU / memory** sized for Docker + backtest peak (start conservative, tune from metrics).
  - **Image:** ECR — build/push worker Dockerfile in CI.
  - **Logging:** `awslogs` driver → CloudWatch log group.
  - **Task role (IAM):** permissions needed by the app (e.g. read secrets, optional S3 for market data later). **No** overly broad `*` policies.
  - **Execution role:** pull from ECR, write logs.

**Entry point change (application, not CDK):** replace infinite `while(true) { ReceiveMessage }` loop with **“run single `submissionId` from env then exit”** so each Fargate task is one job. CDK/IaC only *starts* tasks; the **task lifecycle** is the billing unit.

### 3.5 Market data (tick files)

Your backtests read historical market data (tick/bar files). In cloud, you need a storage option that every Fargate task can access.

If you do **not care about partitioning**, you have two straightforward choices:

- **Option A: S3 as the source of truth (simplest infrastructure)**
  - Store large files in S3 (for example, one file per ticker/timeframe, even if it contains 10 years).
  - Each Fargate task downloads or streams the files it needs and filters to the requested time window in-process (for example, 3 years out of 10).
  - **Tradeoff**: tasks may repeatedly read large objects, which can increase runtime and S3 data transfer cost.
  - CDK/IAM: grant the task role `s3:GetObject` (and possibly `s3:ListBucket` for a fixed prefix).
  - Networking: prefer an **S3 VPC gateway endpoint** to avoid NAT data charges if tasks run in private subnets.

- **Option B: EFS mounted into Fargate tasks (avoids repeated downloads)**
  - Put the dataset onto EFS once and mount it into each backtest task (read-only is typical).
  - Fargate tasks read files like local disk and filter to the time window in-process.
  - **Tradeoff**: EFS has ongoing cost and requires VPC mount targets, but can be cheaper than repeatedly downloading big S3 objects when backtests are frequent.
  - CDK/IAM: add an EFS file system, access point, and mount in the task definition.

Notes:

- Start with **S3** for v1 unless repeated downloads become a bottleneck. Add **EFS** if cost or performance demands it.
- You can still avoid downloading "everything" even without partitioning if you store multiple large files (for example by ticker). True single-monolith datasets force over-fetching.

### 4. API (existing)

- Continues to `SendMessage` to the queue URL from config/secrets.
- IAM: API compute needs `sqs:SendMessage` on the queue (if Lambda monolith, attach policy to that role).

### 5. SQS + long jobs — operational note

Today’s worker uses long polling and **deletes the message after processing**. With **Lambda + SQS**:

- Lambda invocation typically **deletes the message when the handler succeeds**.
- If you **delete on dispatch** (task started), a **crash of the Fargate task** means **no automatic retry** unless you build it (e.g. reconciliation job, or Step Functions).

**Recommended pattern for reliability:**

- **Option 5a (simpler):** Lambda starts task; on success, complete SQS delete. Accept that rare task crashes need **manual re-drive** or a **periodic sweeper** (find `RUNNING` stuck > T, re-enqueue).
- **Option 5b (stronger):** **Step Functions** state machine: start task → wait for completion (ECS integration) → update DB / delete message. More cost and CDK complexity, fewer lost jobs.

Document which you choose in implementation notes.

### 6. AWS Batch (alternative / hybrid)

Use **Batch + Spot** if:

- You want **cheapest** CPU for long jobs and can tolerate **interruptions** (checkpointing / retry).
- Many parallel backtests.

Tradeoff: more moving parts (compute environment, job queues, AMI/container). **Fargate** is often simpler for “one Docker image, same as local worker.”

---

## Security

- **Secrets:** `DATABASE_URL`, API keys in **Secrets Manager** or **SSM Parameter Store** (SecureString); mount or fetch at runtime; **never** commit to CDK context for prod.
- **Network:** RDS in private subnets → Fargate tasks in **same VPC**, security group allows **5432** (or proxy port) from task SG only.
- **Least privilege:** separate IAM roles for dispatcher Lambda vs task vs API.

---

## Observability

- **CloudWatch:** Lambda logs, ECS task logs, metric filters.
- **Alarms:** DLQ depth > 0, Lambda errors, ECS task failures.
- **Tracing (optional):** X-Ray on Lambda + downstream.

---

## Cost notes (why this stays “pay per use”)

| Resource | Idle cost |
|----------|-----------|
| SQS | Very low fixed per request + storage. |
| Lambda dispatcher | $0 when no messages. |
| Fargate tasks | **$0** when **no tasks running** (no ECS service with desired > 0). |
| NAT Gateway | **Often significant fixed monthly cost** if tasks need outbound internet in private subnets — budget explicitly (see §8). |
| RDS | Usually **always-on** unless you use Aurora Serverless v2 pause / dev schedules — separate from worker design. |
| Market data storage | S3 is cheap per GB-month; EFS is also managed storage with ongoing cost but can reduce per-run download/transfer costs. |

---

## §8. VPC / NAT (critical cost decision)

Fargate tasks that need **outbound internet** (Docker pulls, external APIs) from **private subnets** typically need **NAT Gateway** (~fixed cost per AZ).

Mitigations:

- **Public subnet + public IP** for worker tasks only (smaller blast radius; lock down SG; no NAT for this path) — common for cost-sensitive dev/staging.
- **VPC endpoints** for ECR, S3, CloudWatch Logs, Secrets Manager to reduce NAT traffic (doesn’t remove NAT if you still need generic internet).
- **Pull image once** per task start — minimize registry chatter.

Record the chosen pattern in this doc when you decide.

---

## Migration checklist (application)

1. Worker binary: **single-job mode** — read `submissionId` from env, run `processSubmission`, exit `0`/`1`.
2. Docker image: production Dockerfile; push to ECR in CI.
3. Env vars / config: queue URL may no longer be needed for **receive** in Fargate (unless you use visibility heartbeat).
4. DB connection pooling: short-lived tasks — tune Prisma pool size to avoid exhausting RDS connections under burst.
5. Load testing: concurrent `RunTask` vs RDS max connections.

---

## CDK implementation order

1. VPC/subnets/SG (or reference existing).
2. ECR + build pipeline (GitHub Actions / CodeBuild).
3. ECS cluster + task definition + IAM + logs.
4. SQS + DLQ.
5. Lambda dispatcher + `RunTask` + event source mapping.
6. Wire API `QUEUE_URL` + IAM `SendMessage`.
7. Alarms + runbook for DLQ.

---

## Open decisions (fill in before build)

1. **RDS:** New vs existing? Same VPC as Fargate?
2. **Outbound internet:** Public IP for tasks vs NAT?
3. **Reliability:** Delete SQS message on `RunTask` success only vs Step Functions?
4. **Peak concurrency:** Max concurrent Fargate tasks (RDS connection limit, Docker on host constraints).

---

## References (internal)

- Current enqueue: `web-app/api/src/routes/backtesting.ts` (`SendMessageCommand`).
- Current consumer loop: `web-app/worker/src/index.ts` (replace with single-shot runner for Fargate).
