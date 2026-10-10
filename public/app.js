import {el, icon, formatMoney, formatTime} from './dom.js';
import {collectibleArt} from './art.js';
import {reviewContent, evidenceMetadata} from './quote-review.js';

const app = document.querySelector('#app');
const state = {config:null, listings:[], listing:null, review:null, order:null, busy:'', notice:null, acknowledgement:false};
const drafts = new Map();
let routeVersion = 0;
let routeAbort;

class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

async function api(path, body, {signal} = {}) {
  const response = await fetch(path, {
    method:body === undefined ? 'GET' : 'POST', credentials:'same-origin', signal,
    headers:body === undefined ? {Accept:'application/json'} : {Accept:'application/json', 'Content-Type':'application/json', 'X-CSRF-Token':state.config?.csrfToken || ''},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  let data;
  try { data = await response.json(); } catch { throw new ApiError('The server returned an unreadable response. No payment status has been assumed.', 'INVALID_RESPONSE', response.status); }
  if (!response.ok) throw new ApiError(data.error?.message || 'The request could not be completed.', data.error?.code || 'REQUEST_FAILED', response.status);
  return data;
}

function remember(key, value) { try { sessionStorage.setItem(`second-look:${key}`, value); } catch {} }
function remembered(key) { try { return sessionStorage.getItem(`second-look:${key}`); } catch { return null; } }
function routeUrl(params = {}) {
  const search = new URLSearchParams(params).toString();
  return search ? `/?${search}` : '/';
}
function navigate(params = {}) {
  history.pushState({}, '', routeUrl(params));
  loadRoute();
}
function link(text, params = {}, attributes = {}) {
  return el('a', {href:routeUrl(params), ...attributes, on:{click:event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(params);
    }
  }}}, text);
}
function button(text, action, attributes = {}) {
  return el('button', {type:'button', ...attributes, on:{click:action}}, text);
}
function notice(kind, title, message) {
  return el('div', {className:`notice ${kind}`, role:kind === 'error' ? 'alert' : 'status'},
    icon(kind === 'success' ? 'check' : 'warning'), el('div', {}, el('strong', {}, title), el('p', {}, message)));
}
function showError(error) {
  const stale=['STALE_REVIEW','STALE_LISTING'].includes(error.code);
  state.notice = {kind:'error', title:stale ? 'This review needs another look' : 'We could not complete that step', message:error.message};
  if (stale && state.review) { state.review.stale = true; state.acknowledgement = false; }
}
function draftDiffers(review) {
  if(!review) return false;
  const requirements=(drafts.get(review.listingId) || review.requirements).map(value=>value.trim()).filter(Boolean);
  return requirements.length!==review.requirements.length || requirements.some((value,index)=>value!==review.requirements[index]);
}
function updateDraftControls() {
  const dirty=draftDiffers(state.review);
  const draftNote=document.getElementById('draft-note'); if(draftNote)draftNote.hidden=!dirty;
  const ack=document.getElementById('review-acknowledgement');if(ack)ack.disabled=dirty || state.review.stale || Boolean(state.busy);
  const confirm=document.getElementById('confirm-review');if(confirm)confirm.disabled=dirty || !state.acknowledgement || state.review.stale || Boolean(state.busy);
  const checkout=document.getElementById('create-checkout');if(checkout)checkout.disabled=dirty || !state.review.confirmedAt || state.review.stale || Boolean(state.busy) || !state.config.paypal.configured;
}
function loading(title = 'Opening the shop…', detail = 'Loading the current server state.') {
  return el('div', {className:'loading-view', role:'status'}, el('span', {className:'spinner', 'aria-hidden':'true'}), el('h1', {}, title), el('p', {}, detail));
}
function focusSection(id) { requestAnimationFrame(() => document.getElementById(id)?.focus({preventScroll:true})); }

