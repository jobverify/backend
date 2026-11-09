import { runCurrentTrukker } from './currentNative.js'
export { PROVIDER_METADATA } from './catalog.js'

export const CAREERS_URL = 'https://www.trukker.com/careers'

export const run = (options) => runCurrentTrukker(options)
