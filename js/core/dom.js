/**
 * Tiny DOM helper so scene files stay readable without a templating lib.
 *
 *   MD.dom.el('div', { class: 'foo', onClick: fn }, ['text', childNode])
 */
MD.dom = {
  el: function (tag, attrs, children) {
    attrs = attrs || {};
    children = children || [];
    var node = document.createElement(tag);

    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (key === 'class') {
        node.className = value;
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (key.indexOf('on') === 0 && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        node.setAttribute(key, value);
      }
    });

    children.forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });

    return node;
  },

  clear: function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
};
