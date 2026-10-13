// Enough of `cloudflare:workers` to build the lobby and the rooms in a test. The real module exists only in the runtime,
// so test/run.mjs points the import here. Nothing in the rooms reads more of the base class than `ctx` and `env`.
export class DurableObject<E = unknown> {
  constructor(protected ctx: DurableObjectState, protected env: E) {}
}
