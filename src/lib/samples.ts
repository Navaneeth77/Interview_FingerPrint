/**
 * Sample *inputs* for the setup screen, so the app can be demoed without typing a resume.
 *
 * These are only a resume and a job description. Every question, score and report is still
 * generated live by Gemma 4 — there are no canned model outputs anywhere in this project.
 */

export interface SampleScenario {
  id: string;
  label: string;
  role: string;
  resume: string;
  jobDescription: string;
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'backend',
    label: 'Backend engineer',
    role: 'Backend Engineer, Platform',
    resume: `Final-year B.Tech Computer Science student, VIT Chennai (graduating 2026).

EXPERIENCE
Backend Intern, Payflow (fintech startup) — Jun 2025 to Aug 2025
- Built REST APIs in FastAPI serving ~40k requests/day for the merchant settlement service.
- Cut p95 latency from 800ms to 120ms with a composite index on (merchant_id, settled_at) and a Redis read-through cache.
- Wrote the migration that moved settlement records into a partitioned Postgres schema.

PROJECTS
CollabEdit — real-time collaborative code editor
- Next.js, WebSockets and Redis pub/sub; held 200 concurrent editors in load tests.
- Implemented operational-transform style conflict resolution for concurrent edits.
LeafDoc — plant disease classifier in PyTorch, 94% accuracy on PlantVillage, deployed to HF Spaces.

SKILLS: Python, TypeScript, React, FastAPI, PostgreSQL, Redis, Docker, AWS (EC2, S3), Git
ACHIEVEMENTS: Winner, GDG VIT Chennai hackathon 2025.`,
    jobDescription: `Backend Engineer — Platform Team

We build and run the services every product team depends on: millions of requests per day, tight latency budgets, and a hard reliability bar.

What you will do
- Design and ship backend services in Python or Go
- Own data modelling decisions across PostgreSQL and Redis
- Build event-driven pipelines on Kafka
- Join the on-call rotation and own the reliability of what you ship
- Instrument services for observability: metrics, tracing, structured logs

Requirements
- Strong fundamentals in databases, caching and concurrency
- Experience operating services in production, not only building them
- Comfort reasoning about distributed systems failure modes

Nice to have: Kubernetes, Terraform, high-throughput ingestion experience.`,
  },
  {
    id: 'product',
    label: 'Product manager',
    role: 'Associate Product Manager',
    resume: `Business Analytics graduate with two years in a consumer fintech app.

EXPERIENCE
Product Analyst, Kite Money — Aug 2024 to present
- Owned the onboarding funnel; ran 14 A/B tests, lifted activation from 31% to 42% over three quarters.
- Wrote the spec for the UPI autopay feature, shipped with two engineers and a designer in six weeks.
- Built the weekly retention dashboard in SQL and Looker used by the leadership team.

Growth Intern, Vernacular Learning — 2023
- Ran user interviews with 40 tier-2 city users; findings drove a redesign of the payment flow.

SKILLS: SQL, Amplitude, Figma, A/B testing, user research, roadmap planning
EDUCATION: BBA, Business Analytics. Case competition finalist, 2023.`,
    jobDescription: `Associate Product Manager — Payments

You will own a slice of our payments experience end to end: discovery, spec, launch and iteration.

What you will do
- Turn ambiguous problems into shipped features with clear success metrics
- Work daily with engineering and design; write specs people actually read
- Use data to decide what to build, and to admit when something did not work
- Talk to users every week and bring their language back into the team

Requirements
- Evidence of shipping products, not only analysing them
- Comfort with SQL and experiment design
- Clear written communication and the judgement to prioritise ruthlessly

Nice to have: payments or fintech background, experience with regulated products.`,
  },
];
