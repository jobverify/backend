import {isDeepStrictEqual} from 'node:util'
import {all,flow,norm,snapshot} from '../anandengineeringproductspvtltd/currentHtml.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {need,failure,isFailure} from './currentErrors.js'
export {need,failure,isFailure}
const profileNeed=(ok,message)=>{if(!ok)throw Object.assign(failure(message),{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'})}
export const HOME='https://cloudambassadors.com/',CAREERS=HOME+'careers',APPLICATION=CAREERS+'/apply'
const resolved=(value,base)=>{try{return new URL(value,base).href}catch{return null}}
const one=(nodes,label)=>{need(nodes.length===1,'expected one '+label);return nodes[0]}
const document=html=>{try{return readNativeDocument(html)}catch(e){throw failure('HTML contract: '+e.message)}}
export const reconcile=(a,b,label)=>need(isDeepStrictEqual(a,b),'closing whole '+label+' changed')
export function readHome(html){
 const doc=document(html),root=one(doc.nodes(n=>n.tag==='root'),'home document'),titles=doc.nodes(n=>n.tag==='title').map(n=>norm(n.raw||''));need(titles.length===1&&titles[0]==='Cloud Ambassadors — Maximizing Cloud Impact','own homepage publisher title differs')
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href&&resolved(n.attrs.href,HOME)===CAREERS).length>0,'current own careers handoff missing');return{title:titles[0],tree:snapshot(root)}
}
export function readCareers(html){
 const doc=document(html),root=one(doc.nodes(n=>n.tag==='root'),'careers document'),nodes=all(root),parents=new Map();for(const n of nodes)for(const c of n.children)if(typeof c!=='string')parents.set(c,n)
 const titles=doc.nodes(n=>n.tag==='title').map(n=>norm(n.raw||''));need(titles.length===1&&titles[0]==='Careers | Cloud Ambassadors','own careers title differs')
 const head=one(nodes.filter(n=>n.tag==='p'&&norm(flow(n))==='Open Roles'),'Open Roles heading'),scope=parents.get(head);need(scope?.tag==='div','native role component differs')
 const buttons=all(scope).filter(n=>n.tag==='button'&&(n.attrs.class||'').split(/\s+/).includes('cursor-pointer')),cards=buttons.map(n=>({title:norm(flow(n)),tree:snapshot(n),enabled:!n.inert&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'}));need(cards.length>0&&cards.length<=50&&cards.every(c=>c.title)&&new Set(cards.map(c=>c.title)).size===cards.length,'missing, duplicate or excessive whole role cohort')
 need(!nodes.some(n=>(n.attrs.rel||'').split(/\s+/).includes('next')),'new native pagination requires qualification')
 const assets=nodes.filter(n=>n.tag==='script'&&n.attrs.src||n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).some(v=>v.toLowerCase()==='stylesheet')).map(n=>{let u;try{u=new URL(n.attrs.src||n.attrs.href,CAREERS)}catch{throw failure('invalid declared asset URL')};profileNeed(u.origin===HOME.slice(0,-1)&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/_next\/static\/(?:chunks|css)\/[a-z0-9._-]+\.(?:js|css)$/i.test(u.pathname),'unreviewed declared asset boundary');return{url:u.href,kind:n.tag==='script'?'javascript':'css',declaration:{...n.attrs}}})
 need(assets.length>0&&assets.length<=64&&new Set(assets.map(a=>a.url)).size===assets.length,'missing, duplicate or excessive complete asset declarations')
 const applications=nodes.filter(n=>n.tag==='a'&&n.attrs.href&&resolved(n.attrs.href,CAREERS)===APPLICATION).map(snapshot)
 return{title:titles[0],tree:snapshot(root),scopeTree:snapshot(scope),cards,assets,applications,listingPages:1}
}
