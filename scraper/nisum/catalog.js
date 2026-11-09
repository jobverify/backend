import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const NISUM_CATALOG = {
  source:'nisum',companyName:'Nisum',officialBrandName:'Nisum',adapter:'script',modulePath:path.resolve(currentDir,'script.js'),
  homepageUrl:'https://www.nisum.com/',officialCareersLandingUrl:'https://www.nisum.com/careers',
  companyCareerPage:'https://www.nisum.com/careers/careers-india',
  ceipalWidgetScriptUrl:'https://jobsapi.ceipal.com/APISource/widget.js',
  ceipalWidgetUrl:null,ceipalJobPostingsApiBaseUrl:null,ceipalApiKey:null,ceipalCareerPortalId:null,
  atsPlatform:'ceipal-careerapi',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',companyDomain:'nisum.com',
  paginationStrategy:'native-inventory-unverified-public-client-bot-denial',
  extractionStrategy:'current-first-party-widget-binding+public-v3-client+coverage-gap-guard',
  backfillMode:'discovery-only',zeroResultPolicy:'evidence-required',sourceExtractionImplemented:false,
  nativeExtractionVerified:false,fullInventoryVerified:false,verifiedOn:'2026-10-27',
  verifiedSurfaceSummary:'On 2026-10-27 the current Nisum India careers page advertised the Ceipal widget, whose public careerPortalWidget handoff selected the v3 client. The exact readonly listing POST emitted by that client in a fresh anonymous local Edge session returned HTTP 400 with an explicit bot-access denial. Native global/India inventory, full role details, original publication and expiry, requisition/application context, pagination and closing reconciliation remain unverified. This is a guard-only source with incomplete evidence, not a recovered extraction or verified absence of openings. Public widget identifiers are discovered from the current first-party page and excluded from catalog metadata.',
  dryRunFile:'nisum/jobs.json',
}
export default NISUM_CATALOG
