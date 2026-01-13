export class RateLimiter {
  constructor(private readonly maxConcurrent: number) {}
  private active = 0
  private queue: (() => void)[] = []

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve))
    }
    this.active++
    try {
      const res = await fn()
      return res
    } finally {
      this.active--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, tries = 3, baseMs = 500): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (err) {
      lastErr = err
      const delay = baseMs * Math.pow(2, i)
      await new Promise(res => setTimeout(res, delay))
    }
  }
  throw lastErr
}
