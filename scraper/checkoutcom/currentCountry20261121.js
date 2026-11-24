import {nativeCountryName as inheritedCountry} from './currentFacts20261120.js'

// Explicit country/territory labels and ISO aliases, as in this source's
// existing country normalizer. No city, office, language or role ID is used.
const aliases=new Map(Object.entries({ind:'IN',usa:'US',us:'US',uk:'GB',gbr:'GB',uae:'AE',are:'AE','south korea':'KR','czech republic':'CZ','hong kong':'HK','united states of america':'US'}))
export const sourceCountryName=value=>typeof value==='string'?inheritedCountry(value)??inheritedCountry(aliases.get(value.trim().replace(/\s+/g,' ').toLowerCase())):null
