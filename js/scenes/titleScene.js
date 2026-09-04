/**
 * "title" scene type — full-screen card with a big pixel headline + subtitle.
 * Used for the intro, act breaks and outros.
 *
 * Two ways to advance, picked automatically from the data:
 *   - plain card: click anywhere ("hint" is the flickering call-to-action)
 *   - gated card (data.gate set): type a date/code to "unlock" it instead
 *
 * data: { title, subtitle, hint, hearts, chimeOnEnter,
 *         gate?: { label, placeholder, answer, hintWrong, hintRight } }
 */
MD.sceneTypes.title = function (container, data, onComplete) {
  var scene = MD.dom.el('div', { class: 'scene-title' + (data.gate ? ' has-gate' : '') }, [
    MD.dom.el('div', { class: 'big pixel-title', html: data.title }),
    MD.dom.el('div', { class: 'sub', html: data.subtitle })
  ]);
  container.appendChild(scene);

  if (data.chimeOnEnter) {
    MD.sfx.ensureAudio();
    MD.sfx.chime();
  }
  if (data.hearts) spawnHearts(scene, 22);

  if (data.gate) {
    setupGate(scene, data, finish);
  } else {
    scene.appendChild(MD.dom.el('div', { class: 'hint pixel-title' }, [data.hint]));
    scene.addEventListener('click', function handler() {
      scene.removeEventListener('click', handler);
      MD.sfx.ensureAudio();
      // if we already celebrated on enter, keep the exit quiet; otherwise
      // this click *is* the celebratory beat (e.g. the "start game" tap).
      if (data.chimeOnEnter) MD.sfx.click(); else MD.sfx.chime();
      finish();
    }, { once: true });
  }

  function finish() {
    scene.style.opacity = '0';
    setTimeout(onComplete, 550);
  }

  function spawnHearts(root, count) {
    var glyphs = ['💛', '❤️', '✨'];
    for (var k = 0; k < count; k++) {
      setTimeout(function () {
        var h = MD.dom.el('div', { class: 'heart' }, [glyphs[Math.floor(Math.random() * glyphs.length)]]);
        h.style.left = (Math.random() * 90 + 5) + 'vw';
        h.style.animationDuration = (2.4 + Math.random() * 1.6) + 's';
        h.style.fontSize = (14 + Math.random() * 16) + 'px';
        root.appendChild(h);
        setTimeout(function () { h.remove(); }, 4200);
      }, k * 180);
    }
  }
};

/**
 * Renders a tiny pixel "lock screen": a date/code input that must match
 * gate.answer before the card is allowed to advance. Dates are compared
 * loosely (any separator, optional leading zeros) so "4.9.2025" and
 * "04.09.2025" both work — the placeholder is what teaches the format.
 */
function setupGate(scene, data, finish) {
  var gate = data.gate;
  var solved = false;

  var lockIcon = MD.dom.el('div', { class: 'gate-lock' }, ['🔒']);
  var label = MD.dom.el('div', { class: 'gate-label pixel-title' }, [gate.label]);
  var input = MD.dom.el('input', {
    class: 'gate-input',
    type: 'text',
    placeholder: gate.placeholder || '',
    autocomplete: 'off',
    spellcheck: 'false'
  });
  var btn = MD.dom.el('button', { class: 'gate-btn pixel-title' }, ['OK']);
  var feedback = MD.dom.el('div', { class: 'gate-feedback' }, [data.hint || '']);

  scene.appendChild(MD.dom.el('div', { class: 'gate' }, [
    lockIcon,
    label,
    MD.dom.el('div', { class: 'gate-row' }, [input, btn]),
    feedback
  ]));

  function normalizeDate(str) {
    var m = String(str || '').match(/(\d{1,2})\D*(\d{1,2})\D*(\d{4})/);
    if (!m) return null;
    return pad(m[1]) + '.' + pad(m[2]) + '.' + m[3];
  }
  function pad(n) { return n.length < 2 ? '0' + n : n; }

  function attempt() {
    if (solved) return;
    MD.sfx.ensureAudio();

    if (normalizeDate(input.value) && normalizeDate(input.value) === normalizeDate(gate.answer)) {
      solved = true;
      MD.sfx.unlock();
      lockIcon.textContent = '🔓';
      feedback.className = 'gate-feedback success';
      feedback.textContent = gate.hintRight || 'вірно! 💛';
      input.disabled = true;
      btn.disabled = true;
      setTimeout(finish, 900);
    } else {
      MD.sfx.error();
      feedback.className = 'gate-feedback error';
      feedback.textContent = gate.hintWrong || 'не той код... спробуй ще';
      input.classList.remove('shake');
      void input.offsetWidth; // restart the shake animation on repeat wrong tries
      input.classList.add('shake');
      input.select();
    }
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') attempt();
  });

  setTimeout(function () { input.focus(); }, 300);
}
