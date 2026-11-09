import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const VALTECH_INDIA_SYSTEMS_CATALOG={
 source:'valtechindiasystems',companyName:'Valtech India Systems',officialBrandName:'Valtech',adapter:'script',
 homepageUrl:'https://www.valtech.com/en-in/career/',companyCareerPage:'https://www.valtech.com/en-in/career/jobs/',jobListingsUrl:'https://www.valtech.com/en-in/career/jobs/',
 jobsApiUrl:'https://www.valtech.com/joblist/getjsonresult?id=1571&language=en-IN&limit=100',indiaCountryTag:'india',
 atsPlatform:'greenhouse-eu+first-party-joblist',nativeBoardUrl:'https://job-boards.eu.greenhouse.io/valtech',nativeBoardId:4003061101,
 countryFilter:'India',paginationStrategy:'unfiltered-corporate-100-row-and-native-50-row-pages+full-details+closing-reconciliation',
 extractionStrategy:'corporate-delegation+native-office-country-ancestry+full-native-visible-role-and-criteria+original-publication+application-context',
 parser:'custom-script',normalizationProfile:'engineering-default',companyDomain:'valtech.com',verifiedOn:'2026-10-27',
 verifiedPublicJobCount:null,verifiedIndiaJobCount:null,zeroResultPolicy:'evidence-required',
 verifiedSurfaceSummary:'Current first-party careers feed is double-encoded JSON. Discover the live India country taxonomy, enumerate every unfiltered corporate and native page and public detail, retain native country office ancestry and full rendered criteria, and reconcile closing role identity, counts and fields. The employer brand is Valtech; the backlog name Valtech India Systems is not proof of a legal employer. Actual native requisition and original publication control fields; native updates and corporate SEO dates never replace publication. Additional India Teamtailor and foreign Greenhouse hiring scopes retain partial evidence until verified. Public careers.india.valtech.com board access currently fails TLS verification in Node and Microsoft Edge with verification intact. Runtime receipts hold current counts.',
 modulePath:path.join(currentDir,'script.js')
}
export default VALTECH_INDIA_SYSTEMS_CATALOG
