import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const clients=new Map([
 ['https://cdn.phenompeople.com/CareerConnectResources/common/js/canvas/bootstrap/phw-runner-1793085641841.js','11fcbd7c232c3366d26646d8b5942a67e7210048d722bda674726b23c1b3d349'],
 ['https://cdn.phenompeople.com/CareerConnectResources/common/js/canvas/bootstrap/phw-runner-1791443697788.js','c27d8218f89bbdbe9eac87a2704bdd0f619fc80b01bf8cd94b36267e8ac7e48e'],
])
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Arrow visible role state: '+message),{softFailure:true,abortRetries:true,failureKind:'surface_drift_or_fail_closed',lifecycleCleanupAllowed:false})}
const entriesOf=doc=>{const result=[];const visit=(node,ancestors=[])=>{result.push({node,ancestors});for(const c of node.children)if(typeof c!=='string')visit(c,[...ancestors,node])};doc.nodes(n=>n.tag==='root').forEach(node=>visit(node));return result}
const nodesOf=doc=>entriesOf(doc).map(entry=>entry.node)
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const rawExcluded=new Set(['script','title','template','noscript','object','iframe','textarea','xmp','noembed','noframes','plaintext'])
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])

// These two real, reviewed client versions both select exists from a nonempty
// external jobDetail.data.job, remove other ph-page-state branches, remove
// hide/phw-d-none only from exists, and restore the body's initial visibility.
// This finite projection reads no remote code and grants no country/JD proof.
function visibleBody(html,model){
 const doc=readNativeDocument(html),nodes=nodesOf(doc),bodies=nodes.filter(n=>n.tag==='body')
 need(model.app.pageState==null||model.app.pageState==='exists','current native pageState is not exists')
 need(bodies.length===1,'native own body is missing or ambiguous')
 const body=bodies[0]
 need(body.attrs.class==='job-page job'&&body.attrs.style==='visibility: hidden;','native preboot body mask changed')
 need(!nodes.some(n=>n.tag==='base'),'native body base requires review')
 const render=node=>{
  if(typeof node==='string')return node
  if(rawExcluded.has(node.tag))return ''
  if(Object.hasOwn(node.attrs,'ph-page-state')&&node.attrs['ph-page-state']!=='exists')return ''
  if(node.tag==='root')return node.children.map(render).join('')
  const attrs={...node.attrs};if(node===body)delete attrs.style
  if(attrs['ph-page-state']==='exists')attrs.class=(attrs.class||'').split(/\s+/).filter(c=>!['hide','phw-d-none'].includes(c)).join(' ')
  const start='<'+node.tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'
  if(voids.has(node.tag))return start
  return start+(node.tag==='style'?node.raw||'':node.children.map(render).join(''))+'</'+node.tag+'>'
 }
 const visible=readVisibleNativeDocument(render(nodes[0]),{strict:true}),qualified=visible.nodes(n=>n.tag==='body')
 need(qualified.length===1,'native body remains stylesheet-hidden after reviewed preboot projection')
 return visible.text(qualified[0])
}

export function createRoleStatusReader({fetchImpl=globalThis.fetch,signal,packets=[],onPacket,timeoutMs=30000}={}){
 const cache=new Map()
 const read=async url=>{
  need(clients.has(url),'unreviewed declared native renderer URL')
  const activeSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(timeoutMs)])
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:activeSignal,headers:{Accept:'application/javascript,text/javascript'}})
  const chunks=[];let bytes=0
  if(response.body)for await(const chunk of response.body){bytes+=chunk.length;need(bytes<=512000,'native renderer size changed');chunks.push(Buffer.from(chunk));activeSignal.throwIfAborted()}
  const body=Buffer.concat(chunks),sha256=createHash('sha256').update(body).digest('hex')
  const packet={requestedURL:url,method:'GET',requestBody:null,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:body.toString('base64'),bodySHA256:sha256,bytes:body.length}
  packets.push(packet);if(onPacket)await onPacket(packet)
  need(response.status===200&&response.redirected!==true&&response.url===url
   &&/^(?:text|application)\/(?:java|ecma)script\b/i.test(response.headers.get('content-type')||'')
   &&sha256===clients.get(url),'current declared native renderer status/identity/body changed')
  return {url,sha256}
 }
 return {
  async inspect(html,model){
   const entries=entriesOf(readNativeDocument(html)),scripts=entries.filter(({node})=>node.tag==='script'&&node.attrs.id==='phwRunnerJs'),entry=scripts[0],script=entry?.node
   need(scripts.length===1&&!script.nativeTagUnqualified&&!entry.ancestors.some(n=>n.nativeTagUnqualified||rawExcluded.has(n.tag)||['svg','math'].includes(n.tag))
    &&script.attrs.type==='text/javascript'&&script.attrs.defer==='true'
    &&Object.keys(script.attrs).sort().join()==='defer,id,src,type'&&clients.has(script.attrs.src),'native renderer declaration/execution mode changed')
   const url=script.attrs.src;if(!cache.has(url))cache.set(url,read(url))
   const renderer=await cache.get(url),body=visibleBody(html,model)
   const closed=/\b(?:this|the)\s+(?:job|position|role|vacancy|opportunity|requisition)\s+(?:(?:has|have)\s+been\s+|(?:is|was)\s+)(?:(?:currently|now|temporarily)\s+)?(?:filled|closed|expired|cancelled|canceled|unavailable|(?:not|no\s+longer)\s+(?:available|open|accepting\s+applications))\b/i
   const applications=/\bapplications?\s+(?:for\s+(?:this|the)\s+(?:job|position|role|vacancy)\s+)?(?:are|is|have\s+been|has\s+been)\s+(?:closed|no\s+longer\s+(?:accepted|being\s+accepted))\b/i
   need(!closed.test(body)&&!applications.test(body),'current visible role closure/filled notice contradicts native models')
   return {method:'reviewed-current-native-client-body-and-pageState-projection',rendererURL:renderer.url,rendererSHA256:renderer.sha256,pageState:'exists'}
  },
  async close(){for(const [url,promise]of cache){await promise;await read(url)}},
 }
}
