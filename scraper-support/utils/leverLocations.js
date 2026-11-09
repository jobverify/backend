const clean = value => typeof value === 'string' ? value.trim() || null : null
const EXPLICIT_INDIA = /\bindia\b/i

// Lever's country belongs to the primary location. An additional India office
// can be selected without assigning the primary office's foreign country to it.
export const selectLeverLocation = record => {
  const primary = clean(record?.categories?.location)
  const locations = [primary, ...(Array.isArray(record?.categories?.allLocations)
    ? record.categories.allLocations.map(clean) : [])].filter(Boolean)
  // Secondary locations carry no country field. A shared city name alone can
  // refer to Delhi, NY or Hyderabad, Sindh, so keep those candidates unresolved.
  return locations.find(location => EXPLICIT_INDIA.test(location)) || primary
}

export const selectLeverCountry = record => {
  if (EXPLICIT_INDIA.test(selectLeverLocation(record) || '')) return 'India'
  const country = clean(record?.country)
  return /^(?:IN|IND|India)$/i.test(country || '') ? 'India' : country
}