function shell(content) {
  const restoreMainFocus=document.activeElement?.id==='main';
  const brand = state.config?.brand || {name:'Second Look', merchant:'Demo shop'};
  const receiptId = remembered('last-order');
  app.replaceChildren(
    el('div', {className:'environment-bar'}, el('div', {className:'container environment-inner'},
      el('span', {}, 'Local prototype · synthetic listings'),
      el('span', {className:state.config?.paypal.configured ? 'environment-status enabled' : 'environment-status'}, state.config?.paypal.configured ? 'PayPal sandbox configured' : 'PayPal sandbox not configured'))),
    el('header', {className:'site-header'}, el('div', {className:'container header-inner'},
      link([icon('mark'), el('span', {}, brand.name)], {}, {className:'wordmark', 'aria-label':`${brand.name} shop`}),
      el('nav', {'aria-label':'Main navigation'}, link('The shop', {}, {className:'nav-link'}), receiptId ? link('Latest checkout', {order:receiptId}, {className:'nav-link'}) : null,
        el('span', {className:'merchant-name'}, brand.merchant)))),
    el('main', {id:'main', className:'container main-content', tabindex:'-1'}, state.notice ? notice(state.notice.kind,state.notice.title,state.notice.message) : null, content),
    el('footer', {className:'site-footer'}, el('div', {className:'container footer-inner'},
      el('p', {}, `${brand.name} is a working title. All products and listings in this demo are fictional.`),
      el('p', {}, 'Seller statements only. No authentication, valuation, or proof of truth.'))));
  if(restoreMainFocus)focusSection('main');
}

function renderCatalogue() {
  const grid = el('div', {className:'catalogue-grid'});
  for (const listing of state.listings) {
    grid.append(el('article', {className:'product'},
      link(collectibleArt(listing.art), {listing:listing.id}, {className:'product-art-link', 'aria-label':`Review ${listing.title}`, 'data-testid':`listing-${listing.id}`}),
      el('div', {className:'product-copy'},
        el('div', {className:'product-title-row'}, el('h3', {}, link(listing.title,{listing:listing.id})), el('span', {className:'product-price'},formatMoney(listing.priceCents,listing.currency))),
        el('p', {className:'product-subtitle'}, listing.subtitle),
        link(['Review listing', icon('arrow')], {listing:listing.id}, {className:'text-action'}))));
  }
  shell(el('div', {},
    el('section', {className:'shop-intro', 'aria-labelledby':'shop-heading'},
      el('div', {className:'intro-copy'}, el('h1', {id:'shop-heading'}, 'A second look', el('br'), 'before checkout.'),
        el('p', {className:'intro-description'}, 'Tell us what matters. Read suggested seller quotes in the full listing, decide what to ask, and make your own assessment.'),
        el('p', {className:'intro-note'}, 'A small collection. A more considered purchase.')),
      el('ol', {className:'workflow', 'aria-label':'How the demo works'},
        el('li', {}, el('span', {className:'step-number'},'01'), el('div', {},el('strong', {},'Choose a collectible'), el('p', {},'Six original fictional boxed objects.'))),
        el('li', {}, el('span', {className:'step-number'},'02'), el('div', {},el('strong', {},'Read quotes in context'), el('p', {},'Suggested excerpts and questions beside your requirements.'))),
        el('li', {}, el('span', {className:'step-number'},'03'), el('div', {},el('strong', {},'Make your own decision'), el('p', {},'Your judgment comes before PayPal sandbox approval.'))))),
    el('section', {className:'catalogue', 'aria-labelledby':'catalogue-heading'},
      el('div', {className:'section-heading'}, el('h2', {id:'catalogue-heading'}, 'The collection'), el('p', {},'Synthetic listings · USD')),
      grid),
    el('aside', {className:'statement-band'}, icon('box'), el('p', {},el('strong', {},'The full listing is the source. '), 'AI suggests excerpts and questions. Only you decide whether the seller text addresses your requirements. Illustrations are decorative; neither the text nor the suggestions authenticate the collectible.'))));
}

function sellerListing(listing) {
  return el('section', {className:'seller-listing', 'aria-labelledby':'seller-heading'},
    el('div', {className:'section-heading small'}, el('h2', {id:'seller-heading'},'Current merchant listing'), el('span', {className:'quiet-label'},`Version ${listing.version} · synthetic`)),
    el('p', {className:'seller-description', 'data-testid':'seller-description'},listing.description),
    el('p', {className:'fine-print'},'Unverified seller statements. Original illustration above is not evidence of edition, contents, packaging, or condition.'));
}

