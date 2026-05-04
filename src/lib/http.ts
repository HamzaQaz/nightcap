export type FetchOpts = {
  method?: string
  headers: Record<string, string>
  body?: string
  maxRetries?: number
  baseDelayMs?: number
  timeoutMs?: number
}

export type JsonResponse = {
  status: number
  json: unknown
  rawText: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const fetchJson = async (url: string, opts: FetchOpts): Promise<JsonResponse> => {
  const max = opts.maxRetries ?? 3
  const base = opts.baseDelayMs ?? 500
  const timeout = opts.timeoutMs ?? 10_000

  let lastResp: Response | null = null
  for (let attempt = 0; attempt <= max; attempt++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeout)
    try {
      const fetchOpts: RequestInit = {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        signal: ctl.signal,
      }
      if (opts.body !== undefined) {
        fetchOpts.body = opts.body
      }
      const resp = await fetch(url, fetchOpts)
      lastResp = resp
      if (resp.status !== 429 && resp.status < 500) {
        const text = await resp.text()
        return { status: resp.status, json: text ? safeJson(text) : null, rawText: text }
      }
    } catch (e) {
      if (attempt === max) throw e
    } finally {
      clearTimeout(timer)
    }
    if (attempt < max) await sleep(base * 2 ** attempt)
  }
  const text = lastResp ? await lastResp.text() : ''
  return { status: lastResp?.status ?? 0, json: text ? safeJson(text) : null, rawText: text }
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
