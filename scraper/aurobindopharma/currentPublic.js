import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {withCurrentPublicProbe} from './publicProbe.js'
const C='https://www.aurobindo.com/careers',T='https://aurobindo.talentrecruit.com/Search/'
export const runCurrentAurobindo=options=>withCurrentPublicProbe('aurobindopharma',options,async context=>{
 const page=await context.read(C),doc=readNativeDocument(page.body),title=doc.nodes(n=>n.tag==='title').map(n=>n.raw||''),handoffs=doc.nodes(n=>n.tag==='a'&&!n.inert&&n.attrs.href===T&&/Work with us\s*\/\s*Opportunities/i.test(doc.text(n)))
 if(page.status!==200||!title.some(t=>/^Aurobindo Pharma Careers - Join Our Growing Team$/i.test(t))||handoffs.length!==1)throw context.unavailable('Aurobindo current corporate employer/handoff identity unavailable',page.status)
 const native=await context.read(T),audit={configuredSource:C,declaredNativeHandoff:T,nativeHTTPStatus:native.status,nativeInventoryComplete:false,observations:[],qualification:'current-employer-handoff-read;no-native-inventory-or-empty-proof'}
 await context.audit(audit)
 throw context.unavailable(native.status===404?'Aurobindo declared TalentRecruit handoff is HTTP404; native inventory unknown':'Aurobindo declared native public inventory contract is unavailable or unreviewed; inventory unknown',native.status===200?null:native.status)
})
