import CURRENT_METADATA from './catalog.js'
import {CURRENT_SURFACE} from './currentSurface.js'
import {createPublicIntakeScraper,inspectHomepage,inspectCareers,possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'
export const PROVIDER_METADATA=CURRENT_METADATA
export const SCRAPER_METADATA=CURRENT_METADATA
export const SOURCE=CURRENT_METADATA.source,COMPANY=CURRENT_METADATA.companyName,COMPANY_DOMAIN=CURRENT_METADATA.companyDomain
export const OFFICIAL_BRAND_NAME=CURRENT_METADATA.officialBrandName
export const VERIFIED_AT=null,VERIFIED_ON=null,VERIFIED_SURFACE_SUMMARY=CURRENT_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL=CURRENT_METADATA.homepageUrl,CAREERS_URL=CURRENT_METADATA.companyCareerPage,CAREERS_PAGE_URL=CAREERS_URL
export const CAREERS_ENTRY_URL=CAREERS_URL.replace(/\/$/,'')
export const APPLICATION_EMAIL=CURRENT_SURFACE.intakeEmail,APPLICATION_URL=APPLICATION_EMAIL?'mailto:'+APPLICATION_EMAIL:null
export const hasOfficialHomepageSignal=html=>inspectHomepage(html,CURRENT_SURFACE).valid
export const hasOfficialCareersSignal=html=>{const value=inspectCareers(html,CURRENT_SURFACE);return value.identity&&!!value.observation}
export const hasOfficialCareersSurface=hasOfficialCareersSignal
export const hasResumeOnlyCareersSignal=hasOfficialCareersSignal
export const pageExposesPublicJobListings=html=>possibleVacancyMarkup(html,CAREERS_URL).length>0
export const hasPublicJobListingSignal=pageExposesPublicJobListings
export const extractPublicJobLinks=html=>possibleVacancyMarkup(html,CAREERS_URL).map(row=>row.url).filter(Boolean)
export const createAdvariskScraper=()=>({async run({fetchText,fetchPage,...options}={}){return createPublicIntakeScraper(CURRENT_SURFACE).run({...options,fetchPage:fetchText||fetchPage})}})
export const run=options=>createAdvariskScraper().run(options)
