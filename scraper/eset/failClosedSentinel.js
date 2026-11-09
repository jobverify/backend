import {run as runNative} from './script.js'

export const createFailClosedSentinelScraper = () => ({run:runNative})

export const run = async (options = {}) => runNative(options)