function merchantEditor(listing) {
  const description = el('textarea', {id:'merchant-description', name:'description', rows:'7', maxlength:'2400', required:true, value:listing.description});
  const price = el('input', {id:'merchant-price', name:'price', type:'text', inputmode:'decimal', required:true, value:(listing.priceCents/100).toFixed(2), pattern:'[0-9]+(\\.[0-9]{1,2})?', 'aria-describedby':'merchant-price-help'});
  const form = el('form', {className:'merchant-form', on:{submit:async event => {
    event.preventDefault();
    if (state.busy) return;
    const priceText = price.value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(priceText)) { state.notice={kind:'error',title:'Enter a valid price',message:'Use a positive USD amount with at most two decimal places.'}; renderDetail(); return; }
    const [whole, fraction=''] = priceText.split('.');
    const priceCents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if (!Number.isSafeInteger(priceCents) || priceCents < 1) { state.notice={kind:'error',title:'Enter a valid price',message:'The price must be a positive USD amount.'}; renderDetail(); return; }
    const version = routeVersion;
    state.busy='merchant'; renderDetail();
    try {
      const result = await api(`/api/merchant/listings/${encodeURIComponent(listing.id)}`, {description:description.value, priceCents, expectedVersion:listing.version});
      if (version !== routeVersion) return;
      state.listing=result.listing;
      if (state.review) {
        state.review={...state.review,stale:true};
        state.acknowledgement=false;
        const {review}=await api(`/api/reviews/${encodeURIComponent(state.review.id)}`);
        if(version!==routeVersion)return;
        state.review=review;
      }
      state.acknowledgement=false;
      state.notice={kind:'success',title:'Listing updated',message:`Version ${result.listing.version} is now current. Review the changed listing and approve it again before starting checkout.`};
    } catch (error) { if (version === routeVersion) showError(error); }
    finally { if (version === routeVersion) {state.busy=''; renderDetail();} }
  }}},
    el('p', {},'Controlled local merchant edit. Applying a change creates a new listing version and invalidates previous review and buyer approval.'),
    el('label', {for:'merchant-description'},'Seller description'), description,
    el('label', {for:'merchant-price'},'Price in USD'), price,
    el('p', {id:'merchant-price-help',className:'fine-print'},'The server owns the price. Buyer requests never send a price.'),
    el('button', {id:'save-merchant-edit',type:'submit',className:'button secondary',disabled:Boolean(state.busy)},state.busy==='merchant'?'Applying edit…':'Apply merchant edit'));
  return el('details', {id:'merchant-editor',className:'merchant-editor'},el('summary', {},'Merchant edit demonstration',icon('chevron')),form);
}

function requirementsForm(listing) {
  const values = drafts.get(listing.id) || state.review?.requirements || ['Original edition','Complete contents','Original box and manual'];
  const fields = [0,1,2].map(index => el('div', {className:'requirement-field'},
    el('label', {for:`requirement-${index+1}`}, `Requirement ${index+1}`, index ? el('span',{},'optional') : null),
    el('input', {id:`requirement-${index+1}`,name:`requirement-${index+1}`,type:'text',maxlength:'160',required:index===0,value:values[index]||'',placeholder:index===0?'For example, original edition':'Add a requirement', on:{input:event=> {
      const current = [1,2,3].map(n=>document.getElementById(`requirement-${n}`)?.value || ''); drafts.set(listing.id,current);
      if (state.review) updateDraftControls();
    }}})));
  return el('section', {className:'requirement-section', 'aria-labelledby':'requirements-heading'},
    el('h2', {id:'requirements-heading',tabindex:'-1'}, 'What matters to you?'),
    el('p', {className:'section-description'},'State up to three requirements. The local model suggests seller quotes and neutral questions to help you read the full listing.'),
    el('form', {id:'requirement-form',on:{submit:async event=> {
      event.preventDefault();
      if(state.busy) return;
      const requirements=[1,2,3].map(n=>document.getElementById(`requirement-${n}`).value.trim()).filter(Boolean);
      drafts.set(listing.id,requirements);
      const version=routeVersion;
      state.busy='analysis'; state.notice=null; renderDetail();
      try {
        const {review}=await api('/api/reviews',{listingId:listing.id, requirements});
        if(version!==routeVersion) return;
        state.review=review;state.listing=review.snapshot;state.acknowledgement=false;
        remember('last-review',review.id);
        history.replaceState({},'',routeUrl({listing:listing.id,review:review.id}));
      } catch(error) {if(version===routeVersion) showError(error);}
      finally {if(version===routeVersion) {state.busy='';renderDetail();focusSection(state.review?'evidence-heading':'requirements-heading');}}
    }}}, fields,
      state.review?el('p', {id:'draft-note',className:'draft-note',hidden:!draftDiffers(state.review)},'Edited requirements need a new review. Confirmation and checkout are disabled while your inputs differ from the saved requirements below.'):null,
      el('button', {id:'analyze-button',type:'submit',className:'button primary full',disabled:Boolean(state.busy)},state.busy==='analysis'?['Finding seller quotes…',el('span',{className:'spinner small','aria-hidden':'true'})]:[state.review?'Find quotes again':'Find seller quotes',icon('arrow')]),
      state.busy==='analysis'?el('p',{className:'fine-print live-message',role:'status'},'The local model is reading the listing. Its first request can take about a minute. You can leave this page; no checkout starts automatically.'):el('p',{className:'fine-print'},'Local Qwen model · text only · no autonomous purchasing')));
}

