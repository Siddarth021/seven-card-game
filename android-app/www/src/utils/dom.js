// src/utils/dom.js
// A minimal hyperscript-style helper so the UI stays declarative
// without pulling in a framework (no network access to install one).

/**
 * h(tag, props, children) -> HTMLElement
 * props: attributes/props object. Keys starting with "on" become
 * event listeners (onClick -> click). `className` sets the class.
 * children: string | Node | Array<string|Node>
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) el.dataset[dk] = dv;
    } else if (key in el) {
      try {
        el[key] = value;
      } catch {
        el.setAttribute(key, value);
      }
    } else {
      el.setAttribute(key, value);
    }
  }

  const kids = Array.isArray(children) ? children : [children];
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }

  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(root, el) {
  clear(root);
  root.appendChild(el);
}
