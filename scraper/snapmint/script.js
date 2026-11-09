import { createVerifiedCareersSurfaceScraper } from './verifiedCareersSurface.js'

export const CAREERS_URL = 'https://careers.snapmint.com/snapmint/'

export const run = (options) => createVerifiedCareersSurfaceScraper({
  company: 'Snapmint', careersUrl: CAREERS_URL, source: 'snapmint',
}).run(options)
