/**
 * Debug-only tool: renders every quest in MD.data.quests as a real graph —
 * columns by BFS depth from the start node, SVG lines connecting choices to
 * whatever node they lead to (with the delta labeled right on the line) —
 * plus a small "flow simulator" per quest: click through choices like you're
 * playing it, watch the walked path light up and the running vibe total.
 *
 * Works for both step formats chatScene.js understands (linear array, or a
 * branching {node: {...}} object). Not loaded by index.html / the real game
 * — only by debug.html.
 */
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- turn either step format into one common graph shape ----------
   * Tolerant on purpose: while a quest is mid-edit, a node might have no
   * `choices` yet, a choice might be missing `text`/`reply`, etc. None of
   * that should ever crash the whole page — just flag that one node/choice
   * and keep rendering everything else.
   */
  function normalizeGraph(steps) {
    var nodes = {};
    var order = [];

    if (Array.isArray(steps)) {
      steps.forEach(function (step, i) {
        var key = String(i);
        var nextKey = (i + 1 < steps.length) ? String(i + 1) : null;
        order.push(key);
        nodes[key] = buildNode(step, function () { return nextKey; });
      });
    } else {
      Object.keys(steps).forEach(function (key) {
        order.push(key);
        nodes[key] = buildNode(steps[key], function (c) { return (c && c.next) || null; });
      });
    }

    return { nodes: nodes, order: order };
  }

  // resolveNext(choice) -> next key, so array mode (always index+1) and
  // graph mode (per-choice `next`) can share the same builder.
  function buildNode(step, resolveNext) {
    if (!step || !Array.isArray(step.choices) || !step.choices.length) {
      return { unfinished: true, choices: [] };
    }
    return {
      choices: step.choices.map(function (c) { return normalizeChoice(c, resolveNext(c)); })
    };
  }

  function normalizeChoice(c, nextKey) {
    c = c || {};
    var textIsArray = Array.isArray(c.text);
    var replyIsArray = Array.isArray(c.reply);
    return {
      preview: c.text != null
        ? (c.label || (textIsArray ? (c.firstPreview ? c.text[0] : c.text.join(' ')) : c.text))
        : '⚠ немає text',
      textCount: textIsArray ? c.text.length : 1,
      reply: c.reply != null ? (replyIsArray ? c.reply.join(' / ') : c.reply) : '⚠ немає reply',
      replyCount: replyIsArray ? c.reply.length : 1,
      delta: c.delta || 0,
      next: nextKey
    };
  }

  /* ---------- sanity checks + best/worst-case vibe swing ---------- */
  function analyze(graph, startKey) {
    var referenced = {};
    var deadLinks = [];

    graph.order.forEach(function (key) {
      graph.nodes[key].choices.forEach(function (c) {
        if (c.next) {
          referenced[c.next] = true;
          if (!graph.nodes[c.next]) deadLinks.push({ from: key, to: c.next });
        }
      });
    });

    var unreachable = graph.order.filter(function (key) {
      return key !== startKey && !referenced[key];
    });

    return { deadLinks: deadLinks, unreachable: unreachable, missingStart: !graph.nodes[startKey] };
  }

  // Walks every path from the start to an end, summing deltas, to find the
  // best- and worst-case total swing. Raw sums, NOT clamped to 0–100 the
  // way the live vibe meter is at each step — just a signal, not a promise.
  // Cycle-safe: revisiting a node within the same path just ends that branch.
  function pathDeltaRange(graph, startKey) {
    var min = Infinity, max = -Infinity;

    function walk(key, sum, visited) {
      var node = graph.nodes[key];
      if (!node || visited[key] || !node.choices.length) {
        min = Math.min(min, sum);
        max = Math.max(max, sum);
        return;
      }
      var seen = {};
      for (var k in visited) seen[k] = true;
      seen[key] = true;

      node.choices.forEach(function (c) {
        var total = sum + c.delta;
        if (c.next) walk(c.next, total, seen);
        else { min = Math.min(min, total); max = Math.max(max, total); }
      });
    }

    walk(startKey, 0, {});
    return { min: min, max: max };
  }

  // BFS depth from the start = which column a node is drawn in. Anything
  // never reached this way (orphans, or nodes past a dead link) lands in
  // one trailing column so it's still visible instead of vanishing.
  function computeLevels(graph, startKey) {
    var level = {};
    if (graph.nodes[startKey]) {
      level[startKey] = 0;
      var queue = [startKey];
      while (queue.length) {
        var key = queue.shift();
        var node = graph.nodes[key];
        if (!node) continue;
        node.choices.forEach(function (c) {
          if (c.next && graph.nodes[c.next] && level[c.next] == null) {
            level[c.next] = level[key] + 1;
            queue.push(c.next);
          }
        });
      }
    }
    var maxLevel = 0;
    graph.order.forEach(function (key) { if (level[key] > maxLevel) maxLevel = level[key]; });
    graph.order.forEach(function (key) { if (level[key] == null) level[key] = maxLevel + 1; });
    return level;
  }

  function truncate(s, n) {
    s = s || '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function deltaClassOf(delta) { return delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : 'delta-zero'; }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  /* ---------- rendering ---------- */
  function renderQuest(root, questId, data) {
    if (!data || !data.steps) {
      root.appendChild(MD.dom.el('div', { class: 'warn' }, ['⚠ квест "' + questId + '": немає steps']));
      return;
    }

    var isLinear = Array.isArray(data.steps);
    var startKey = isLinear ? '0' : (data.startNode || 'start');
    var graph = normalizeGraph(data.steps);
    var stats = analyze(graph, startKey);
    var vibeStart = typeof data.vibeStart === 'number' ? data.vibeStart : 50;
    var range = pathDeltaRange(graph, startKey);
    var levels = computeLevels(graph, startKey);

    var section = MD.dom.el('section', { class: 'quest-block' });
    section.appendChild(MD.dom.el('h2', {}, [questId + (data.questTag ? ' — ' + data.questTag : '')]));
    section.appendChild(MD.dom.el('div', { class: 'quest-meta' }, [
      'вузлів: ' + graph.order.length +
      ' · формат: ' + (isLinear ? 'лінійний (масив)' : 'граф (об’єкт)') +
      ' · старт: "' + startKey + '"'
    ]));
    section.appendChild(MD.dom.el('div', { class: 'quest-range' }, [
      'старт вайбу ',
      MD.dom.el('b', {}, [String(vibeStart)]),
      ' → по всіх шляхах діалогу: від ',
      MD.dom.el('b', {}, [String(vibeStart + range.min)]),
      ' до ',
      MD.dom.el('b', {}, [String(vibeStart + range.max)]),
      ' (без урахування обмеження 0–100 на кожному кроці)'
    ]));

    if (stats.missingStart) {
      section.appendChild(MD.dom.el('div', { class: 'warn' }, ['⚠ стартовий вузол "' + startKey + '" не знайдено серед steps']));
    }
    if (stats.deadLinks.length) {
      section.appendChild(MD.dom.el('div', { class: 'warn' }, [
        '⚠ next веде в неіснуючий вузол: ' + stats.deadLinks.map(function (d) { return d.from + ' → ' + d.to; }).join(', ')
      ]));
    }
    if (stats.unreachable.length) {
      section.appendChild(MD.dom.el('div', { class: 'warn' }, [
        '⚠ до цих вузлів не веде жоден choice: ' + stats.unreachable.join(', ')
      ]));
    }

    /* ---- columns of cards, one per BFS level ---- */
    var cardEls = {};
    var edgeDescriptors = []; // { fromKey, choiceIndex, rowEl, toKey, delta }
    var maxLevel = 0;
    graph.order.forEach(function (key) { if (levels[key] > maxLevel) maxLevel = levels[key]; });

    var cols = [];
    for (var i = 0; i <= maxLevel; i++) cols.push(MD.dom.el('div', { class: 'graph-col' }));

    graph.order.forEach(function (key) {
      var built = renderNode(key, graph.nodes[key], graph, edgeDescriptors);
      cardEls[key] = built;
      cols[levels[key]].appendChild(built);
    });

    var graphNodes = MD.dom.el('div', { class: 'graph-nodes' }, cols);
    var graphEdges = svgEl('svg', { class: 'graph-edges' });
    var graphWrap = MD.dom.el('div', { class: 'graph-wrap' }, [graphNodes]);
    graphWrap.appendChild(graphEdges); // appendChild directly: svgEl() isn't an MD.dom node
    section.appendChild(graphWrap);

    root.appendChild(section);

    // now that everything has real layout, draw the connecting lines
    var edgeRefs = drawEdges(graphWrap, graphEdges, cardEls, edgeDescriptors, levels);
    wireHoverHighlight(cardEls, edgeRefs);

    section.appendChild(renderFlowSim(graph, startKey, vibeStart, cardEls, edgeRefs));
  }

  function renderNode(key, node, graph, edgeDescriptors) {
    var card = MD.dom.el('div', { class: 'node-card' + (node.unfinished ? ' dead' : ''), id: 'node-' + key }, [
      MD.dom.el('div', { class: 'node-key' }, ['#' + key])
    ]);

    if (node.unfinished) {
      card.appendChild(MD.dom.el('div', { class: 'choice-row' }, [
        MD.dom.el('div', { class: 'choice-text' }, ['⚠ недороблений вузол — немає choices (або steps[' + key + '] ще не існує)'])
      ]));
      return card;
    }

    node.choices.forEach(function (c, idx) {
      var isDead = c.next && !graph.nodes[c.next];

      var nextEl = !c.next
        ? MD.dom.el('span', { class: 'next-end' }, ['■ кінець'])
        : MD.dom.el('a', { class: 'next-link' + (isDead ? ' dead-link' : ''), href: '#node-' + c.next }, ['→ #' + c.next]);

      var row = MD.dom.el('div', { class: 'choice-row' + (isDead ? ' dead' : '') }, [
        MD.dom.el('div', { class: 'choice-text' }, [truncate(c.preview, 70) + (c.textCount > 1 ? ' (+' + (c.textCount - 1) + ')' : '')]),
        MD.dom.el('div', { class: 'choice-reply' }, ['↳ ' + truncate(c.reply, 60) + (c.replyCount > 1 ? ' (+' + (c.replyCount - 1) + ')' : '')]),
        MD.dom.el('div', { class: 'choice-meta' }, [
          MD.dom.el('span', { class: 'delta ' + deltaClassOf(c.delta) }, [(c.delta > 0 ? '+' : '') + c.delta]),
          nextEl
        ])
      ]);
      card.appendChild(row);

      if (c.next && graph.nodes[c.next]) {
        edgeDescriptors.push({ fromKey: key, choiceIndex: idx, rowEl: row, toKey: c.next, delta: c.delta });
      }
    });

    return card;
  }

  /* ---------- SVG connections between cards ---------- */
  function drawEdges(graphWrap, svg, cardEls, edgeDescriptors, levels) {
    var wrapRect = graphWrap.getBoundingClientRect();
    var refs = [];

    // when several edges converge on the same card, land them at slightly
    // different heights instead of stacking exactly on top of each other
    var incomingCount = {};
    edgeDescriptors.forEach(function (d) {
      if (d.fromKey !== d.toKey) incomingCount[d.toKey] = (incomingCount[d.toKey] || 0) + 1;
    });
    var incomingSeen = {};

    edgeDescriptors.forEach(function (d) {
      var toEl = cardEls[d.toKey];
      if (!toEl) return; // shouldn't happen (we only queued edges with a real target), but stay safe

      var fromRect = d.rowEl.getBoundingClientRect();
      var toRect = toEl.getBoundingClientRect();
      var x1 = fromRect.right - wrapRect.left;
      var y1 = fromRect.top + fromRect.height / 2 - wrapRect.top;
      var isSelf = d.fromKey === d.toKey;
      var isBack = !isSelf && levels[d.toKey] <= levels[d.fromKey];

      var x2, y2, pathD;
      if (isSelf) {
        x2 = x1; y2 = y1;
        var r = 30;
        pathD = 'M ' + x1 + ' ' + (y1 - 7) + ' C ' + (x1 + r * 2) + ' ' + (y1 - r) + ', ' + (x1 + r * 2) + ' ' + (y1 + r) + ', ' + x1 + ' ' + (y1 + 7);
      } else {
        x2 = toRect.left - wrapRect.left;
        var count = incomingCount[d.toKey] || 1;
        var seenIdx = incomingSeen[d.toKey] || 0;
        incomingSeen[d.toKey] = seenIdx + 1;
        var spread = count > 1 ? (seenIdx - (count - 1) / 2) * 14 : 0;
        y2 = toRect.top + toRect.height / 2 - wrapRect.top + spread;
        var dx = Math.max(50, Math.abs(x2 - x1) / 2);
        pathD = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
      }

      var cls = 'edge-path' + (isBack || isSelf ? ' back' : '');
      var path = svgEl('path', { class: cls, d: pathD });
      // a fat invisible twin makes the thin line easy to hover/click
      var hit = svgEl('path', { class: 'edge-hit', d: pathD });
      svg.appendChild(path);
      svg.appendChild(hit);

      var lx = isSelf ? x1 + 62 : (x1 + x2) / 2;
      var ly = isSelf ? y1 : (y1 + y2) / 2;
      var label = svgEl('text', { class: 'edge-label ' + deltaClassOf(d.delta), x: lx, y: ly });
      label.textContent = (d.delta > 0 ? '+' : '') + d.delta;
      svg.appendChild(label);

      refs.push({ fromKey: d.fromKey, toKey: d.toKey, choiceIndex: d.choiceIndex, pathEl: path, labelEl: label, hitEl: hit });
    });

    return refs;
  }

  // Hovering an edge or a card dims every OTHER edge, so a tangled cluster
  // of lines becomes readable one connection at a time.
  function wireHoverHighlight(cardEls, edgeRefs) {
    function highlight(predicate) {
      edgeRefs.forEach(function (e) {
        var match = predicate(e);
        e.pathEl.classList.toggle('dim', !match);
        e.labelEl.classList.toggle('dim', !match);
      });
    }
    function clear() {
      edgeRefs.forEach(function (e) {
        e.pathEl.classList.remove('dim');
        e.labelEl.classList.remove('dim');
      });
    }

    edgeRefs.forEach(function (ref) {
      ref.hitEl.addEventListener('mouseenter', function () { highlight(function (e) { return e === ref; }); });
      ref.hitEl.addEventListener('mouseleave', clear);
    });

    Object.keys(cardEls).forEach(function (key) {
      cardEls[key].addEventListener('mouseenter', function () {
        highlight(function (e) { return e.fromKey === key || e.toKey === key; });
      });
      cardEls[key].addEventListener('mouseleave', clear);
    });
  }

  /* ---------- flow simulator: click through choices, watch it add up ---------- */
  function renderFlowSim(graph, startKey, vibeStart, cardEls, edgeRefs) {
    var sumVal = MD.dom.el('b', {}, [String(vibeStart)]);
    var breadcrumb = MD.dom.el('div', { class: 'flow-breadcrumb' });
    var choicesBox = MD.dom.el('div', { class: 'flow-choices' });
    var resetBtn = MD.dom.el('button', { class: 'flow-reset' }, ['↺ скинути флоу']);

    var walked = [];
    var state = { key: startKey, sum: vibeStart, trail: [startKey], ended: false };

    function setCurrentCard() {
      Object.keys(cardEls).forEach(function (k) { cardEls[k].classList.remove('current'); });
      if (cardEls[state.key]) cardEls[state.key].classList.add('current');
    }

    function findEdge(fromKey, choiceIndex) {
      for (var i = 0; i < edgeRefs.length; i++) {
        var e = edgeRefs[i];
        if (e.fromKey === fromKey && e.choiceIndex === choiceIndex) return e;
      }
      return null;
    }

    function render() {
      sumVal.textContent = String(state.sum);

      MD.dom.clear(breadcrumb);
      state.trail.forEach(function (k, i) {
        if (i > 0) breadcrumb.appendChild(MD.dom.el('span', { class: 'crumb-arrow' }, [' → ']));
        breadcrumb.appendChild(MD.dom.el('span', { class: 'crumb' }, [k]));
      });

      setCurrentCard();

      MD.dom.clear(choicesBox);

      if (state.ended) {
        choicesBox.appendChild(MD.dom.el('div', { class: 'flow-end' }, ['■ флоу завершено — жми "скинути", щоб пройти інший шлях']));
        return;
      }

      var node = graph.nodes[state.key];
      if (!node || node.unfinished || !node.choices.length) {
        choicesBox.appendChild(MD.dom.el('div', { class: 'flow-end' }, [
          !node ? '⚠ вузол не існує' : node.unfinished ? '⚠ недороблений вузол' : '■ кінець сцени (немає choices)'
        ]));
        return;
      }

      node.choices.forEach(function (c, idx) {
        var btn = MD.dom.el('button', { class: 'flow-choice-btn' }, [
          MD.dom.el('span', {}, [truncate(c.preview, 46)]),
          MD.dom.el('span', { class: 'delta ' + deltaClassOf(c.delta) }, [(c.delta > 0 ? '+' : '') + c.delta])
        ]);
        btn.addEventListener('click', function () {
          state.sum += c.delta;

          var edge = findEdge(state.key, idx);
          if (edge) {
            edge.pathEl.classList.add('walked');
            edge.labelEl.classList.add('walked');
            walked.push(edge);
          }

          if (c.next && graph.nodes[c.next]) {
            state.key = c.next;
            state.trail.push(c.next);
          } else {
            state.ended = true;
            state.trail.push(c.next ? '⚠#' + c.next : '■');
          }
          render();
        });
        choicesBox.appendChild(btn);
      });
    }

    resetBtn.addEventListener('click', function () {
      walked.forEach(function (e) { e.pathEl.classList.remove('walked'); e.labelEl.classList.remove('walked'); });
      walked = [];
      state = { key: startKey, sum: vibeStart, trail: [startKey], ended: false };
      render();
    });

    render();

    return MD.dom.el('div', { class: 'flow-panel' }, [
      MD.dom.el('div', { class: 'flow-header' }, [
        MD.dom.el('span', { class: 'flow-title pixel-title' }, ['ФЛОУ-СИМУЛЯТОР']),
        MD.dom.el('span', { class: 'flow-sum' }, ['вайб зараз: ', sumVal]),
        resetBtn
      ]),
      breadcrumb,
      choicesBox
    ]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('debug-root');
    var quests = MD.data.quests || {};
    var ids = Object.keys(quests);

    if (!ids.length) {
      root.appendChild(MD.dom.el('p', {}, ['Немає жодного квесту в MD.data.quests — підключи його <script> в debug.html']));
      return;
    }
    ids.forEach(function (id) {
      try {
        renderQuest(root, id, quests[id]);
      } catch (e) {
        root.appendChild(MD.dom.el('div', { class: 'warn' }, ['⚠ помилка рендеру квесту "' + id + '": ' + e.message]));
      }
    });
  });
})();