function reviewedEvidence(review) {
  return el('section', {className:'evidence-section','aria-labelledby':'evidence-heading'},
    el('div',{className:'section-heading small'},el('h2',{id:'evidence-heading',tabindex:'-1'},'Read the quotes. Make your own assessment.'),el('span',{className:'quiet-label'},`Saved version ${review.listingVersion}`)),
    el('p',{className:'seller-warning'},'AI suggests seller excerpts and questions. Exact quotation checks establish source integrity only, not relevance, completeness, authenticity, or truth. Read the complete saved listing before making your own decision.'),
    review.stale?notice('error','This review is out of date','The merchant changed this listing. The evidence below is preserved for the previous version. Run another review and approve the new version before checkout.'):null,
    reviewContent({analysis:review.analysis,requirements:review.requirements,snapshot:review.snapshot,listingVersion:review.listingVersion}),
    evidenceMetadata(review.analysis,review.createdAt),
    approvalControls(review));
}

function approvalControls(review) {
  const listing=review.snapshot;
  const disabled=review.stale || draftDiffers(review) || Boolean(state.busy);
  const confirmed=Boolean(review.confirmedAt) && !review.stale;
  return el('section',{className:'approval-section','aria-labelledby':'approval-heading'},
    el('h3',{id:'approval-heading',tabindex:'-1'},'Save your own review decision'),
    el('div',{className:'review-price'},el('div',{},el('span',{className:'quiet-label'},'Reviewed snapshot'),el('strong',{},listing.title)),el('strong',{className:'review-amount'},formatMoney(listing.priceCents,listing.currency))),
    confirmed?el('div',{className:'confirmed-note',role:'status'},icon('check'),el('p',{},el('strong',{},'Your acknowledgement is saved. '),`You recorded your own review at ${formatTime(review.confirmedAt)}.`)):
      el('label',{className:'acknowledgement',for:'review-acknowledgement'},
        el('input',{id:'review-acknowledgement',type:'checkbox',checked:state.acknowledgement,disabled,on:{change:event=> {
          state.acknowledgement=event.target.checked;
          const confirm=document.getElementById('confirm-review'); if(confirm) confirm.disabled=!state.acknowledgement || disabled;
        }}}),el('span',{},'I reviewed each requirement against the full saved seller text and any suggested quotes and questions. I understand source checks do not verify relevance, completeness, authenticity, or truth. This confirmation records my own decision.')),
    confirmed?null:button(state.busy==='confirm'?'Saving your review…':'Save my review decision',async()=> {
      if(!state.acknowledgement || disabled || draftDiffers(state.review)) return;
      const version=routeVersion;state.busy='confirm';state.notice=null;renderDetail();
      try {const result=await api(`/api/reviews/${encodeURIComponent(review.id)}/confirm`,{acknowledged:true});if(version===routeVersion)state.review=result.review;}
      catch(error){if(version===routeVersion)showError(error);}
      finally{if(version===routeVersion){state.busy='';renderDetail();focusSection('approval-heading');}}
    },{id:'confirm-review',className:'button secondary full',disabled:!state.acknowledgement || disabled}),
    button([state.busy==='checkout'?'Preparing checkout…':'Continue to PayPal sandbox',icon('external')],async()=> {
      if(!confirmed || disabled || draftDiffers(state.review) || !state.config.paypal.configured)return;
      const version=routeVersion;state.busy='checkout';state.notice=null;renderDetail();
      try {const {order}=await api('/api/orders',{reviewId:review.id});if(version===routeVersion){remember('last-order',order.id);navigate({order:order.id});}}
      catch(error){if(version===routeVersion)showError(error);}
      finally{if(version===routeVersion){state.busy='';renderDetail();}}
    },{id:'create-checkout',className:'button paypal full',disabled:!confirmed || disabled || !state.config.paypal.configured}),
    !state.config.paypal.configured?el('p',{className:'checkout-note'},state.config.paypal.message || 'PayPal sandbox checkout is disabled. Secure sandbox credentials and approval are required before a payment can be made.'):
      el('p',{className:'fine-print'},'You will approve separately on PayPal’s sandbox. Only a verified server capture can mark an order completed.'));
}

