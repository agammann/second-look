export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'on') {
      for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    } else if (key === 'className') node.className = value;
    else if (['value', 'checked', 'disabled', 'selected'].includes(key)) node[key] = value;
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const paths = {
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 5 7 7-7 7',
  external: 'M14 4h6v6m0-6L10 14M10 4H4v16h16v-6',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4-2a8 8 0 0 1 13-5l2 2M4 17l2 2a8 8 0 0 0 13-5',
  warning: 'm12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  close: 'm6 6 12 12M18 6 6 18',
  box: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7m-9 4v10',
  mark: 'M4 4h12v12H4V4Zm4 4h12v12H8V8Z',
};

export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  for (const [key, value] of Object.entries({viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `icon ${className}`})) svg.setAttribute(key, value);
  path.setAttribute('d', paths[name] || paths.box);
  svg.append(path);
  return svg;
}

export function formatMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(cents / 100);
}

export function formatTime(value) {
  if (!value) return 'Not recorded';
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? 'Not recorded' : time.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});
}
