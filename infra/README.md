# PhoenixTrader infra (AWS CDK)

This package provisions the backtest job pipeline described in `../aws-backtest-worker-cdk-plan.md`.

## Important implementation note: Docker-in-worker

The current worker uses `dockerode` to run sandbox containers for user code. That requires a **Docker daemon**.

- **ECS Fargate does not provide a Docker daemon/socket** to tasks.
- Therefore this CDK scaffolding provisions an **ECS EC2** cluster by default (ECS-optimized AMI).

If you later redesign sandbox execution to not require dockerode (or use a different isolation strategy), you can swap the compute stack to Fargate.

## Deploy

From `infra/`:

```bash
pnpm install
pnpm run build
pnpm run deploy
```

## Configuration

This is intentionally parameterized. You will need to wire in:

- Database connectivity (VPC/subnets/security groups, secrets for `DATABASE_URL`)
- Worker env vars (AWS region, etc.)
- Worker image publishing (ECR tag strategy, per-environment)

See the GitHub Actions workflow for the intended CI/CD flow.

