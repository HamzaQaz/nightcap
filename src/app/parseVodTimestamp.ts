import { type Result, err, ok } from '../domain/result.js'

const MM_SS = /^(\d{1,3}):(\d{2})$/
const H_MM_SS = /^(\d{1,3}):(\d{2}):(\d{2})$/

export const parseVodTimestamp = (s: string): Result<number, { tag: 'invalid' }> => {
  const trimmed = s.trim()
  let h = 0
  let m: number
  let ss: number
  const hms = trimmed.match(H_MM_SS)
  if (hms) {
    h = Number(hms[1])
    m = Number(hms[2])
    ss = Number(hms[3])
  } else {
    const ms = trimmed.match(MM_SS)
    if (!ms) return err({ tag: 'invalid' })
    m = Number(ms[1])
    ss = Number(ms[2])
  }
  if (m > 59 || ss > 59) return err({ tag: 'invalid' })
  return ok(h * 3600 + m * 60 + ss)
}

export const formatVodTimestamp = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
