import {structure,stable} from '../bizongo/publicRead.js'
import {collectPublicSource,coverageGap,requireSource} from '../adda247/sourceBoundary.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const source='agentdna',url='https://www.agentdna.ai/careers'
const inspect=html=>{
 const s=structure(html),text=s.text(s.root),title=s.visible(node=>node.tag==='title').map(node=>s.text(node)),headings=s.visible(node=>/^h[1-6]$/.test(node.tag)).map(node=>s.text(node))
 const links=s.visible(node=>node.tag==='a'&&node.attrs.href).map(node=>({url:node.attrs.href,label:s.text(node)}))
 requireSource(!/\b(open roles|open positions|current openings|job openings|view openings|available positions|hiring now|apply now|apply here|join our team)\b|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|keka\.com|darwinbox/i.test(text+' '+JSON.stringify(links))&&!s.nodes.some(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&/JobPosting/.test(node.raw)),source,'public careers route now exposes unreviewed job/vacancy content')
 const branded=title.length===1&&title[0]==='AgentDNA - Build Smarter AI Agents'&&/Build AI agents from composable genes/i.test(text)&&/The modular gene system for (?:composable )?AI agents/i.test(text)
 const missing=title.length===1&&/404: This page could not be found\./.test(title[0])&&/AgentDNA - Build Smarter AI Agents/i.test(text)
 requireSource(branded||missing,source,'current AgentDNA public identity changed')
 return{kind:missing?'configured-route-missing-page-observation':'configured-route-branded-shell-observation',title:title[0],headings,links,vacancy:false,country:null,postingDate:null,fullDescriptionQualified:false}
}
export const createCurrentAgentDnaScraper=()=>({async run(options={}){
 return collectPublicSource(source,options,new Set([url]),async({read,audit,stamp,receipts})=>{
  const first=inspect(await read(url,{phase:'opening'})),last=inspect(await read(url,{phase:'closing'})),closingReconciled=stable(first)===stable(last)
  requireSource(closingReconciled,source,'closing configured public route changed')
  const evidence={...coverageGap(url,'configured-public-route-does-not-provide-a-native-vacancy-inventory'),pagesFetched:receipts.length,verifiedAt:stamp()}
  await audit({observation:first,observedVacancyCount:0,closingReconciled,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  return attachSourceObservationEvidence(attachInventoryEvidence([],evidence),{source,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 })
}})
