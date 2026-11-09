import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {publicWorkableMetadata,PUBLIC_WORKABLE_PROFILES} from '../../scraper-support/native-sources/publicWorkableSources/nativeCareers.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const TRAVISCI_CATALOG=publicWorkableMetadata(PUBLIC_WORKABLE_PROFILES.find(p=>p.source==='travisci'), {
"adapter":"script","homepageUrl":"https://www.travis-ci.com/","companyDomain":"travis-ci.com","parser":"custom-script","normalizationProfile":"engineering-default","workableBoardUrl":"https://apply.workable.com/travisci/","jobsFeedUrl":"https://apply.workable.com/travisci/jobs.md","aboutPageUrl":"https://www.travis-ci.com/about-us/","imprintPageUrl":"https://docs.travis-ci.com/imprint.html","widgetApiUrl":"https://apply.workable.com/api/v1/widget/accounts/travisci","noPublicJobRouteUrls":["https://www.travis-ci.com/careers", "https://www.travis-ci.com/jobs"],modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')})
export const VERIFIED_SURFACE_SUMMARY=TRAVISCI_CATALOG.verifiedSurfaceSummary
export default TRAVISCI_CATALOG
