import METADATA from './catalog.js'
import {createCurrentScraper} from './currentNative.js'
import {possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const SOURCE=METADATA.source,COMPANY=METADATA.companyName,COMPANY_DOMAIN=METADATA.companyDomain
export const PROVIDER_METADATA=METADATA,VERIFIED_AT=null,VERIFIED_ON=null,VERIFIED_SURFACE_SUMMARY=METADATA.verifiedSurfaceSummary
export const OFFICIAL_BRAND_NAME=METADATA.officialBrandName||COMPANY,LEGAL_ENTITY_NAME=METADATA.legalEntityName||COMPANY
export const HOMEPAGE_URL="https://www.aadyah.com/",CAREERS_URL=METADATA.companyCareerPage


export const hasOfficialCareersSignal=html=>new RegExp("AADYAH Aerospace",'i').test(html)
export const hasOfficialHomepageSignal=html=>/AADYAH/i.test(html)
export const hasOfficialCompanyPageSignal=hasOfficialHomepageSignal
export const pageExposesPublicJobListings=html=>possibleVacancyMarkup(html,CAREERS_URL).length>0
export const pageExposesStructuredJobListings=pageExposesPublicJobListings
export const hasPublicJobsSignal=pageExposesPublicJobListings
export const hasFirstPartyCareerLikeLink=html=>document(html).nodes(node=>node.tag==='a'&&/^(?:https?:[/][/](?:www[.])?aadyah[.]com)?[/](?:careers?|jobs?|join-us|openings|hiring)(?:[/]|$)/i.test(node.attrs.href||'')).length>0
export const createAadyahAerospaceScraper=createCurrentScraper
export const run=options=>createAadyahAerospaceScraper().run(options)
