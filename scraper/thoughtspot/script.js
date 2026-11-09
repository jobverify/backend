import { createThoughtSpotScraper } from './native.js'
export { createThoughtSpotScraper, CAREERS_URL, LISTING_URL } from './native.js'

export const run = (options = {}) => createThoughtSpotScraper().run(options)
