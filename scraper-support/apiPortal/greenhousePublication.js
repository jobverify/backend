// first_published describes the native public post, not the first-ever
// requisition opening. Edits, creation, and observation clocks stay separate.
export const isGreenhousePublicationProvider = (provider, config) => {
  if (provider.template === 'greenhouse') return true
  try {
    const url = new URL(config.discovery.listingApiUrl)
    return url.protocol === 'https:'
      && url.hostname === 'boards-api.greenhouse.io'
      && !url.port && !url.username && !url.password && !url.hash
      && /^\/v1\/boards\/[a-zA-Z0-9_-]+\/jobs$/.test(url.pathname)
  } catch {
    return false
  }
}

const parseNativeInstant = (value) => {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d, h, minute, second, fraction = '', zone] = match
  const year = Number(y), month = Number(m), day = Number(d)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || Number(h) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  const offsetHour = /^[Zz]$/.test(zone) ? 0 : Number(zone.slice(1, 3))
  const offsetMinute = /^[Zz]$/.test(zone) ? 0 : Number(zone.slice(4, 6))
  if (offsetHour > 23 || offsetMinute > 59) return null
  const offsetSeconds = (offsetHour * 60 + offsetMinute) * 60 * (zone[0] === '-' ? -1 : 1)
  // setUTCFullYear avoids Date.UTC's special interpretation of years 00..99.
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(Number(h), Number(minute), Number(second), 0)
  return { seconds: date.getTime() / 1000 - offsetSeconds, fraction }
}

const earlierThan = (left, right) => {
  if (left.seconds !== right.seconds) return left.seconds < right.seconds
  const precision = Math.max(left.fraction.length, right.fraction.length)
  return left.fraction.padEnd(precision, '0') < right.fraction.padEnd(precision, '0')
}

const candidate = (payload, source, observation) => {
  const observed = observation === 'observed'
  const present = observed && Object.hasOwn(payload, 'first_published')
  const value = present ? payload.first_published : null
  const instant = observed ? parseNativeInstant(value) : null
  return {
    evidence: {
      source,
      observation,
      present,
      value,
      status: !observed ? 'not-observed' : instant ? 'valid'
        : value == null || value === '' ? 'missing' : 'invalid',
      updated_at: observed ? payload.updated_at ?? null : null,
      created_at: observed ? payload.created_at ?? null : null,
    },
    instant,
  }
}

export const resolveGreenhousePublication = (listing, detail, detailObservation) => {
  const candidates = [
    candidate(listing, 'listing', 'observed'),
    candidate(detail, 'detail', detailObservation),
  ]
  let chosen = null
  for (const current of candidates) {
    if (current.instant && (!chosen || earlierThan(current.instant, chosen.instant))) chosen = current
  }
  return {
    field: 'Greenhouse.first_published',
    status: chosen ? 'known' : 'unknown',
    value: chosen?.evidence.value ?? null,
    source: chosen?.evidence.source ?? null,
    candidates: candidates.map(current => current.evidence),
  }
}
