# Design note: long-running document processing

**Asynchronous flow.** `POST /estimates` would validate, save the estimate as `queued` and return `202 Accepted` with its id. A worker runs the stages; today's three stages already map to three job steps. I would start with an in-process queue and move to a database-backed or Redis queue when running several instances.

**Persisted state.** Each stage's status and raw result are written when it finishes (`pending`, `running`, then `completed` or `failed`). The database is the source of truth, so a crash loses nothing and `GET /estimates/{id}` always shows real progress.

**Progress to the browser.** Start with polling `GET /estimates/{id}`; add Server-Sent Events later to push stage changes. *Trade-off:* polling is simple, stateless and proxy-friendly but costs extra requests and updates late; SSE feels live but needs long-lived connections, reconnect handling and more infrastructure.

**Cancellation.** `POST /estimates/{id}/cancel` sets a flag the worker checks between stages, and an `AbortSignal` is passed to the provider call. Finished results are kept and the status becomes `cancelled`. *Trade-off:* checking only between stages is simple but slow to react during a long scan; aborting mid-call reacts fast but needs provider support and cleanup of partial results.

**Recovery.** Stages are idempotent, keyed by (estimate id, stage), so retries never duplicate results. Transient provider errors get a few automatic retries with backoff; then the job is marked `failed` at that stage. `POST /estimates/{id}/retry` resumes from the first unfinished stage, reusing saved results instead of paying for earlier scans again. On startup, jobs left `running` are re-queued.
