import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {publicWorkableMetadata,PUBLIC_WORKABLE_PROFILES} from '../../scraper-support/native-sources/publicWorkableSources/nativeCareers.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SEEQ_CATALOG=publicWorkableMetadata(PUBLIC_WORKABLE_PROFILES.find(p=>p.source==='seeq'), {
"adapter":"script","homepageUrl":"https://www.seeq.com/","companyDomain":"seeq.com","parser":"custom-script","normalizationProfile":"engineering-default","workableBoardUrl":"https://apply.workable.com/seeq/","jobsFeedUrl":"https://apply.workable.com/seeq/jobs.md",modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')})
export const VERIFIED_SURFACE_SUMMARY=SEEQ_CATALOG.verifiedSurfaceSummary
export default SEEQ_CATALOG
