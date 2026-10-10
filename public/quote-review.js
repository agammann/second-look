import {el, formatTime} from './dom.js';

const QUOTE_KIND='quote-suggestions';

function sourceSuggestions(result, analysis, description) {
  if(result.validation!=='valid')return {suggestions:[],accepted:false};
  const limit=analysis.evidenceVersion==='2026-10-10-v4'?6:3;
  if(!Array.isArray(result.suggestions) || result.suggestions.length>limit)return {suggestions:[],accepted:false};
  const spans=Array.isArray(analysis.sourceSpans)?analysis.sourceSpans:[];
  const seen=new Set();
  const accepted=result.suggestions.every(suggestion=> {
    if(!suggestion || typeof suggestion.spanId!=='string' || typeof suggestion.quote!=='string' || !suggestion.quote || seen.has(suggestion.spanId))return false;
    seen.add(suggestion.spanId);
    const span=spans.find(source=>source?.id===suggestion.spanId);
    return span?.eligible===true && Number.isInteger(span.start) && Number.isInteger(span.end)
      && span.start>=0 && span.end>span.start && span.end<=description.length
      && span.text===suggestion.quote && description.slice(span.start,span.end)===suggestion.quote;
  });
  return {suggestions:accepted?result.suggestions:[],accepted};
}

function savedSellerText(snapshot, listingVersion) {
  return el('section',{className:'saved-seller-text','aria-labelledby':'saved-seller-heading'},
    el('div',{className:'section-heading small'},el('h3',{id:'saved-seller-heading'},'Full seller text saved for this review'),el('span',{className:'quiet-label'},`Version ${listingVersion ?? snapshot.version}`)),
    el('p',{className:'saved-context-note'},'Read the whole listing to check which item, edition, variant, or component each excerpt refers to. Suggested quotes can omit important limits or context.'),
    el('p',{className:'seller-description','data-testid':'review-snapshot-text'},snapshot.description));
}

function analysisNotices(analysis) {
  const messages=Array.isArray(analysis?.notices)?analysis.notices.filter(value=>typeof value==='string' && value.trim()).slice(0,3).map(value=>value.slice(0,500)):[];
  if(!messages.length)return null;
  return el('aside',{className:'quote-context-notice','data-testid':'evidence-notices','aria-label':'Seller context reminders'},
    el('strong',{},'Keep the full context in view'),el('ul',{},messages.map(message=>el('li',{},message))));
}

function buyerPrompt() {
  return el('div',{className:'buyer-review-prompt'},el('h4',{},'For your review'),el('p',{},'Read the full saved seller text yourself. Decide what it says about your requirement and what you need to ask the merchant. This is a general buyer prompt, not an AI finding.'));
}

function quoteCard(requirement, result, analysis, description, index) {
  const {suggestions,accepted}=sourceSuggestions(result,analysis,description);
  const valid=result.validation==='valid' && accepted;
  const unavailable=result.validation==='unavailable';
  const integrity=unavailable?'Suggestions unavailable':!valid?'Source check failed':suggestions.length?'Source checked':'No quote suggestions';
  const questions=valid && Array.isArray(result.questions)?result.questions.filter(question=>question && typeof question.id==='string' && typeof question.text==='string' && question.text.trim()).slice(0,2):[];
  return el('article',{className:'evidence-card quote-card','data-testid':`evidence-${index+1}`},
    el('div',{className:'evidence-topline'},el('span',{className:'quiet-label'},`Your requirement ${index+1}`),el('span',{className:'integrity-state','data-testid':`suggestion-integrity-${index+1}`},integrity)),
    el('h3',{},requirement),
    suggestions.length?el('div',{className:'source-quotes'},el('span',{className:'quiet-label'},'Suggested seller quotes'),suggestions.map((suggestion,quoteIndex)=>el('blockquote',{'data-testid':`suggested-quote-${index+1}-${quoteIndex+1}`},suggestion.quote)),
      el('p',{className:'quotation-limit'},'Exact quotation checks confirm source integrity only. You decide relevance and completeness; these checks do not verify authenticity or truth.')):
      el('p',{className:'no-quote'},unavailable?'The local model did not provide usable quote suggestions.':valid?'No seller quotes were suggested for this requirement.':'Quote suggestions were withheld because source checks did not pass.'),
    questions.length?el('div',{className:'neutral-questions'},el('h4',{},'Questions to consider'),el('ul',{},questions.map((question,questionIndex)=>el('li',{'data-testid':`neutral-question-${index+1}-${questionIndex+1}`},question.text)))):null,
    !suggestions.length?buyerPrompt():null,
    el('p',{className:`validation-note${valid?'':' attention'}`},el('strong',{},'Source integrity: '),valid && typeof result.reason==='string'?result.reason:
      unavailable?'No source-checked suggestions are available. Read the full seller text.':'The response could not be accepted as source-checked suggestions. Read the full seller text.'));
}

function historicalCard(requirement, result, description, index) {
  const quotes=result?.validation==='valid' && Array.isArray(result.quotes)?result.quotes.filter(quote=>typeof quote==='string' && quote && description.includes(quote)).slice(0,3):[];
  return el('article',{className:'evidence-card historical-card','data-testid':`evidence-${index+1}`},
    el('div',{className:'evidence-topline'},el('span',{className:'quiet-label'},`Saved requirement ${index+1}`),el('span',{className:'integrity-state','data-testid':`suggestion-integrity-${index+1}`},'Historical excerpts')),
    el('h3',{},requirement),
    quotes.length?el('div',{className:'source-quotes'},el('span',{className:'quiet-label'},'Stored seller excerpts from the prior flow'),quotes.map((quote,quoteIndex)=>el('blockquote',{'data-testid':`historical-quote-${index+1}-${quoteIndex+1}`},quote))):el('p',{className:'no-quote'},'No stored seller excerpts are displayed.'),
    el('p',{className:'quotation-limit'},'Read these excerpts against the full saved listing. Past AI conclusions do not determine your assessment.'));
}

export function reviewContent({analysis,requirements,snapshot,listingVersion}) {
  const quoteFirst=analysis?.kind===QUOTE_KIND;
  const results=Array.isArray(analysis?.results)?analysis.results:[];
  return el('div',{className:'quote-review-content'},
    !quoteFirst?el('aside',{className:'historical-notice','data-testid':'historical-analysis'},el('strong',{},'Historical review from a prior flow'),el('p',{},'This saved review uses an earlier format. Stored seller excerpts remain available for reference. Read the full saved seller text and make your own assessment.')):null,
    savedSellerText(snapshot,listingVersion),
    analysisNotices(analysis),
    el('div',{className:'evidence-list'},requirements.map((requirement,index)=>quoteFirst?
      quoteCard(requirement,results[index] || {suggestions:[],questions:[],validation:'invalid'},analysis,snapshot.description,index):
      historicalCard(requirement,results[index],snapshot.description,index))));
}

export function evidenceMetadata(analysis,savedAt) {
  const version=analysis?.evidenceVersion;
  const hasVersion=(typeof version==='string' && version.length>0) || (typeof version==='number' && Number.isFinite(version));
  return el('p',{className:'fine-print evidence-meta'},analysis?.model || 'Local model',
    hasVersion?[' · ',el('span',{'data-testid':'evidence-version'},`Saved analysis version ${version}`)]:null,
    savedAt?` · Review saved ${formatTime(savedAt)}`:null);
}