function renderDetail() {
  const listing=state.listing;
  if(!listing)return;
  shell(el('div', {className:'detail-page'},
    link([icon('back'),'Back to the collection'],{}, {className:'back-link'}),
    el('div',{className:'detail-grid'},
      el('div',{className:'listing-column'},
        el('div',{className:'detail-art'},collectibleArt(listing.art,{large:true})),
        el('p',{className:'art-caption'},'Original illustration · fictional collectible · not evidence'),
        el('div',{className:'detail-title'},el('div',{},el('h1',{},listing.title),el('p',{className:'detail-subtitle'},listing.subtitle)),el('span',{className:'detail-price'},formatMoney(listing.priceCents,listing.currency))),
        sellerListing(listing),merchantEditor(listing)),
      el('div',{className:'review-column'},requirementsForm(listing),state.review?reviewedEvidence(state.review):el('div',{className:'review-empty'},el('span',{className:'empty-rule'}),el('p',{},'Suggested seller quotes and neutral questions will appear beside your requirements. You judge them against the complete listing.'))))));
}

const orderStatus = {
  completed:{heading:'Sandbox capture completed',description:'The server verified a completed PayPal sandbox capture. This receipt preserves what you reviewed.',tone:'success'},
  cancelled:{heading:'Checkout cancelled',description:'No completed capture is recorded. The reviewed snapshot is preserved below.',tone:'neutral'},
  canceled:{heading:'Checkout cancelled',description:'No completed capture is recorded. The reviewed snapshot is preserved below.',tone:'neutral'},
  stale:{heading:'Listing changed before checkout',description:'This checkout belongs to an old listing version. Review the latest listing and approve it again.',tone:'error'},
  pending:{heading:'Capture is pending',description:'PayPal has not confirmed a completed capture. Do not assume payment succeeded. Check the provider status before taking another step.',tone:'pending'},
  ambiguous:{heading:'Checkout status is uncertain',description:'The provider response was inconclusive. Check PayPal status before taking another step; do not start another purchase.',tone:'pending'},
  failed:{heading:'Checkout was not completed',description:'The server has no verified completed capture for this order. Check the status before retrying.',tone:'error'},
  approved:{heading:'Approval received; capture not confirmed',description:'Buyer approval and completed capture are separate steps. Explicitly request capture below when you are ready.',tone:'neutral'},
  created:{heading:'Ready for PayPal approval',description:'The sandbox order is prepared. Continue to PayPal to approve, then return here to request capture.',tone:'neutral'},
  awaiting_approval:{heading:'Ready for PayPal approval',description:'The sandbox order is prepared. Continue to PayPal to approve, then return here to request capture.',tone:'neutral'},
  capture_in_progress:{heading:'Capture is in progress',description:'A capture request is in progress. No completed capture is assumed. Check PayPal status before taking another step.',tone:'pending'},
  refunded:{heading:'Sandbox capture was refunded',description:'The server recorded a refunded PayPal sandbox capture. This receipt preserves the reviewed listing and latest recorded capture status.',tone:'neutral'},
};

async function orderAction(action) {
  if(state.busy)return;
  const order=state.order;
  const version=routeVersion;
  state.busy=action;state.notice=null;renderReceipt();
  try {const result=await api(`/api/orders/${encodeURIComponent(order.id)}/${action}`,{});if(version===routeVersion)state.order=result.order;}
  catch(error){if(version===routeVersion)showError(error);}
  finally{if(version===routeVersion){state.busy='';renderReceipt();focusSection('receipt-heading');}}
}

