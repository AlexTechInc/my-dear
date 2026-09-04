/**
 * "chat" scene type — looping photo on the left, interactive texting UI on
 * the right. Player picks Masha's line, Sasha's scripted reply follows.
 *
 * `data.steps` supports two shapes:
 *
 *   1) Array (linear) — same as before, always goes to the next index:
 *      steps: [
 *        { choices: [{ text, reply, delta }, ...] },
 *        { choices: [{ text, reply, delta }, ...] }
 *      ]
 *
 *   2) Object (branching graph) — each choice picks the next node by name,
 *      so different replies from Sasha lead to different follow-up choices
 *      for Masha. Leave off `next` to end the scene on that choice.
 *      steps: {
 *        start: { choices: [
 *          { text: "...", reply: "...", delta: 15, next: "soft" },
 *          { text: "...", reply: "...", delta: -10, next: "hard" }
 *        ]},
 *        soft:  { choices: [{ text: "...", reply: "...", delta: 10, next: "close" }] },
 *        hard:  { choices: [{ text: "...", reply: "...", delta: -5, next: "close" }] },
 *        close: { choices: [{ text: "...", reply: "...", delta: 10 }] } // no `next` = end
 *      }
 *      (optional `data.startNode` picks the entry node, default 'start')
 *
 * `text` and `reply` each accept either one string or an array of strings —
 * an array is sent as several separate bubbles in a row (real texting
 * rarely fits in one message). The choice BUTTON always needs a single
 * line though, so when `text` is an array its parts are joined with a
 * space for the button label by default. Two ways to shrink that:
 *   - `firstPreview: true`  — button shows only text[0] (array `text` only,
 *     ignored otherwise); the full list still sends in order when picked.
 *   - `label: "..."`        — explicit button text, takes priority over both.
 *
 * data: {
 *   contactName, background[], captionTitle, captionSub, questTag,
 *   vibeStart?, failReply?, failSubtitle?, chatSlideDelay?, startNode?,
 *   steps: <array or object, see above>
 * }
 */
