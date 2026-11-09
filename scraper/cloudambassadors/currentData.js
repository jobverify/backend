import {parse} from 'acorn'
import {rendererProof} from './native.js'
import {bindNativeRoleArray} from './currentBinding.js'
import {APPLICATION} from './currentDeclarations.js'
import {need,failure} from './currentErrors.js'
const fields=['name','title','bio','arr']
const key=p=>p.key?.type==='Identifier'?p.key.name:p.key?.type==='Literal'&&typeof p.key.value==='string'?p.key.value:null
function literal(n,depth=0){
 need(depth<=32,'native literal nesting exceeds bound')
 if(n?.type==='Literal'&&(n.value===null||['string','number','boolean'].includes(typeof n.value))){need(typeof n.value!=='number'||Number.isFinite(n.value),'invalid native numeric literal');return n.value}
 if(n?.type==='UnaryExpression'&&n.operator==='-'&&n.argument?.type==='Literal'&&typeof n.argument.value==='number'){need(Number.isFinite(n.argument.value),'invalid native numeric literal');return-n.argument.value}
 if(n?.type==='ArrayExpression'){need(n.elements.length<=1000,'excessive native literal array');return n.elements.map(v=>literal(v,depth+1))}
 need(n?.type==='ObjectExpression'&&n.properties.length<=100,'unreviewed nonliteral native data');const value={}
 for(const p of n.properties){const k=key(p);need(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init'&&typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k)&&!Object.hasOwn(value,k),'ambiguous native property');value[k]=literal(p.value,depth+1)}return value
}
export function readData(assets,titles){
 const matches=[],candidates=[]
 for(const asset of assets){if(asset.kind!=='javascript')continue;let ast;try{ast=parse(asset.text,{ecmaVersion:'latest',sourceType:'script'})}catch{throw failure('declared client syntax unreviewed')}
  const pending=[ast],parents=new Map(),nodes=[]
  while(pending.length){const node=pending.pop()
   nodes.push(node)
   for(const v of Object.values(node))if(Array.isArray(v)){for(const c of v)if(c?.type){parents.set(c,node);pending.push(c)}}else if(v?.type){parents.set(v,node);pending.push(v)}
  }
  for(const node of nodes){
   if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&node.init?.type==='ArrayExpression'&&node.init.elements.length&&node.init.elements.every(v=>v?.type==='ObjectExpression'&&fields.every(k=>v.properties.some(p=>key(p)===k)))){
    const candidate={bindingName:node.id.name,arrayStartUTF16:node.init.start,arrayEndUTF16:node.init.end,rawDataArray:asset.text.slice(node.init.start,node.init.end),programURL:asset.url,programBodySHA256:asset.bodySHA256,roleAssociationQualified:false};candidates.push(candidate)
    const binding=bindNativeRoleArray(node,nodes,parents);if(!binding)continue
    const values=literal(node.init),names=values.map(v=>v.name);need(values.length===titles.length&&names.every((v,i)=>v===titles[i]),'native data and declared whole role cohort differ')
    for(const value of values)need(fields.slice(0,3).every(k=>typeof value[k]==='string'&&value[k].trim())&&Array.isArray(value.arr)&&value.arr.length>0&&value.arr.length<=100&&value.arr.every(v=>typeof v==='string'&&v.trim()),'incomplete native role criteria')
    candidate.roleAssociationQualified=true
    matches.push({dataModel:{bindingName:node.id.name,arrayStartUTF16:node.init.start,arrayEndUTF16:node.init.end,rawDataArray:asset.text.slice(node.init.start,node.init.end),nativeDataArray:values,programURL:asset.url,programBodySHA256:asset.bodySHA256},binding,renderer:rendererProof(asset.text,{arrayStartUTF16:node.init.start}),nativeProgram:asset.text})
   }
  }
 }
 if(matches.length!==1){const error=failure('native role binding or unaltered payload unqualified');Object.defineProperty(error,'nativeCandidateArrays',{value:structuredClone(candidates.map(c=>({...c,roleAssociationQualified:false})))});throw error}return{...matches[0],dataCandidates:candidates}
}
export function roleModels(declaration,data){
 const assetMetadata=declaration.assets.map(({text,...asset})=>asset)
 return data.dataModel.nativeDataArray.map((nativeRole,i)=>({nativeRole,buttonTree:declaration.careers.cards[i].tree,buttonEnabled:declaration.careers.cards[i].enabled,sharedApplicationURL:declaration.careers.applications.length?APPLICATION:null,nativeRoleScopeTree:declaration.careers.scopeTree,dataModel:data.dataModel,nativeProgram:{url:data.dataModel.programURL,bodySHA256:data.dataModel.programBodySHA256,text:data.nativeProgram},declaredAssetModels:assetMetadata,nativeDataBindingEvidence:data.binding,nativeRendererEvidence:data.renderer,nativeUnknownFields:Object.keys(nativeRole).filter(k=>!fields.includes(k)),nativePublisherIdentity:{homeTitle:declaration.home.title,careersTitle:declaration.careers.title},nativeCriteriaVisibilityQualified:false,nativePostingIdentityQualified:false,nativeCountryQualified:false,nativeHiringOrganizationQualified:false}))
}
export function mapRole(model,closing,at){
 const r=model.nativeRole,text=[r.title,r.bio,...r.arr].join('\n\n'),known=model.nativeUnknownFields.length===0
 return{source:'cloudambassadors',company:'Cloud Ambassadors',companyName:'Cloud Ambassadors',title:r.name,jobId:null,requisitionId:null,canonicalRoleURL:null,nativeIdentity:{kind:'title-bound-native-data-observation',name:r.name,publishedPostingId:null,formalRequisition:null,stablePostingIdentityQualified:false},sourceUrl:'https://cloudambassadors.com/careers',jobUrl:null,applyUrl:null,link:'https://cloudambassadors.com/careers',sharedApplicationURL:model.sharedApplicationURL,jobSpecificApplicationIdentityQualified:false,applicationVisited:false,activeApplyVerified:false,
  country:null,location:null,city:null,state:null,countryCode:null,nativeGeographyQualified:false,nativeCountryScopeUnresolved:true,sourceCountryScopeUnresolved:true,nativeHiringOrganization:null,nativePublisherOrganization:null,legalEmployer:null,employmentType:null,remoteStatus:null,workplaceType:null,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,
  jobDescription:text,description:text,sourceDescription:text,sourceDescriptionFormat:'text',fullNativeAuthoredRecordAvailable:true,fullNativeAuthoredCriteriaAvailable:known,nativeCriteriaVisibilityQualified:false,nativeCriteriaComplete:false,sourceDetailComplete:false,sourceDetailFailureKind:known?'native-posting-identity-country-hiring-and-rendered-criteria-unqualified':'unreviewed-native-fields-and-role-qualification',nativeModelClosingReconciled:true,nativeSourceRecord:structuredClone(model),nativeClosingRecord:structuredClone(closing),sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,scrapedAt:at,sourceCapturedAt:at}
}
