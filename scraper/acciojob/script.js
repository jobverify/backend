import {createCurrentEmployeeScraper} from './currentEmployee.js'
﻿import config from './nativeConfig.js'
import {runNativeKeka,extractCareerConfig as extractConfig,extractDocument,buildActiveJobsUrl as activeUrl} from './nativeKeka.js'
export const CAREER_PAGE_URL=config.shellUrl
export const SOURCE=config.source
export const COMPANY=config.companyName
export const extractPortalDocumentUrl=html=>extractDocument(html,config)
export const extractCareerConfig=html=>extractConfig(html,config)
export const buildActiveJobsUrl=input=>activeUrl(input,config)
export const createAcciojobScraper=createCurrentEmployeeScraper
export const run=(options={})=>createAcciojobScraper().run(options)
