import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {currentNativeModel} from './currentModel20261120.js'
import {need,one,all,props,scalarFields,constraints} from './currentFacts20261120.js'
import {HOME,BOARD} from './currentOwnConsumer20261121.js'
import {UUID} from './currentRoleFacts20261121.js'
import {qualifyCurrentProperties,qualifyCurrentScope} from './currentScopeFacts20261121.js'
const sha=value=>createHash('sha256').update(value).digest('hex'),topKeys='ddRumApplicationId ddRumClientToken environment maintenanceMode schedulingMaintenanceMode organization posting jobBoard routerPrefix recaptchaUniversalPublicSiteKey'
const shape=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(' ')===names.split(' ').sort().join(' ')
const ownWebsite=value=>{need(typeof value==='string','Native publisher website missing');const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.datafold.com'&&!url.username&&!url.password&&!url.port&&url.pathname==='/'&&!url.search&&!url.hash}
function carrier(d,node,at,url){
 need(node,'Native publication carrier missing');const path=all(d.root,parent=>all(parent,item=>item===node).length>0)
 for(const item of path)need((!item.inactive||item===node&&item.tag==='title')&&!item.inert&&!Object.hasOwn(item.attrs,'hidden')&&!Object.hasOwn(item.attrs,'disabled')&&!Object.hasOwn(item.attrs,'inert')&&item.attrs['aria-disabled']!=='true'&&item.attrs['aria-hidden']!=='true','Native publication carrier/owner withdrawn')
 const properties=props(path.map(item=>item===node&&item.tag==='title'?{...item,inactive:false}:item));qualifyCurrentProperties(properties,{at,urls:[url,url+'/application']})
}
export function currentNativePacket(html,url,at,{role=false}={}){
 need(typeof html==='string'&&html.length>0&&(url===BOARD||role&&url.startsWith(BOARD+'/')),'Original native response identity missing')
 const d=document(html),nodes=all(d.root,()=>true),state=currentNativeModel(d),model=state.originalModel,head=one(nodes.filter(node=>node.tag==='head'),'Actual native head'),titleNode=one(all(head,node=>node.tag==='title'),'Original native head title'),title=decodeNativeEntities(titleNode.raw??d.text(titleNode));one(activeHead(html).titles,'Active native head title')
 need(shape(model,topKeys)&&model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.routerPrefix==='/'&&(role?model.jobBoard===null&&model.posting: model.posting===null&&model.jobBoard),'Native current environment/board/posting/routing scope differs')
 need(!nodes.some(node=>node.tag==='base'||node.tag==='meta'&&/refresh/i.test(node.attrs['http-equiv']??'')),'Native navigation authority differs')
 const org=model.organization;need(org&&typeof org==='object'&&!Array.isArray(org)&&org.__typename==='Organization'&&UUID.test(org.organizationId)&&org.name==='Datafold'&&org.hostedJobsPageSlug==='datafold'&&org.isDemoOrg===false&&ownWebsite(org.publicWebsite),'Native current employer/account/backlink differs')
 const custom=new URL(org.customJobsPageUrl);need(custom.protocol==='https:'&&custom.hostname==='www.datafold.com'&&!custom.username&&!custom.password&&!custom.port&&!custom.hash&&!custom.search&&custom.pathname.replace(/\/$/,'')===new URL(HOME).pathname.replace(/\/$/,''),'Native current own-career backlink differs')
 for(const field of ['url','@id','sameAs'])if(org[field]!=null){const identities=Array.isArray(org[field])?org[field]:[org[field]];need(identities.length>0&&identities.length<=128,'Native issuer identity array malformed');for(const value of identities){need(typeof value==='string','Native issuer identity malformed');const identity=new URL(value);identity.hash='';need(ownWebsite(identity.href)||identity.href===HOME,'Native issuer identity differs')}}
 qualifyCurrentProperties(scalarFields(Object.fromEntries(Object.entries(org).filter(([key])=>!['address','country'].includes(key)))),{at,urls:[HOME,BOARD,'https://api.ashbyhq.com/posting-api/job-board/datafold',url,url+'/application']})
 need(org.theme&&org.theme.jobBoardTopDescriptionHtml===null&&org.theme.jobBoardBottomDescriptionHtml===null,'Additional native board-wide published criteria require qualification')
 constraints(scalarFields(Object.fromEntries(Object.entries(org).filter(([key])=>!['address','country'].includes(key)))),[],{employer:'Datafold',observedAt:at,countryAlternatives:[]})
 const mount=one(nodes.filter(node=>node.attrs.id==='root'),'Actual native root mount'),script=one(nodes.filter(node=>node.tag==='script'&&node.attrs===state.originalScriptAttributes),'Actual original native state script');carrier(d,mount,at,url);carrier(d,script,at,url);carrier(d,titleNode,at,url)
 qualifyCurrentScope(mount,{at,urls:[url,url+'/application']})
 const og=one(nodes.filter(node=>node.tag==='meta'&&node.attrs.property==='og:url'),'Native actual OG identity');need(og.attrs.content===url,'Native current response/page identity differs');carrier(d,og,at,url)
 const structured=nodes.filter(node=>node.tag==='script'&&(node.attrs.type??'').toLowerCase()==='application/ld+json');need(structured.length===(role?1:0),'Native additional or missing structured vacancy publication')
 structured.forEach(node=>carrier(d,node,at,url));const schemas=structured.map(node=>readLiteralModel(node.raw??'').value)
 if(!role)need(title==='Datafold Jobs','Native current board title differs')
 const assignment=parse(state.originalAssignment,{ecmaVersion:'latest'}).body[0].expression,rawJSON=state.originalAssignment.slice(assignment.right.start,assignment.right.end)
 return{model,rawJSON,rawSchema:structured.map(node=>node.raw),schemas,title,originalHTML:html,htmlSHA256:sha(html),originalAssignment:state.originalAssignment,organizationBinding:{id:org.organizationId,name:org.name,slug:org.hostedJobsPageSlug,website:new URL(org.publicWebsite).href},nativeProgramsExecuted:false,rendererOrUIActivationVerified:false}
}
