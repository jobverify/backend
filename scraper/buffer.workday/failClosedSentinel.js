import {run as runNative} from './script.js'

// Preserve the old entry point without retaining its unconditional empty result.
export const createFailClosedSentinelScraper = () => ({run:runNative})

export const run = async (options = {}) => runNative(options)
