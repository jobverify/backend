import {isDeepStrictEqual} from 'node:util'
import {all,flow,norm,snapshot} from '../anandengineeringproductspvtltd/currentHtml.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {need,failure,isFailure} from './currentErrors.js'
export {need,failure,isFailure}
export const CAREERS='https://www.btlnet.co.in/careers.php',HOME=CAREERS
export const reconcile=(a,b)=>need(isDeepStrictEqual(a,b),'closing whole careers/PDF models changed')
const activeMarkupText=n=>typeof n==='string'?flow(n):n.inert?'':n.children.map(activeMarkupText).join('')
export function readCareers(text){
 let doc;try{doc=readNativeDocument(text)}catch(e){throw failure('HTML contract: '+e.message)}
 const root=doc.nodes(n=>n.tag==='root')[0],nodes=all(root),parents=new Map();for(const n of nodes)for(const c of n.children)if(typeof c!=='string')parents.set(c,n)
 const titles=nodes.filter(n=>n.tag==='title').map(n=>norm(n.raw||flow(n)));need(titles.length===1&&titles[0]==='BTL India: Making Technology that Changes Lives for the Better','publisher title differs')
 need(nodes.some(n=>n.tag==='h1'&&norm(flow(n))==='BE PART OF OUR TEAM !')&&norm(flow(root)).includes('btlinrd-hr@btlnet.com'),'native employer/contact context missing')
 const headings=nodes.filter(n=>n.tag==='h4'&&norm(flow(n))==='Job Opportunities');need(headings.length===1,'missing/ambiguous Job Opportunities heading');const header=parents.get(headings[0]),scope=parents.get(header)
 need(header?.tag==='div'&&(header.attrs.class||'').split(/\s+/).includes('card-header')&&scope?.tag==='div'&&(scope.attrs.class||'').split(/\s+/).includes('card'),'native role scope differs')
 need(!nodes.some(n=>(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('next')),'new native continuation requires qualification')
 const anchors=all(scope).filter(n=>n.tag==='a'&&/\.pdf(?:$|[?#])/i.test(n.attrs.href||'')),roles=new Map()
 for(const anchor of anchors){const heading=parents.get(anchor);need(heading?.tag==='h4','unbound native PDF heading');let url;try{url=new URL(anchor.attrs.href,CAREERS)}catch{throw failure('invalid declared PDF URL')}
  need(url.origin==='https://www.btlnet.co.in'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/admin\/image\/career\/[^/?#]+\.pdf$/i.test(url.pathname)&&!/%(?:2f|5c|00)/i.test(url.pathname),'foreign/unbound native PDF URL')
  const title=norm(flow(anchor));need(title,'empty declared native PDF title');const activeMarkupLabel=norm(activeMarkupText(anchor)),copy={literalHref:anchor.attrs.href,anchorTree:snapshot(anchor),headingTree:snapshot(heading),activeMarkupLabel,enabled:!anchor.inert&&!heading.inert&&activeMarkupLabel===title&&!Object.hasOwn(anchor.attrs,'disabled')&&anchor.attrs['aria-disabled']!=='true'}
  if(roles.has(url.href)){const role=roles.get(url.href);need(role.title===title,'one native PDF has conflicting role titles');role.copies.push(copy);role.enabled ||=copy.enabled}
  else roles.set(url.href,{title,url:url.href,copies:[copy],enabled:copy.enabled})
 }
 need(roles.size>0&&roles.size<=32,'missing or excessive native PDF cohort')
 return{publisherTitle:titles[0],tree:snapshot(root),roleScopeTree:snapshot(scope),roles:[...roles.values()],displayPDFAnchorCount:anchors.length,nativeContactEmail:'btlinrd-hr@btlnet.com',literalMailtoAnchors:nodes.filter(n=>n.tag==='a'&&/^mailto:/i.test(n.attrs.href||'')).map(snapshot),scriptDeclarations:nodes.filter(n=>n.tag==='script').map(snapshot),styleDeclarations:nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')).map(snapshot),listingPages:1,publisherProgramsExecuted:false,externalHTMLRendererQualified:false}
}
