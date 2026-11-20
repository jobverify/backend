import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
const need=(ok,message)=>{if(!ok)throw Error('Current Beiersdorf native GET protocol: '+message)},one=(rows,label)=>{need(rows.length===1,'unique '+label+' changed');return rows[0]}
const name=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const member=(n,object,property)=>n?.type==='MemberExpression'&&!n.computed&&name(n.object)===object&&name(n.property)===property
const walk=(n,predicate,out=[],depth=0)=>{need(depth<=120,'programme depth');if(!n||typeof n!=='object')return out;if(predicate(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const child of Array.isArray(v)?v:[v])walk(child,predicate,out,depth+1);return out}
const ast=raw=>{try{return parse(raw,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'unparseable declared programme')}}
const expression=raw=>ast('('+raw+')').body[0].expression
function alpha(fn,external={}){const bindings=new Map();for(const n of walk(fn,n=>n.type==='FunctionDeclaration'||n.type==='FunctionExpression'||n.type==='VariableDeclarator')){const ids=n.type==='VariableDeclarator'?[n.id]:[n.id,...n.params];for(const id of ids)if(id?.type==='Identifier'&&!bindings.has(id.name))bindings.set(id.name,'local'+bindings.size)}for(const[k,v]of Object.entries(external))if(!bindings.has(k))bindings.set(k,v);const visit=(n,parent,key)=>{if(Array.isArray(n))return n.map(x=>visit(x,parent,key));if(!n||typeof n!=='object')return n;const out={};for(const[k,v]of Object.entries(n)){if(['start','end','raw'].includes(k))continue;if(n.type==='Identifier'&&k==='name'&&bindings.has(v)&&!(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)&&!(parent?.type==='Property'&&key==='key'&&!parent.computed))out[k]=bindings.get(v);else out[k]=visit(v,n,k)}return out};return visit(fn,null,null)}
// Alpha-normalized semantics for only the connected filter-to-GET methods.
// These are the actual native parameter/control programme, not whole UI builds.
const templates={
  "action": {
    "getParams": "function(t,e){var r=this.getFilters(),o=this.getSelects(),n=this.getSearchFieldValue(),i={};return r.forEach(function(t){var e=[];t.values.forEach(function(t){t.checked&&e.push(t.key)}),e.length>0&&(i[t.key]=e)}),o.forEach(function(t){null!=t.value&&\"\"!==t.value&&(i[t.key]=[t.value])}),\"\"===n||e||(i.query=[n]),null!=t&&null!=t&&\"\"!==t&&(i.page=[t]),i}",
    "getFilters": "function(){var t=this,e=[];return Array.from(this.element.querySelectorAll(this.options.filterItemSelector)).forEach(function(r){var o=r.dataset.key,n=\"True\"===r.dataset.isAnd,i=\"True\"===r.dataset.isSingleSelect,a=Array.from(r.querySelectorAll(t.options.checkboxSelector)),s=[];a.forEach(function(t){s.push({node:t,key:t.value,checked:t.checked,index:parseInt(t.dataset.index)})});var c={node:r,key:o,values:s,isAnd:n,isSingleSelect:i,cache:[]};e.push(c)}),e}",
    "getSelects": "function(){var t=[];return Array.from(this.element.querySelectorAll(this.options.selectItemSelector)).forEach(function(e){var r=e.dataset.key,o=e.querySelector(\".edd-select\").value;t.push({value:o,key:r,node:e})}),t}",
    "getSearchFieldValue": "function(){var t=this.element.querySelector(this.options.searchFieldSelector);return void 0!==t&&null!=t?t.value:\"\"}",
    "encodeParams": "function(t){return Object.entries(t).map(function(t){var e=a(t,2),r=e[0],o=e[1];return\"\".concat(encodeURIComponent(r),\"=\").concat(o.map(function(t){return encodeURIComponent(t)}).join(\",\"))}).join(\"&\")}",
    "getReloadUrl": "function(){var t=this.encodeParams(this.getParams());return this.ajaxUrl+\"&\"+t}",
    "getPagerUrl": "function(t){var e=this.encodeParams(this.getParams(t));return this.ajaxUrl+\"&\"+e}",
    "reload": "function(){var t=this.getReloadUrl();return this.executeAjax(t),this}",
    "loadPage": "function(t){if(null==t)return this;var e=this.getPagerUrl(t);return this.executeAjax(e),this}"
  },
  "filter": {
    "updateFilterAction": "function(){return this.filterAction.update(),this.filterAction.updateUrl(),this.filterAction.reload(),this}",
    "onFilterChange": "function(e){var t=e.target;this.suppressEvents||(t.closest(this.options.checkboxSelector)||t.closest(this.options.easyDropDownSelector))&&this.updateFilterAction()}"
  }
}

const method=(tree,key)=>one(walk(tree,n=>n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&n.left.object?.property?.name==='prototype'&&name(n.left.property)===key),'native '+key+' method').right
export function readCurrentJobFilterProtocol(action,filter){
 const a=ast(action),f=ast(filter)
 for(const[kinds,tree]of [[templates.action,a],[templates.filter,f]])for(const[key,template]of Object.entries(kinds))need(isDeepStrictEqual(alpha(method(tree,key)),alpha(expression(template))),'native country/filter serialization semantics changed: '+key)
 const execute=method(a,'executeAjax'),param=execute.params[0];need(execute.type==='FunctionExpression'&&execute.params.length===1&&param.type==='Identifier','native query executor input changed')
 const request=one(walk(execute,n=>n.type==='VariableDeclarator'&&n.init?.type==='NewExpression'&&name(n.init.callee)==='XMLHttpRequest'),'native request instance'),url=one(walk(execute,n=>n.type==='VariableDeclarator'&&name(n.init)===param.name),'native request URL binding')
 const open=one(walk(execute,n=>n.type==='CallExpression'&&member(n.callee,request.id.name,'open')),'native request open'),send=one(walk(execute,n=>n.type==='CallExpression'&&member(n.callee,request.id.name,'send')),'native request send')
 need(open.arguments.length===2&&open.arguments[0].value==='GET'&&name(open.arguments[1])===url.id.name&&send.arguments.length===0,'native outgoing GET method/URL disconnected')
 need(walk(a,n=>n.type==='AssignmentExpression'&&n.left?.object?.type==='ThisExpression'&&name(n.left.property)==='ajaxUrl'&&n.right?.type==='MemberExpression'&&name(n.right.property)==='ajaxUrl'&&n.right.object?.property?.name==='dataset'&&n.right.object.object?.property?.name==='filterTag').length===1,'native ajax URL no longer comes from own filter dataset')
 const expected={filterTagSelector:'.cw-tag-filter',filterItemSelector:'.cw-tag-filter__item',selectItemSelector:'.cw-select-single',searchFieldSelector:'.cw-search',checkboxSelector:'.cw-cat-item__tag-value'}
 for(const[key,value]of Object.entries(expected))need(walk(method(a,'getDefaultOptions'),n=>n.type==='Property'&&name(n.key)===key&&n.value?.value===value).length===1,'native descriptor/control selector changed: '+key)
 for(const[key,value]of Object.entries({filterSelector:'.cw-tag-filter',filterItemSelector:'.cw-tag-filter__item',checkboxSelector:'.cw-cat-item__tag-value'}))need(walk(method(f,'getDefaultOptions'),n=>n.type==='Property'&&name(n.key)===key&&n.value?.value===value).length===1,'native selected control ownership changed: '+key)
 return{kind:'nonexecuted-native-connected-checkbox-parameter-serializer-and-GET-programme',evaluated:false,wholeBuildPinned:false,alphaNormalizedDescriptorMethods:Object.keys(templates.action)}
}
export function readCurrentModuleURLs(bundle,origin){
 const tree=ast(bundle),loader=one(walk(tree,n=>n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&name(n.left.property)==='u'&&n.right?.type==='ArrowFunctionExpression'&&walk(n.right,c=>c.type==='Literal'&&c.value==='./modules/').length),'declared module loader'),prefix=one(walk(tree,n=>n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&name(n.left.object)===name(loader.left.object)&&name(n.left.property)==='p'&&n.right?.value==='/dist/bdfcw/'),'connected own bundle public path').right.value,fn=loader.right
 need(fn.params.length===1&&fn.params[0].type==='Identifier','native loader argument changed')
 const evaluate=(node,id,depth=0)=>{need(depth<=24,'native loader expression depth');if(node.type==='Literal'&&typeof node.value==='string')return node.value;if(node.type==='Identifier'&&node.name===fn.params[0].name)return id;if(node.type==='BinaryExpression'&&node.operator==='+')return evaluate(node.left,id,depth+1)+evaluate(node.right,id,depth+1);if(node.type==='LogicalExpression'&&node.operator==='||')return evaluate(node.left,id,depth+1)||evaluate(node.right,id,depth+1);if(node.type==='MemberExpression'&&node.computed&&node.object.type==='ObjectExpression'){const key=evaluate(node.property,id,depth+1),rows=node.object.properties;need(rows.every(p=>p.type==='Property'&&!p.computed&&p.kind==='init'&&p.value.type==='Literal'&&typeof p.value.value==='string'),'nonliteral native module map');const pairs=rows.map(p=>[String(name(p.key)),p.value.value]);need(new Set(pairs.map(([k])=>k)).size===pairs.length,'duplicate native module mapping');return Object.fromEntries(pairs)[key]}need(false,'unreviewed native module loader expression')}
 return Object.fromEntries(['JobFilterAction','JobFilter'].map(module=>{const key=one(walk(fn.body,n=>n.type==='Property'&&n.value?.value===module),'connected '+module+' module').key,id=String(name(key)),path=evaluate(fn.body,id),url=new URL(path,origin+prefix);need(url.origin===origin&&!url.username&&!url.password&&!url.search&&!url.hash&&new RegExp('^/dist/bdfcw/modules/'+module+'[.][a-f0-9]{8}[.]js$').test(url.pathname),'native module URL is not the current own JavaScript chunk');return[module,url.href]}))
}
