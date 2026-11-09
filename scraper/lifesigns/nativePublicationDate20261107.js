// Exact native Wix publication wrapper observed in the public OpenRoles feed.
// Legacy strings/null remain unchanged; no alternative timestamp supplies a date.
const invalid = reason => { throw new Error('LifeSigns native publication date ' + reason) }

export const readLifeSignsNativePublicationDate = (rawValue, observedAt) => {
  if (rawValue == null || typeof rawValue === 'string') {
    return { postingDate: rawValue || null }
  }
  if (typeof rawValue !== 'object' || Array.isArray(rawValue)
    || Object.getPrototypeOf(rawValue) !== Object.prototype) invalid('has an unsupported wrapper')
  const keys = Reflect.ownKeys(rawValue)
  if (keys.length !== 1 || keys[0] !== '$date') invalid('has an ambiguous wrapper')
  const descriptor = Object.getOwnPropertyDescriptor(rawValue, '$date')
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable
    || typeof descriptor.value !== 'string') invalid('requires an own literal date string')
  const value = descriptor.value
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalid('requires the native canonical UTC format')
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) invalid('is not a real calendar instant')
  if (typeof observedAt !== 'number' || !Number.isFinite(observedAt)) invalid('requires a finite observation bound')
  if (timestamp > observedAt) invalid('is later than its observation bound')
  return {
    postingDate: value,
    sourceNativePublicationEvidence: { field: '_publishDate', rawValue: { $date: value }, value },
  }
}
