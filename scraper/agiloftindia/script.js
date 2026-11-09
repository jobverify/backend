import { createAgiloftIndiaScraper } from './native.js'
export * from './native.js'
export const run = options => createAgiloftIndiaScraper(options).run(options)
