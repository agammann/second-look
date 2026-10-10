// Original code-native illustrations. Decorative only: never evidence of contents or condition.
const ns = 'http://www.w3.org/2000/svg';
function shape(tag, attrs, children = []) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
const palette = {
  orbit: {paper:'#e9edf1', front:'#203849', side:'#132838', ink:'#f1d99d', label:'ORBIT', number:'01'},
  moss: {paper:'#e8eee5', front:'#3d5d46', side:'#294433', ink:'#d8e6b3', label:'MOSS', number:'02'},
  tide: {paper:'#e5eeef', front:'#3e6b7c', side:'#2b4f60', ink:'#cee7e9', label:'TIDE', number:'03'},
  atlas: {paper:'#efe9df', front:'#a26f4e', side:'#79503a', ink:'#f4e1bd', label:'ATLAS', number:'04'},
  lumen: {paper:'#f3e9e2', front:'#bc704c', side:'#945035', ink:'#ffdfab', label:'LUMEN', number:'05'},
  kite: {paper:'#eee7e9', front:'#8c4652', side:'#6d303e', ink:'#f4d1bc', label:'KITE', number:'06'},
};

function motif(key, ink) {
  const common = {stroke:ink, 'stroke-width':'2', fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round'};
  const s = (tag, attrs) => shape(tag, {...common, ...attrs});
  if (key === 'moss') return [s('path',{d:'M162 190v-51m0 22c-28-2-39-14-39-35 27 0 40 10 39 35Zm0-6c26-3 36-17 33-39-26 3-38 17-33 39Z'}),s('path',{d:'m136 139 26 22m19-32-19 26'}),s('ellipse',{cx:'161',cy:'194',rx:'27',ry:'5',opacity:'.6'})];
  if (key === 'tide') return [s('path',{d:'M112 163c12-19 24-19 37 0 13 19 26 19 40 0 8-12 17-16 27-10M111 177c12-19 25-19 38 0 13 19 26 19 40 0 8-12 17-16 27-10M119 142c11-5 22-5 33 0m21-23a18 18 0 1 1 30 16'}),s('circle',{cx:'134',cy:'120',r:'5',fill:ink,stroke:'none'})];
  if (key === 'atlas') return [s('path',{d:'m108 184 36-63 22 38 15-22 34 47H108Zm23 0 29-49m5 24 15 25m-43-50 9 6 6-8'}),s('circle',{cx:'184',cy:'111',r:'12'}),s('path',{d:'m184 92 0-5m0 48v-5m-19-19h-5m48 0h-5'})];
  if (key === 'lumen') return [s('path',{d:'M142 190v-54h38v54h-38Zm9-65c-6-14 3-23 10-32 9 12 17 22 9 32-5 5-14 5-19 0Zm0 24h20m-21 25h22m-40 23h59'}),s('path',{d:'m126 114-9-5m78 5 9-5m-43-33V69'})];
  if (key === 'kite') return [s('path',{d:'m160 99 35 35-35 41-35-41 35-35Zm0 0v76m-35-41h70m-35 41c0 12 24 13 20 25-3 10-22 7-19 20'}),s('path',{d:'m162 196 12-6 2 11-14-5Zm-2 18 10-6 3 10-13-4'}),s('path',{d:'M110 116h19m65 58h20'})];
  return [s('circle',{cx:'162',cy:'151',r:'34'}),s('ellipse',{cx:'162',cy:'151',rx:'59',ry:'13',transform:'rotate(-25 162 151)'}),s('path',{d:'m121 101 3-6 3 6 6 3-6 3-3 6-3-6-6-3 6-3Zm77 90 2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z'}),s('circle',{cx:'210',cy:'114',r:'3',fill:ink,stroke:'none'})];
}

export function collectibleArt(key, {large = false} = {}) {
  const p = palette[key] || palette.orbit;
  const svg = shape('svg', {viewBox:'0 0 340 300', class:`collectible-art${large ? ' large' : ''}`, role:'img', 'aria-label':`Original decorative illustration of a fictional ${p.label.toLowerCase()} collectible box. Not evidence.`});
  svg.append(shape('rect',{width:'340',height:'300',fill:p.paper}));
  svg.append(shape('circle',{cx:'277',cy:'53',r:'82',fill:'none',stroke:p.front,opacity:'.08','stroke-width':'1'}));
  svg.append(shape('circle',{cx:'277',cy:'53',r:'100',fill:'none',stroke:p.front,opacity:'.07','stroke-width':'1'}));
  svg.append(shape('ellipse',{cx:'174',cy:'262',rx:'91',ry:'12',fill:p.side,opacity:'.12'}));
  const box = shape('g',{transform:'rotate(-7 169 151)'});
  box.append(shape('path',{d:'m92 47 145 0 27 15-145 0-27-15',fill:p.ink}));
  box.append(shape('path',{d:'m237 47 27 15v191l-27-13V47',fill:p.side}));
  box.append(shape('rect',{x:'92',y:'47',width:'145',height:'193',rx:'2',fill:p.front}));
  box.append(shape('rect',{x:'101',y:'56',width:'127',height:'175',rx:'1',fill:'none',stroke:p.ink,opacity:'.55','stroke-width':'.8'}));
  box.append(shape('text',{x:'162',y:'88',fill:p.ink,'text-anchor':'middle','font-family':'Georgia, serif','font-size':'19','letter-spacing':'3'},[p.label]));
  box.append(...motif(key,p.ink));
  box.append(shape('text',{x:'162',y:'218',fill:p.ink,'text-anchor':'middle','font-family':'Arial, sans-serif','font-size':'7','letter-spacing':'2'},[`OBJECT ${p.number} · FICTIONAL`]));
  box.append(shape('path',{d:'m247 87 7 4m-7 6 7 4m-7 6 7 4',stroke:p.ink,'stroke-width':'1',opacity:'.65'}));
  svg.append(box);
  return svg;
}
