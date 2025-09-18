declare module 'bun:sqlite' {
  export interface Statement<Params extends any[] = any[], Result = any> {
    run(...params: Params): Result
    all(...params: Params): Result[]
    get(...params: Params): Result | undefined
    finalize(): void
  }

  export class Database {
    constructor(filename: string)
    exec(sql: string): void
    prepare<Params extends any[] = any[], Result = any>(
      sql: string
    ): Statement<Params, Result>
    query<T = unknown>(
      sql: string
    ): {
      all(...params: unknown[]): T[]
      get(...params: unknown[]): T | undefined
    }
    close(): void
  }
}
