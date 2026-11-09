import {fileURLToPath} from 'node:url'
import METADATA from './catalog.js'
import {createCurrentScraper} from './currentNative.js'
import {possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const SOURCE=METADATA.source,COMPANY=METADATA.companyName,COMPANY_DOMAIN=METADATA.companyDomain
export const PROVIDER_METADATA=METADATA,VERIFIED_AT=null,VERIFIED_ON=null,VERIFIED_SURFACE_SUMMARY=METADATA.verifiedSurfaceSummary
export const OFFICIAL_BRAND_NAME=METADATA.officialBrandName||COMPANY,LEGAL_ENTITY_NAME=METADATA.legalEntityName||COMPANY
export const HOMEPAGE_URL="https://www.acmesolar.in/",CAREERS_URL=METADATA.companyCareerPage

export const CAREER_FORM_URL='https://www.acmesolar.in/career_form',APPLY_EMAIL='careers@acme.in'
export const hasOfficialCareersSignal=html=>new RegExp("ACME Solar",'i').test(html)
export const hasOfficialHomepageSignal=html=>/id=["\']root["\']/i.test(html)
export const hasOfficialCompanyPageSignal=hasOfficialHomepageSignal
export const pageExposesPublicJobListings=html=>possibleVacancyMarkup(html,CAREERS_URL).length>0
export const pageExposesStructuredJobListings=pageExposesPublicJobListings
export const hasPublicJobsSignal=pageExposesPublicJobListings
export const hasFirstPartyCareerLikeLink=html=>document(html).nodes(node=>node.tag==='a'&&/^(?:https?:[/][/](?:www[.])?acmesolar[.]in)?[/](?:careers?|jobs?|join-us|openings|hiring)(?:[/]|$)/i.test(node.attrs.href||'')).length>0
export const createAcmeSolarScraper=createCurrentScraper
export const run=options=>createAcmeSolarScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,METADATA.dryRunFile);else await saveToDB(jobs,SOURCE)}
