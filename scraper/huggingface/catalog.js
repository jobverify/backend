import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {publicWorkableMetadata,PUBLIC_WORKABLE_PROFILES} from '../../scraper-support/native-sources/publicWorkableSources/nativeCareers.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=publicWorkableMetadata(PUBLIC_WORKABLE_PROFILES.find(p=>p.source==='huggingface'), {
"adapter":"script","homepageUrl":"https://huggingface.co/","companyDomain":"huggingface.co","parser":"custom-script","normalizationProfile":"engineering-default","workableBoardUrl":"https://apply.workable.com/huggingface/",modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')})
export const VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary
export default PROVIDER_METADATA
