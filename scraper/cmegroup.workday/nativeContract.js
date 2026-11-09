import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const BOARD='https://cmegroup.wd1.myworkdayjobs.com/cme_careers'
export const LOCATION_ID='7a3301e6ea5710f69c0ee6a821946acb'
export const OFFICIAL_BINDING=Object.freeze({
 officialURL:'https://www.cmegroup.com/',careersURL:'https://www.cmegroup.com/careers.html',
 boardURL:'https://cmegroup.wd1.myworkdayjobs.com/en-US/cme_careers',
 proof:'artifacts/full-catalog/workday-positive-preflight-001/cmegroup-official-careers-004.json',
 observedAt:'2026-10-21T12:56:52.193Z',
 bodySha256:'958ec60bea25ce8c977ea1cecfdb00dd79569811a66acc0e520e766d5aacb18b',
 observationTransport:'actual-current-public-corporate-HTTP200-active-exact-native-link',
 companyScopeComplete:false,
})
export function validateCmeDescriptions(jobs){
 for(const job of jobs){
  if(typeof job.title!=='string'||!job.title.trim()||/[<>\u0000-\u001f]/.test(job.title))throw Error('CME Group native title malformed')
  const document=readNativeDocument(job.sourceDescription),root=document.nodes(n=>n.tag==='root')[0]
  const mark=(node,inherited=false)=>{if(typeof node==='string')return;node.inert=Boolean(node.inert||inherited||Object.hasOwn(node.attrs,'inert'));for(const child of node.children)mark(child,node.inert)}
  mark(root)
  const text=document.text(root),sentences=text.split(/(?<=[.!?])\s+/)
  if(/\b(?:(?:this|the) (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i.test(text))throw Error('CME Group native role explicitly unavailable')
  const substantive=sentences.filter(s=>!/^(?:please\s+)?(?:(?:click|select|press|tap)\s+(?:the\s+)?)?apply(?:\s+now)?(?:\s+button)?\b.*\b(?:view|learn|description|application|access|details|requirements|instructions|recruitment|qualifications|responsibilities)\b/i.test(s)&&!/^(?:please\s+)?(?:submit|complete|start|send)\s+(?:(?:your|an?|the)\s+)?application\b.*\b(?:view|access|learn|information|details|responsibilities|qualifications)\b/i.test(s)&&!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon|available\s+(?:after|once))\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
  if(substantive.length<100)throw Error('CME Group full native description is missing, inactive or instructional only')
 }
 return jobs
}
