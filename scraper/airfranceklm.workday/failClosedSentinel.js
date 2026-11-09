// Compatibility entry point: source reads now retain native partial evidence.
import {runTalentsoft} from './native.js'
export const createFailClosedSentinelScraper=()=>({run:runTalentsoft})
export const run=options=>runTalentsoft(options)
