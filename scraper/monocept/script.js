import MONOCEPT_CATALOG from './catalog.js'
import {runNativeMonocept} from './nativeRun.js'
export const PROVIDER_METADATA=MONOCEPT_CATALOG
export const SOURCE=PROVIDER_METADATA.source
export const COMPANY=PROVIDER_METADATA.companyName
export const VERIFIED_ON=PROVIDER_METADATA.verifiedOn
export const CAREERS_URL=PROVIDER_METADATA.careersUrl
export const HANDOFF_URL=PROVIDER_METADATA.handoffUrl
export const createMonoceptScraper=(defaults={})=>({run:(options={})=>runNativeMonocept({...defaults,...options})})
export const run=(options={})=>createMonoceptScraper().run(options)
