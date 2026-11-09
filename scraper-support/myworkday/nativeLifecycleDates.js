// Native CXS clocks must not use Date's permissive calendar rollover or the
// host timezone. Missing optional clocks and malformed supplied clocks differ.
export const parseWorkdayNativeLifecycleDate = (value, { field = 'date' } = {}) => {
  if (value == null) return { raw: null, date: null, precision: null, exact: false }
  const fail = () => {
    throw Object.assign(new Error(`Invalid Workday native ${field}`), {
      name: 'WorkdayNativeLifecycleDateError', code: 'WORKDAY_NATIVE_DATE_INVALID',
      field, abortRetries: true, failureKind: 'parser_or_contract_error',
    })
  }
  if (typeof value !== 'string') fail()
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2})))?$/.exec(value)
  if (!match) fail()
  const calendar = new Date(`${match[1]}T00:00:00.000Z`)
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== match[1]) fail()
  const exact = match[2] !== undefined
  if (exact && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59
    || Number(match[7] || 0) > 23 || Number(match[8] || 0) > 59)) fail()
  const date = exact ? new Date(value) : calendar
  if (!Number.isFinite(date.getTime())) fail()
  return { raw: value, date, precision: exact ? 'timestamp' : 'calendar-date', exact }
}