MD.sceneTypes.chat = function (container, data, onComplete) {
  var success = typeof data.vibeStart === 'number' ? data.vibeStart : 50;
  var FAIL_PAUSE = 2200; // ms to sit with the last message on screen before the fail overlay appears

  /* ---------- left pane: idle looping background photo ---------- */
  var phonePane = MD.dom.el('div', { class: 'phone-pane' });
  var frames = data.background.map(function (src, i) {
    var img = MD.dom.el('img', { class: 'frame' + (i === 0 ? ' active' : ''), src: src, alt: '' });
    phonePane.appendChild(img);
    return img;
  });
  phonePane.appendChild(MD.dom.el('div', { class: 'pane-caption' }, [
    data.captionTitle,
    MD.dom.el('small', {}, [data.captionSub])
  ]));

  var frameIndex = 0;
  var frameTimer = setInterval(function () {
    frames[frameIndex].classList.remove('active');
    frameIndex = (frameIndex + 1) % frames.length;
    frames[frameIndex].classList.add('active');
  }, 2600);

  /* ---------- right pane: chat window ---------- */
  var statusEl = MD.dom.el('div', { class: 'status' }, ['онлайн']);
  var progressEl = MD.dom.el('div', { class: 'progress' });

  var headerTop = MD.dom.el('div', { class: 'chat-header-top' }, [
    MD.dom.el('div', { class: 'avatar' }, [data.contactName.charAt(0)]),
    MD.dom.el('div', { class: 'who' }, [
      MD.dom.el('div', { class: 'name' }, [data.contactName]),
      statusEl
    ]),
    progressEl
  ]);

  var vibeFill = MD.dom.el('div', { class: 'vibe-fill' });
  var vibePct = MD.dom.el('div', { class: 'vibe-pct' });
  var vibeRow = MD.dom.el('div', { class: 'vibe-row' }, [
    MD.dom.el('div', { class: 'vibe-label' }, ['ВАЙБ']),
    MD.dom.el('div', { class: 'vibe-bar' }, [vibeFill]),
    vibePct
  ]);

  var header = MD.dom.el('div', { class: 'chat-header' }, [headerTop, vibeRow]);

  var messagesEl = MD.dom.el('div', { class: 'messages' });
  var choicesEl = MD.dom.el('div', { class: 'choices' });
  var chatWindow = MD.dom.el('div', { class: 'chat-window' }, [header, messagesEl, choicesEl]);

  var chatPane = MD.dom.el('div', { class: 'chat-pane' }, [
    chatWindow,
    MD.dom.el('div', { class: 'quest-tag' }, [data.questTag])
  ]);

  var sceneEl = MD.dom.el('div', { class: 'scene-chat' }, [phonePane, chatPane]);
  container.appendChild(sceneEl);

  // let the full scene breathe on screen first, then the chat slides in
  // from the right; the "unlock" click lands right as it settles in place.
  var slideDelay = data.chatSlideDelay != null ? data.chatSlideDelay : 3000;
  setTimeout(function () {
    chatPane.classList.add('slide-in');
    setTimeout(function () { MD.sfx.phoneUnlock(); }, 720);
  }, slideDelay);

  /* ---------- vibe meter ---------- */
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function updateVibe() {
    vibeFill.style.width = success + '%';
    vibePct.textContent = success + '%';
    vibeFill.classList.remove('low', 'mid', 'high');
    vibeFill.classList.add(success <= 25 ? 'low' : success <= 65 ? 'mid' : 'high');
  }
  updateVibe();

  /* ---------- bubbles ---------- */
  function addBubble(side, text) {
    var row = MD.dom.el('div', { class: 'bubble-row ' + side }, [
      MD.dom.el('div', { class: 'bubble ' + side }, [text])
    ]);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Sends one message, or — if `content` is an array — several bubbles in a
  // row, one at a time, each with its own sound. Calls `done` once the last
  // one has landed.
  function sendBubbleSequence(side, content, sfxFn, done) {
    var messages = Array.isArray(content) ? content : [content];
    function step(idx) {
      addBubble(side, messages[idx]);
      sfxFn();
      if (idx + 1 < messages.length) {
        setTimeout(function () { step(idx + 1); }, 450);
      } else if (done) {
        done();
      }
    }
    step(0);
  }

  function showTyping() {
    var row = MD.dom.el('div', { class: 'bubble-row left', id: 'typingRow' }, [
      MD.dom.el('div', { class: 'typing' }, [
        MD.dom.el('span'), MD.dom.el('span'), MD.dom.el('span')
      ])
    ]);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var row = messagesEl.querySelector('#typingRow');
    if (row) row.remove();
  }

  /* ---------- dialogue flow (shared by both step formats) ---------- */

  // Renders one set of choices; `dotEl` is the progress dot to fill in once
  // she's answered, `advance(choice)` decides what happens next.
  function renderChoices(choices, dotEl, advance) {
    MD.dom.clear(choicesEl);

    choices.forEach(function (choice) {
      // the button label must always be a plain string, even if `text`
      // (what actually gets sent) is an array of several messages
      var label = choice.label || (Array.isArray(choice.text)
        ? (choice.firstPreview ? choice.text[0] : choice.text.join(' '))
        : choice.text);
      var btn = MD.dom.el('button', { class: 'choice-btn' }, [label]);
      btn.addEventListener('mouseenter', MD.sfx.hover);
      btn.addEventListener('click', function () { handleChoice(choice, dotEl, advance); });
      choicesEl.appendChild(btn);
    });

    choicesEl.appendChild(MD.dom.el('div', { class: 'choices-hint' }, ['выбери, что написать']));
  }

  function handleChoice(choice, dotEl, advance) {
    MD.sfx.ensureAudio();
    MD.sfx.click();
    Array.prototype.forEach.call(choicesEl.children, function (c) { c.disabled = true; });
    if (dotEl) dotEl.classList.add('filled');

    sendBubbleSequence('right', choice.text, MD.sfx.send, function () {
      success = clamp(success + (choice.delta || 0), 0, 100);
      updateVibe();
      setTimeout(function () { replyOrFail(choice, advance); }, 350);
    });
  }

  function replyOrFail(choice, advance) {
    statusEl.textContent = 'печатает...';
    showTyping();
    setTimeout(function () {
      hideTyping();

      // always show the reply actually written for this choice — even the
      // one that tips the vibe to 0 — instead of swapping in a generic line
      sendBubbleSequence('left', choice.reply, MD.sfx.receive, function () {
        if (success <= 0) {
          setTimeout(failQuest, FAIL_PAUSE); // let her read it before the fail screen pops up
          return;
        }
        statusEl.textContent = 'онлайн';
        setTimeout(function () { advance(choice); }, 850);
      });
    }, 900);
  }

  function failQuest() {
    clearInterval(frameTimer);
    MD.sfx.error();
    statusEl.textContent = 'офлайн';
    MD.dom.clear(choicesEl);
    chatWindow.classList.add('fail-shake');

    var retryBtn = MD.dom.el('button', { class: 'fail-retry pixel-title' }, ['ДАВАЙ ПО НОВОЙ']);
    retryBtn.addEventListener('click', function () {
      MD.sfx.ensureAudio();
      MD.sfx.click();
      MD.dom.clear(container);
      MD.sceneTypes.chat(container, data, onComplete);
    });

    sceneEl.appendChild(MD.dom.el('div', { class: 'fail-overlay' }, [
      MD.dom.el('div', { class: 'fail-title pixel-title' }, ['Все хуйня']),
      MD.dom.el('div', { class: 'fail-sub' }, [data.failSubtitle || 'слишком токсично даже для вас двоих 😂']),
      retryBtn
    ]));
  }

  function finishScene() {
    clearInterval(frameTimer);
    onComplete();
  }

  // Reaching the natural end of the story is NOT automatically a win.
  // Losing is meant to be the easy outcome (vibe hits 0 at any point, from
  // anywhere) — winning is the narrow case: you also have to have ended up
  // with a high enough vibe. Falling short at the very end fails you just
  // like hitting 0 mid-conversation would, same retry flow either way.
  function completeOrFail() {
    var threshold = typeof data.winThreshold === 'number' ? data.winThreshold : 80;
    if (success >= threshold) finishScene();
    else setTimeout(failQuest, FAIL_PAUSE); // same breathing room before the fail screen here too
  }

  /* ---------- entry point: pick linear or branching mode ---------- */
  if (Array.isArray(data.steps)) {
    data.steps.forEach(function () { progressEl.appendChild(MD.dom.el('div', { class: 'dot' })); });
    renderLinearStep(0);
  } else {
    renderNode(data.startNode || 'start');
  }

  function renderLinearStep(i) {
    if (i >= data.steps.length) { completeOrFail(); return; }
    renderChoices(data.steps[i].choices, progressEl.children[i], function () { renderLinearStep(i + 1); });
  }

  function renderNode(key) {
    var node = data.steps[key];
    if (!node) { completeOrFail(); return; } // unknown/missing node = end of the branch
    var dot = MD.dom.el('div', { class: 'dot' });
    progressEl.appendChild(dot);
    renderChoices(node.choices, dot, function (choice) {
      if (choice.next) renderNode(choice.next);
      else completeOrFail();
    });
  }
};
