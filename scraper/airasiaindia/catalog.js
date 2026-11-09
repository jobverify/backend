import path from'node:path'
import{fileURLToPath}from'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const AIRASIA_INDIA_CATALOG={
 source:'airasiaindia',companyName:'Air India Express',legacyCompanyName:'AirAsia India',officialBrandName:'Air India Express',
 adapter:'script',companyCareerPage:'https://www.airindiaexpress.com/careers',companyDomain:'airindiaexpress.com',
 atsPlatform:'successfactors-aix-public-brand',countryFilter:'India',
 paginationStrategy:'corporate-AEM-model+declared-AIX-brand+native-tile-load-more+closing',
 extractionStrategy:'verified-legal-successor+current-AIX-brand+full-native-postings-or-explicit-zero+closing',
 parser:'custom-script',normalizationProfile:'engineering-default',historicalContinuityURL:'https://www.airindia.com/in/en/newsroom/press-release/air-india-express-aix-connect-merger.html',
 historicalContinuityPublishedOn:'2024-10-01',currentHiringBrand:'aix',nativeBoardURL:'https://careers.airindia.com/aix',
 relatedRegisteredSource:'airindia',sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,zeroResultPolicy:'evidence-required',
 verifiedSurfaceSummary:'The official legal merger statement identifies AIX Connect (erstwhile AirAsia India) as merged into Air India Express. The current corporate AEM careers model declares the exact AIX brand board. Runtime validates that handoff, company/brand token and blank native search. Positive tiles require reconciled native pagination, full posting content, explicit AIX employer evidence, canonical/apply identity, typed ISO country and closing checks; all positive outputs retain incomplete company scope and disabled cleanup. Explicit zero requires two matching native reads without positive count carriers. The separate Air India airline remains a distinct employer. Live positive India behavior has only controlled fixture qualification while the current declared AIX board is empty.',
 modulePath:path.join(currentDir,'script.js')
}
export default AIRASIA_INDIA_CATALOG
