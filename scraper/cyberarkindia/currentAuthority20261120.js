import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'

export const CAREERS='https://www.cyberark.com/careers/'
const IDIRA='https://www.paloaltonetworks.com/idira',HOME='https://jobs.paloaltonetworks.com/en'
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('CyberArk current corporate handoff: '+message),{softFailure:true,abortRetries:true,failureKind:'parser_or_contract_error',lifecycleCleanupAllowed:false})}
const noNavigation=html=>{const d=document(html);need(!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'undeclared navigation');return d}

export async function readCorporateHandoff({io,readPage}){
 const entry=await readPage(CAREERS,true)
 need([301,302,303,307,308].includes(entry.receipt.status)&&new URL(entry.receipt.headers.location,CAREERS).href===IDIRA,'own current source redirect changed')
 io.allow(IDIRA)
 const corporate=await readPage(IDIRA),d=noNavigation(corporate.body),titles=activeHead(corporate.body).titles
 need(titles.length===1&&/\bIdira\b/i.test(titles[0])&&/Palo Alto Networks/.test(titles[0]),'current delegated corporate publisher differs')
 const links=d.nodes(n=>n.tag==='a'&&d.text(n)==='Careers'&&[HOME,HOME+'/'].includes(n.attrs.href)),hrefs=[...new Set(links.map(n=>n.attrs.href))]
 need(hrefs.length===1,'actual current corporate Careers link unavailable')
 const href=hrefs[0];io.allow(href)
 let home=await readPage(href,true)
 if([301,302,303,307,308].includes(home.receipt.status)){
  const url=new URL(home.receipt.headers.location,href).href;need(url===HOME,'native literal home redirect changed');io.allow(url);home=await readPage(url)
 }
 need(home.receipt.status===200,'native publisher unavailable')
 return{homeHTML:home.body,proof:{source:'cyberarkindia',originalSourceURL:CAREERS,originalSourceStatus:entry.receipt.status,originalSourceLocation:entry.receipt.headers.location,currentCorporateURL:IDIRA,currentCorporateTitle:titles[0],actualCareersControls:links.map(n=>({attrs:n.attrs,text:d.text(n)})),declaredNativeCareersURL:href,currentNativeHomeURL:home.receipt.url,publisherBrand:'Palo Alto Networks',sourceBrand:'CyberArk',employerProjection:'only original exact CyberArk Software (India) Private Limited; every other native brand/legal employer held',programmesExecuted:false,wholeBuildPinned:false}}
}
