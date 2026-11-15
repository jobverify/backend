import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {activeIframeDeclarations,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseNativeJSON} from './nativeJSON.js'

const profile=JSON.parse(fs.readFileSync(new URL('./currentNativeView.scope.json',import.meta.url)))
const careers='https://www.comviva.com/careers/explore-opportunity/'
const key='VkZUbnpKcFNPaUFzWitxQUNzU25sZz09',cp='Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'
const widget='https://jobsapi.ceipal.com/APISource/v2/index.html?bgcolor=eb2227&api_key='+key+'&cp_id='+cp
const handoff='https://careerapi.ceipal.com/careerPortalWidget/?themeid=&bgcolor=&job_id='
const sha=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row)
const need=(condition,reason)=>{if(!condition)throw Error('comviva independent native view: '+reason)}
const receiptFor=(receipts,url)=>receipts.findLast(receipt=>receipt.url===url&&!receipt.failed)

// This pins the actual corporate declaration, not its rendered application.
// Only the witnessed request nonce is variable: every occurrence is accounted
// for as a DOM nonce or a literal Flight nonce and bound to the response CSP.
export function qualifyCurrentNativeDelegation(html,receipts,nativeScope){
 const result={complete:false,profileID:profile.profileID,corporateUIQualified:false,holds:[]}
 try{
  const receipt=receiptFor(receipts,careers)
  need(receipt?.responseHeadersObserved===true&&receipt.sha256===sha(html),'current corporate HTTP header proof unavailable')
  const doc=readNativeDocument(html),nodes=doc.nodes(node=>Object.hasOwn(node.attrs,'nonce'))
  const nonces=[...new Set(nodes.map(node=>node.attrs.nonce))],nonce=nonces[0]
  need(nodes.length===profile.domNonceCount&&nonces.length===1&&typeof nonce==='string','current corporate nonce declarations changed')
  const decoded=Buffer.from(nonce,'base64').toString('utf8')
  need(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(decoded)&&Buffer.from(decoded).toString('base64')===nonce,'unreviewed request nonce shape')
  const inline=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&!['application/json','application/ld+json'].includes(node.attrs.type||''))
  need(inline.length===2&&inline[0].raw==='(self.__next_f=self.__next_f||[]).push([0])','current literal Flight bootstrap changed')
  const match=inline[1].raw.match(/^self\.__next_f\.push\(([\s\S]*)\)$/)
  need(match,'current literal Flight frame changed')
  const frame=JSON.parse(match[1])
  need(Array.isArray(frame)&&frame.length===2&&frame[0]===1&&typeof frame[1]==='string','nonliteral Flight frame')
  const fields=[...frame[1].matchAll(/"nonce":"([^"\\]*)"/g)]
  need(fields.length===profile.flightNonceCount&&fields.every(field=>field[1]===nonce),'Flight nonce is not bound to the current document')
  need(html.split(nonce).length-1===profile.domNonceCount+profile.flightNonceCount,'unaccounted request nonce occurrence')
  need(sha(html.replaceAll(nonce,profile.requestNoncePlaceholder))===profile.corporateNormalizedHTMLSHA256,'current whole corporate declaration changed')
  const csp=receipt.headers?.['content-security-policy']
  need(typeof csp==='string'&&csp.split(nonce).length-1===1&&sha(csp.replaceAll(nonce,profile.requestNoncePlaceholder))===profile.corporateNormalizedCSPSHA256,'current corporate CSP binding changed')
  need(sha(canonical(nativeScope.assets))===profile.nativeAssetSetSHA256,'reviewed native program/style set changed')
  return{...result,complete:true,requestNonce:nonce,originalHTMLSHA256:receipt.sha256,originalContentSecurityPolicy:csp,
   contractIdentity:{profileID:profile.profileID,normalizedHTMLSHA256:profile.corporateNormalizedHTMLSHA256,normalizedCSPSHA256:profile.corporateNormalizedCSPSHA256,nativeAssetSetSHA256:profile.nativeAssetSetSHA256}}
 }catch(error){result.holds.push(error.message);return result}
}

export async function readDeclaredNativeRoleView(row,{read,receipts,nativeScope}){
 const result={complete:false,nativeID:row.id,jobCode:row.job_code,corporateUIQualified:false,holds:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 try{
  const handoffURL=handoff+encodeURIComponent(row.id)+'&apikey='+key+'&cp_id='+cp
  const model=parseNativeJSON(await read(handoffURL,{headers:{Accept:'application/json, text/javascript, */*; q=0.01',Origin:'https://www.comviva.com',Referer:careers,'X-Referer-Host':'https://jobsapi.ceipal.com/','User-Agent':'Mozilla/5.0'}}))
  if(model?.success===0||Number(model?.status)>=400)throw Object.assign(Error('comviva native role handoff unavailable'),{status:model.status})
  need(model&&Object.keys(model).length===1&&typeof model.html==='string','selected native handoff shape changed')
  need(model.html.split(row.id).length-1===1&&sha(model.html.replace(row.id,''))===nativeScope.handoffHTMLSHA256,'selected native handoff or employer binding changed')
  const frames=activeIframeDeclarations(model.html),viewURL=widget+'&job_id='+row.id
  need(frames.length===1&&frames[0].href===viewURL,'returned native role URL does not select the same job and employer')
  const body=await read(viewURL),receipt=receiptFor(receipts,viewURL)
  need(receipt?.responseHeadersObserved===true&&receipt.sha256===sha(body),'native role view HTTP proof unavailable')
  need(receipt.headers?.['content-security-policy']===null&&receipt.headers?.['content-security-policy-report-only']===null,'unreviewed selected native-view CSP')
  need(sha(body)===profile.nativeShellSHA256&&sha(body)===nativeScope.assets[widget+'&job_id='],'selected native role whole shell changed')
  return{...result,complete:true,viewURL,handoffURL,originalHandoffHTML:model.html,nativeViewHTTPReceipt:receipt,
   contractIdentity:{nativeID:row.id,jobCode:row.job_code,viewURL,handoffHTMLSHA256:sha(model.html),shellSHA256:sha(body),nativeAssetSetSHA256:profile.nativeAssetSetSHA256}}
 }catch(error){if([400,401,403].includes(error.status))throw error;result.holds.push(error.message);return result}
}

export const matchingNativeViewContracts=(before,after)=>Boolean(before?.complete&&after?.complete&&canonical(before.contractIdentity)===canonical(after.contractIdentity))
