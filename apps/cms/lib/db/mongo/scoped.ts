import type {
  ClientSession,
  Collection,
  CountDocumentsOptions,
  Document,
  Filter,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
} from 'mongodb'

/**
 * THE WORKSPACE FENCE — MongoDB's stand-in for Postgres row-level security.
 *
 * MongoDB cannot hide rows from a query by itself, so client content is never
 * reached through a raw collection. Scope code (./index.ts, `scope()`) only gets
 * these wrappers, each bound to one workspace and one transaction:
 *
 * - every filter is ANDed with `{ workspaceId: <this workspace> }`, overriding any
 *   workspaceId the caller put in it — a query cannot be pointed elsewhere, and a
 *   query that "forgot" its filter still sees only this workspace;
 * - every inserted document is stamped with this workspace;
 * - an update that tries to change `workspaceId` is refused;
 * - in a write scope every call joins the transaction (`session`), and calls run
 *   one at a time, as a MongoDB transaction requires;
 * - in a read scope (no session) calls may run in parallel, and every write
 *   method refuses.
 *
 * A test watches every command the driver sends and fails if any content command
 * lacks the workspace filter (tests/unit/mongo-fence.test.ts).
 */

export type Fenced = { _id: string; workspaceId: string }

/** Runs operations one after another: a transaction's session is not concurrent-safe. */
export class Queue {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(op: () => Promise<T>): Promise<T> {
    const next = this.tail.then(op, op)
    this.tail = next.catch(() => undefined)
    return next
  }
}

function touchesWorkspace(update: UpdateFilter<Document>): boolean {
  for (const [op, fields] of Object.entries(update)) {
    if (!op.startsWith('$')) return true // a replacement document
    if (fields && typeof fields === 'object' && 'workspaceId' in fields) return true
  }
  return false
}

export class FencedCollection<T extends Fenced> {
  /**
   * @param session the transaction to join, or null for a read-only scope
   * @param queue serialises calls within a transaction; null runs them as they come
   */
  constructor(
    private readonly collection: Collection<T>,
    private readonly workspaceId: string,
    private readonly session: ClientSession | null,
    private readonly queue: Queue | null
  ) {}

  private run<R>(op: () => Promise<R>): Promise<R> {
    return this.queue ? this.queue.run(op) : op()
  }

  private get opts() {
    return this.session ? { session: this.session } : {}
  }

  private writable() {
    if (!this.session) throw new Error('This workspace scope is read-only.')
  }

  private where(filter: Filter<T> = {}): Filter<T> {
    return { ...filter, workspaceId: this.workspaceId } as Filter<T>
  }

  private guard(update: UpdateFilter<T>): UpdateFilter<T> {
    if (touchesWorkspace(update as UpdateFilter<Document>)) throw new Error('A record cannot be moved to another workspace.')
    return update
  }

  find(filter: Filter<T>, options: Omit<FindOptions, 'session'> = {}): Promise<T[]> {
    return this.run(() => this.collection.find(this.where(filter), { ...options, ...this.opts }).toArray() as Promise<T[]>)
  }

  findOne(filter: Filter<T>, options: Omit<FindOptions, 'session'> = {}): Promise<T | null> {
    return this.run(() => this.collection.findOne(this.where(filter), { ...options, ...this.opts }) as Promise<T | null>)
  }

  count(filter: Filter<T> = {}, options: Omit<CountDocumentsOptions, 'session'> = {}): Promise<number> {
    return this.run(() => this.collection.countDocuments(this.where(filter), { ...options, ...this.opts }))
  }

  distinct(field: string, filter: Filter<T> = {}): Promise<unknown[]> {
    return this.run(() => this.collection.distinct(field as never, this.where(filter), this.opts))
  }

  /** An aggregation whose first stage is the workspace filter; later stages cannot widen it. */
  aggregate<R extends Document>(pipeline: Document[]): Promise<R[]> {
    if (/"\$(lookup|graphLookup|unionWith|out|merge)"/.test(JSON.stringify(pipeline))) {
      throw new Error('Fenced aggregations cannot read or write other collections.')
    }
    return this.run(() => this.collection.aggregate<R>([{ $match: { workspaceId: this.workspaceId } }, ...pipeline], this.opts).toArray())
  }

  async insertOne(doc: Omit<T, 'workspaceId'>): Promise<T> {
    this.writable()
    const stamped = { ...doc, workspaceId: this.workspaceId } as T
    await this.run(() => this.collection.insertOne(stamped as OptionalUnlessRequiredId<T>, this.opts))
    return stamped
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>): Promise<number> {
    this.writable()
    const guarded = this.guard(update)
    const r = await this.run(() => this.collection.updateOne(this.where(filter), guarded, this.opts))
    return r.matchedCount
  }

  async updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<number> {
    this.writable()
    const guarded = this.guard(update)
    const r = await this.run(() => this.collection.updateMany(this.where(filter), guarded, this.opts))
    return r.matchedCount
  }

  async deleteOne(filter: Filter<T>): Promise<number> {
    this.writable()
    const r = await this.run(() => this.collection.deleteOne(this.where(filter), this.opts))
    return r.deletedCount
  }

  async deleteMany(filter: Filter<T>): Promise<number> {
    this.writable()
    const r = await this.run(() => this.collection.deleteMany(this.where(filter), this.opts))
    return r.deletedCount
  }
}
