import { createArcadiaScraper } from './native.js'
export { createArcadiaScraper, CAREERS_URL, LISTING_URL } from './native.js'

export const run = (options = {}) => createArcadiaScraper().run(options)
