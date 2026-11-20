import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
const need=(ok,message)=>{if(!ok)throw Error('Current TalentBrew native GET protocol: '+message)}
const name=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const member=(n,object,property)=>n?.type==='MemberExpression'&&!n.computed&&name(n.object)===object&&name(n.property)===property
const props=n=>{need(n?.type==='ObjectExpression'&&n.properties.every(p=>p.type==='Property'&&!p.computed&&p.kind==='init'&&!p.method),'non-literal native object mapping');const rows=n.properties.map(p=>[name(p.key),p.value]);need(rows.every(([k])=>typeof k==='string'&&!['__proto__','constructor','prototype'].includes(k))&&new Set(rows.map(([k])=>k)).size===rows.length,'ambiguous native mapping keys');return Object.fromEntries(rows)}
const walk=(n,predicate,out=[])=>{if(!n||typeof n!=='object')return out;if(predicate(n))out.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(c=>walk(c,predicate,out));else if(v&&typeof v==='object')walk(v,predicate,out);return out}
const one=(a,label)=>{need(a.length===1,'unique '+label+' changed');return a[0]}
const ast=s=>{try{return parse(s,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'unparseable public program')}}
const variable=(tree,id)=>one(walk(tree,n=>n.type==='VariableDeclarator'&&name(n.id)===id),id).init
const literal=(n,constants={})=>{if(n?.type==='Literal')return n.value;if(n?.type==='ArrayExpression')return n.elements.map(x=>literal(x,constants));if(n?.type==='MemberExpression'&&!n.computed){need(Object.hasOwn(constants,name(n.object))&&Object.hasOwn(constants[name(n.object)],name(n.property)),'unknown literal enum');return constants[name(n.object)][name(n.property)]}need(false,'non-literal public defaults')}
const scalarObject=n=>Object.fromEntries(Object.entries(props(n)).map(([k,v])=>[k,literal(v)]))
const compact=n=>{if(Array.isArray(n))return n.map(compact);if(n&&typeof n==='object')return Object.fromEntries(Object.entries(n).filter(([k])=>!['start','end','raw'].includes(k)).map(([k,v])=>[k,compact(v)]));return n}
const expression=s=>ast('('+s+')').body[0].expression
const equivalent=(n,s)=>isDeepStrictEqual(compact(n),compact(expression(s)))
// Alpha-normalize only declared local bindings; public property names and
// operator/literal structure remain semantic constraints, not build hashes.
function alpha(fn,external={}){const bindings=new Map();for(const n of walk(fn,n=>n.type==='FunctionDeclaration'||n.type==='FunctionExpression'||n.type==='VariableDeclarator')){const ids=n.type==='VariableDeclarator'?[n.id]:[n.id,...n.params];for(const id of ids)if(id?.type==='Identifier'&&!bindings.has(id.name))bindings.set(id.name,'local'+bindings.size)}for(const[k,v]of Object.entries(external))if(!bindings.has(k))bindings.set(k,v);const visit=(n,parent,key)=>{if(Array.isArray(n))return n.map(x=>visit(x,parent,key));if(!n||typeof n!=='object')return n;const out={};for(const[k,v]of Object.entries(n)){if(['start','end','raw'].includes(k))continue;if(n.type==='Identifier'&&k==='name'&&bindings.has(v)&&!(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)&&!(parent?.type==='Property'&&key==='key'&&!parent.computed))out[k]=bindings.get(v);else out[k]=visit(v,n,k)}return out};return visit(fn,null,null)}
const binderTemplate='function bind(n,t,i,r){var u;if(Array.isArray(t))jQuery.each(t,function(t,u){i||/\\[\\]$/.test(n)?r(n,u):bind(n+"["+t+"]",u,i,r)});else if(i||typeof t!="object")r(n,t);else for(u in t)bind(n+"."+u,t[u],i,r)}'
const serializerTemplate='function(n,t){var i,r=[],u=function(n,t){t=typeof t=="function"?t():t==null?"":t;r[r.length]=encodeURIComponent(n)+"="+encodeURIComponent(t)};if(t===undefined&&(t=jQuery.ajaxSettings&&jQuery.ajaxSettings.traditional),Array.isArray(n)||n.jquery&&!jQuery.isPlainObject(n))jQuery.each(n,function(){u(this.name,this.value)});else for(i in n)buildQueryParams(i,n[i],t,u);return r.join("&").replace(/%20/g,"+")}'
export function readCurrentTalentBrewProtocol(searchProgram,coreProgram){
 const tree=ast(searchProgram),constants={SearchResultTypes:scalarObject(variable(tree,'SearchResultTypes'))},defaults=Object.fromEntries(Object.entries(props(variable(tree,'defaultValues'))).map(([k,v])=>[k,literal(v,constants)])),ids=scalarObject(variable(tree,'ids'))
 need(ids.resultListWrap==='#search-results'&&ids.filterPanel==='#search-filters','native result/filter scope changed')
 const action=props(variable(tree,'searchAction'));need(action.Type?.value==='GET'&&equivalent(action.Data,'$.bindQueryParams(criteria)'),'native GET request declaration changed')
 need(equivalent(variable(tree,'ajaxUrl'),"searchAction.Type == 'GET' ? $(ids.resultListWrap).attr('data-ajax-url') : $(ids.resultListWrap).attr('data-ajax-post-url')"),'native GET URL binding changed')
 const ajax=one(walk(tree,n=>n.type==='CallExpression'&&member(n.callee,'$','ajax')),'public AJAX action'),request=props(ajax.arguments[0]);need(name(request.url)==='ajaxUrl'&&equivalent(request.type,'searchAction.Type')&&equivalent(request.data,'searchAction.Data'),'native public request method/data binding changed')
 const mapFn=variable(tree,'mapSearchOptions');need(mapFn?.type==='FunctionExpression','native option mapper changed')
 const mapping=props(one(walk(mapFn,n=>n.type==='AssignmentExpression'&&name(n.left)==='searchOptions'&&n.right.type==='ObjectExpression'),'native option assignment').right),fields={}
 for(const[key,node]of Object.entries(mapping)){
  if(node.type==='Literal'){fields[key]={kind:'literal',value:node.value};continue}
  let call=node
  if(node.type==='ConditionalExpression'){need(equivalent(node.test,"typeof filterQuery != 'undefined'")&&node.alternate?.type==='Literal'&&node.alternate.value===null,'native optional filter declaration changed');call=node.consequent}
  if(call.type==='CallExpression'&&['intOrDefault','stringOrDefault','floatOrDefault'].includes(name(call.callee))){need(call.arguments.length===2&&['query','filterQuery'].includes(name(call.arguments[0]))&&typeof call.arguments[1]?.value==='string','native attribute field binding changed');fields[key]={kind:'field',scope:name(call.arguments[0])==='query'?'results':'filters',name:call.arguments[1].value,type:name(call.callee).replace('OrDefault','')};continue}
  if(member(node,'query','showRadius')){fields[key]={kind:'data',scope:'results',name:'showRadius'};continue}
  if(node.type==='CallExpression'&&node.arguments.length===0&&['facetFilters','staticFacets','appliedKeywordFilters'].includes(name(node.callee))){fields[key]={kind:name(node.callee)};continue}
  if(node.type==='CallExpression'&&node.arguments.length===1&&typeof node.arguments[0]?.value==='string'&&node.callee?.type==='MemberExpression'&&name(node.callee.property)==='attr'&&equivalent(node.callee.object,'$(ids.filterPanel)')){fields[key]={kind:'attribute',scope:'filters',name:node.arguments[0].value};continue}
  need(false,'unreviewed native field expression '+key)
 }
 need(fields.CurrentPage?.name==='currentPage'&&fields.FacetFilters?.kind==='facetFilters'&&fields.SearchResultsModuleName?.name==='searchResultsModuleName','native pagination/country field declaration missing')
 const search=variable(tree,'search');need(search?.type==='FunctionExpression'&&[variable(tree,'searchAction'),variable(tree,'ajaxUrl'),ajax].every(n=>n.start>=search.start&&n.end<=search.end),'native request declarations disconnected from active search')
 const templates={createFilter:"function(){var checkbox=$(this).data();return{ID:checkbox.id,FacetType:checkbox.facetType,Count:checkbox.count,Display:checkbox.display,IsApplied:$(this).is(':checked'),FieldName:checkbox.fieldName}}",facetFilters:"function(){var filters=$(classes.filterCheckbox+':checked:not(:disabled)').map(createFilter).get();if(searchOptions.StaticFacets!=null)return filters.concat(searchOptions.StaticFacets);else return filters;}",intOrDefault:"function(object,property){return typeof object[property]=='undefined'||isNaN(parseInt(object[property]))?defaultValues[capitalizeProperty(property)]:parseInt(object[property])}",stringOrDefault:"function(object,property){return typeof object[property]=='undefined'||object[property].length<=0?defaultValues[capitalizeProperty(property)]:object[property].toString()}",floatOrDefault:"function(object,property){return typeof object[property]=='undefined'||isNaN(parseFloat(object[property]))?defaultValues[capitalizeProperty(property)]:parseFloat(object[property]).toFixed(5)}"}
 for(const[key,template]of Object.entries(templates))need(isDeepStrictEqual(alpha(variable(tree,key)),alpha(expression(template))),'native selected-facet/attribute conversion semantics changed: '+key)
 const derived=one(walk(mapFn,n=>n.type==='AssignmentExpression'&&member(n.left,'searchOptions','TotalContentPages')),'derived content pagination');need(equivalent(derived.right,'Math.ceil(searchOptions.TotalContentResults / searchOptions.RecordsPerPage)'),'native derived pagination semantics changed')
 const core=ast(coreProgram),serializer=one(walk(core,n=>n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&name(n.left.property)==='bindQueryParams'&&n.right?.type==='FunctionExpression'),'public GET serializer export').right
 const call=one(walk(serializer,n=>n.type==='ForInStatement'&&n.body?.type==='ExpressionStatement'&&n.body.expression?.type==='CallExpression'&&n.body.expression.callee?.type==='Identifier'),'export-to-nested-binder invocation').body.expression,binderName=name(call.callee)
 const bind=one(walk(core,n=>n.type==='FunctionDeclaration'&&name(n.id)===binderName),'connected nested public GET binder')
 need(isDeepStrictEqual(alpha(bind),alpha(ast(binderTemplate).body[0])),'native nested GET binder semantics changed')
 need(isDeepStrictEqual(alpha(serializer,{[binderName]:'nativeNestedBinder'}),alpha(expression(serializerTemplate),{buildQueryParams:'nativeNestedBinder'})),'native connected GET serializer semantics changed')
 return{defaults,fields,resultScope:ids.resultListWrap,filterScope:ids.filterPanel,method:'GET',rendererExecuted:false,wholeBuildPinned:false}
}
// Read the mapper and connected native serializer rather than omit a newly
// authored field. Only the ordinary single India checkbox is selected here.
export function currentTalentBrewCriteria(protocol,results,filters,facet){
 const dataName=name=>'data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),read=(scope,name)=>(scope==='results'?results:filters)[dataName(name)],criteria={}
 for(const[key,field]of Object.entries(protocol.fields)){
  if(['TotalPages','TotalResults','StaticFacets'].includes(key))continue
  if(field.kind==='field'){const value=read(field.scope,field.name),fallback=protocol.defaults[field.name[0].toUpperCase()+field.name.slice(1)];criteria[key]=field.type==='int'?Number.isFinite(parseInt(value,10))?parseInt(value,10):fallback:field.type==='float'?Number.isFinite(parseFloat(value))?parseFloat(value).toFixed(5):fallback:value?.length?value:fallback}
  else if(field.kind==='literal')criteria[key]=field.value
  else if(field.kind==='data'){const value=read(field.scope,field.name);criteria[key]=value==='true'?true:value==='false'?false:value==='null'?null:value}
  else if(field.kind==='attribute')criteria[key]=filters[field.name]
  else if(field.kind==='facetFilters')criteria[key]=[{ID:Number(facet['data-id']),FacetType:Number(facet['data-facet-type']),Count:Number(facet['data-count']),Display:facet['data-display'],IsApplied:true,FieldName:facet['data-field-name']}]
  else if(field.kind==='appliedKeywordFilters'){criteria[key]=JSON.parse(read('results','refinedKeywords')||'[]');need(Array.isArray(criteria[key])&&criteria[key].every(v=>typeof v==='string'),'native refined keyword descriptor changed')}
  else need(false,'native unreviewed selected-country mapper '+key)
 }
 criteria.ActiveFacetID=Number(facet['data-id']);criteria.CurrentPage=1;criteria.TotalContentPages=Math.ceil(criteria.TotalContentResults/criteria.RecordsPerPage)
 const pairs=[],bind=(key,value)=>{if(Array.isArray(value))value.forEach((part,index)=>bind(key+'['+index+']',part));else if(value&&typeof value==='object')Object.entries(value).forEach(([name,part])=>bind(key+'.'+name,part));else if(value!==null)pairs.push([key,String(value??'')])}
 for(const[key,value]of Object.entries(criteria))bind(key,value)
 return{criteria,parameters:pairs}
}
