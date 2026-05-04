import { err, ok, type Result } from '../domain/result.js'

export type ParseDateTimeError = { tag: 'invalid_format' } | { tag: 'in_past' }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^\d{1,2}:\d{2}$/

export const parseDateTime = (
  date: string,
  time: string,
  now: number = Date.now(),
): Result<number, ParseDateTimeError> => {
  if (!ISO_DATE.test(date) || !HHMM.test(time)) return err({ tag: 'invalid_format' })
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  if (hh > 23 || mm > 59) return err({ tag: 'invalid_format' })
  const isoLocal = `${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
  const ts = Date.parse(isoLocal)
  if (Number.isNaN(ts)) return err({ tag: 'invalid_format' })
  if (ts <= now) return err({ tag: 'in_past' })
  return ok(ts)
}