function receiptActions(order, callback) {
  const terminal=['completed','cancelled','canceled','stale','refunded','failed'].includes(order.status);
  const uncertain=['pending','ambiguous','capturing','capture_in_flight','capture_in_progress','creating'].includes(order.status);
  const canCapture=!terminal && !uncertain && !order.stale && (callback==='return' || order.status==='approved' || (order.status==='awaiting_approval' && order.providerOrderStatus==='APPROVED'));
  const approve=order.approvalUrl && !terminal && !uncertain && !order.stale;
  const configured=state.config.paypal.configured;
  let safeApprovalUrl;
  if(approve){try{const url=new URL(order.approvalUrl);if(url.protocol==='https:' && url.hostname==='www.sandbox.paypal.com')safeApprovalUrl=url.href;}catch{}}
  return el('div',{className:'receipt-actions'},
    order.verificationIssue?notice('error','Latest provider verification needs attention',order.message || 'The latest provider response could not be verified. A previous verified capture status is preserved, but this warning remains unresolved. Check PayPal status before relying on the receipt.'):null,
    order.stale && order.status!=='stale'?notice('error','This checkout uses an older listing','The merchant changed the listing. Capture is blocked. Review the current listing and approve it again.'):null,
    callback==='return' && !terminal?notice('neutral','You returned from PayPal','The URL is not proof of buyer approval or payment. The server checks provider state when you request capture or check status.'):null,
    callback==='cancel' && !terminal?notice('neutral','You returned through the cancel link','No capture is assumed. Record cancellation below, or check PayPal status if you are unsure.'):null,
    safeApprovalUrl && callback!=='return'?el('a',{className:'button paypal',href:safeApprovalUrl,rel:'noreferrer',id:'paypal-approval-link'},'Approve on PayPal sandbox',icon('external')):null,
    canCapture?button([state.busy==='capture'?'Checking approval and capturing…':'Capture approved sandbox order',icon('check')],()=>orderAction('capture'),{id:'capture-order',className:'button primary',disabled:Boolean(state.busy)||!configured}):null,
    order.paypalOrderId?button([state.busy==='reconcile'?'Checking PayPal status…':'Check PayPal status',icon('refresh')],()=>orderAction('reconcile'),{id:'reconcile-order',className:'button secondary',disabled:Boolean(state.busy)||!configured}):null,
    !terminal && !uncertain?button(state.busy==='cancel'?'Recording cancellation…':'Cancel this checkout',()=>orderAction('cancel'),{id:'cancel-order',className:'button quiet',disabled:Boolean(state.busy)}):null,
    order.status==='stale' || order.stale?link(['Review current listing',icon('arrow')],{listing:order.listingId},{className:'button primary'}):null,
    !configured?el('p',{className:'checkout-note'},el('strong',{},'PayPal sandbox is not configured. '),'No provider action is available. This is a saved order state, not a payment confirmation.'):null,
    state.busy?el('p',{role:'status',className:'fine-print'},'Please wait for the server. Repeated clicks are disabled; payment state comes from the provider.'):null);
}

