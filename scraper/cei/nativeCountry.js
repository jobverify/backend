import { parseJavaScriptLiteral } from '../../scraper-support/utils/safeLiteral.js'

// Read the same static country table the current first-party portal uses for
// address controls. The downloaded program is never executed.
export const readPortalCountries = source => {
  const text = String(source)
  const match = /\b(?:const|let|var)\s+[\w$]+=\[\{code:"US",id:\d+,name:"United States",states:\[/.exec(text)
  if (!match) throw new Error('CEI public portal country table is missing')
  const start = text.indexOf('[', match.index)
  let depth = 0
  let quote = null
  let escaped = false
  let end = -1
  for (let index = start; index < text.length && index - start < 300000; index += 1) {
    const char = text[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === '[') depth += 1
    else if (char === ']' && --depth === 0) { end = index + 1; break }
  }
  if (end < 0) throw new Error('CEI public portal country table is incomplete')
  const countries = parseJavaScriptLiteral(text.slice(start, end))
  if (!countries.every(country => Number.isInteger(country.id) && /^[A-Z0-9]{2,4}$/.test(country.code) && typeof country.name === 'string')
    || new Set(countries.map(country => country.id)).size !== countries.length
    || !countries.some(country => country.code === 'IN' && country.name === 'India')) {
    throw new Error('CEI public portal country table identity is invalid')
  }
  return new Map(countries.map(country => [country.id, country]))
}

const indiaStates = new Set(['andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'delhi', 'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'chandigarh', 'puducherry', 'jammu and kashmir', 'ladakh'])
const text = value => String(value ?? '').trim().toLowerCase()

export const nativeCountry = (record, countries = new Map()) => {
  const address = record?.address || {}
  const name = text(address.countryName)
  const code = text(address.countryCode)
  const mapped = countries.get(Number(address.countryID))
  const explicitIndia = name === 'india' || code === 'in' || code === 'ind'
  const indiaState = indiaStates.has(text(address.state))
  if (mapped) {
    if (!/^[A-Z]{2}$/.test(mapped.code) || mapped.code === 'NONE') return null
    if ((name && name !== text(mapped.name)) || (code && code !== text(mapped.code))
      || (mapped.code !== 'IN' && (explicitIndia || indiaState))) return null
    return mapped.code
  }
  // A new numeric ID must be reviewed against the published native mapping.
  if (address.countryID != null) return null
  if (explicitIndia) return 'IN'
  if (name || code) return name === 'united states' || ['us', 'usa'].includes(code) ? 'US' : 'OTHER'
  return indiaState && text(address.city) ? 'IN' : null
}