function renderReceipt() {
  const order=state.order;
  if(!order)return;
  const callback=new URLSearchParams(location.search).get('checkout');
  const status=order.verificationIssue && order.status==='completed'?
    {heading:'Previously verified capture needs attention',description:'A completed sandbox capture was previously verified. The latest provider check raised an issue; read the warning and check PayPal status before relying on this receipt.',tone:'pending'}:
    orderStatus[order.status] || {heading:'Checkout state needs review',description:'No completed capture has been verified. Check the server and provider state before proceeding.',tone:'pending'};
  const snapshot=order.snapshot;
  shell(el('div',{className:'receipt-page'},
    link([icon('back'),'Back to the collection'],{}, {className:'back-link'}),
    el('section',{className:`receipt-heading ${status.tone}`},
      el('div',{className:'receipt-status-mark'},icon(order.status==='completed'?'check':status.tone==='error'?'warning':'box')),
      el('div',{},el('h1',{id:'receipt-heading',tabindex:'-1'},status.heading),el('p',{},status.description))),
    receiptActions(order,callback),
    el('div',{className:'receipt-grid'},
      el('section',{className:'receipt-summary','aria-labelledby':'snapshot-heading'},
        el('div',{className:'receipt-art'},collectibleArt(snapshot.art)),el('h2',{id:'snapshot-heading'},'Your reviewed snapshot'),el('h3',{},snapshot.title),el('p',{className:'detail-subtitle'},snapshot.subtitle),
        el('dl',{className:'receipt-data'},
          el('div',{},el('dt',{},'Server amount'),el('dd',{},formatMoney(order.amountCents,order.currency))),
          el('div',{},el('dt',{},'Listing version'),el('dd',{},String(snapshot.version))),
          el('div',{},el('dt',{},'Local checkout state'),el('dd',{'data-testid':'checkout-state'},order.status)),
          el('div',{},el('dt',{},'PayPal order status'),el('dd',{'data-testid':'provider-order-status'},order.providerOrderStatus || 'Not recorded')),
          el('div',{},el('dt',{},'Actual capture status'),el('dd',{'data-testid':'actual-capture-status'},order.captureStatus || 'No capture recorded')),
          el('div',{},el('dt',{},'Provider'),el('dd',{},'PayPal sandbox')),
          el('div',{},el('dt',{},'Capture ID'),el('dd',{},order.captureId || 'No capture recorded')),
          el('div',{},el('dt',{},'Local order'),el('dd',{className:'mono'},order.id)),
          el('div',{},el('dt',{},'PayPal order'),el('dd',{className:'mono'},order.paypalOrderId || 'Not created')),
          el('div',{},el('dt',{},'Last updated'),el('dd',{},formatTime(order.updatedAt)))),
        order.message?el('p',{className:'provider-message'},order.message):null,
        el('p',{className:'fine-print'},'Receipt state is read from the server. Browser callbacks cannot mark a payment completed.')),
      el('div',{className:'receipt-evidence'},el('h2',{},'Your saved seller review'),el('p',{className:'seller-warning'},'Seller statements and suggested excerpts are unverified. Source integrity checks do not establish relevance, completeness, authenticity, or truth; your acknowledgement records your own judgment.'),
        reviewContent({analysis:order.analysis,requirements:order.requirements,snapshot,listingVersion:snapshot.version}),
        evidenceMetadata(order.analysis),
        el('p',{className:'fine-print'},'The full seller text, requirements, suggestions, and server price snapshot are preserved even if the current listing changes.')))));
}

async function loadRoute() {
  const version=++routeVersion;
  routeAbort?.abort(); routeAbort=new AbortController();
  const signal=routeAbort.signal;
  state.busy='';state.notice=null;state.listing=null;state.review=null;state.order=null;state.acknowledgement=false;
  shell(loading());
  window.scrollTo({top:0,behavior:'instant'});
  try {
    const {config}=state;
    if(!config) state.config=await api('/api/config',undefined,{signal});
    if(version!==routeVersion)return;
    document.title=`${state.config.brand.name} — seller quote review`;
    const params=new URLSearchParams(location.search);
    const orderId=params.get('order');
    const reviewId=params.get('review');
    let listingId=params.get('listing');
    if(orderId){
      const {order}=await api(`/api/orders/${encodeURIComponent(orderId)}`,undefined,{signal});
      if(version!==routeVersion)return;
      state.order=order;remember('last-order',order.id);renderReceipt();
    }else{
      if(reviewId){const {review}=await api(`/api/reviews/${encodeURIComponent(reviewId)}`,undefined,{signal});if(version!==routeVersion)return;state.review=review;listingId=review.listingId;remember('last-review',review.id);}
      if(listingId){const {listing}=await api(`/api/listings/${encodeURIComponent(listingId)}`,undefined,{signal});if(version!==routeVersion)return;state.listing=listing;renderDetail();}
      else{const {listings}=await api('/api/listings',undefined,{signal});if(version!==routeVersion)return;state.listings=listings;renderCatalogue();}
    }
  }catch(error){
    if(error.name==='AbortError' || version!==routeVersion)return;
    showError(error);
    shell(el('section',{className:'error-page'},el('h1',{},'This page could not be opened'),el('p',{},'No payment state has been changed.'),button(['Try again',icon('refresh')],loadRoute,{className:'button secondary'}),link('Return to the shop',{}, {className:'text-action'})));
  }
}

document.querySelector('.skip-link')?.addEventListener('click',event=> {
  event.preventDefault();
  history.replaceState(history.state,'',`${location.pathname}${location.search}#main`);
  const main=document.getElementById('main');
  main?.focus({preventScroll:true});
  main?.scrollIntoView({behavior:'instant',block:'start'});
});
window.addEventListener('popstate',loadRoute);
window.addEventListener('pageshow',event=>{if(event.persisted)loadRoute();});
loadRoute();
