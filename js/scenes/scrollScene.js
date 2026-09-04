/**
 * "scroll" scene type — classic end-credits style: a column of text drifts
 * slowly from the bottom of the screen to the top. It doesn't scroll the
 * final image away though — it stops right when that image is centered on
 * screen, then the image slowly grows to fill the whole screen and
 * dissolves, leaving just the background video with hearts/rings falling
 * over it.
 *
 * Length-agnostic (works with any amount of text) because the travel
 * distance is measured from the real rendered layout, not a hardcoded
 * number.
 *
 * data: {
 *   lines: string[],        // paragraphs, rendered top-to-bottom in order
 *   image?: string,         // final image path; falls back to a placeholder box
 *   duration?: number,      // seconds to reach the final image, default 30
 *   backgroundVideo?: string // YouTube video ID — plays muted/looped/blurred behind the text
 * }
 */
MD.sceneTypes.scroll = function (container, data, onComplete) {
  var track = MD.dom.el('div', { class: 'scroll-track' });

  (data.lines || []).forEach(function (line) {
    track.appendChild(MD.dom.el('p', { class: 'scroll-line' }, [line]));
  });

  // the last thing in the track — text stops scrolling once this is centered
  var finalEl = data.image
    ? MD.dom.el('img', { class: 'scroll-image', src: data.image, alt: '' })
    : MD.dom.el('div', { class: 'scroll-image scroll-image-placeholder' }, ['TEST IMAGE']);
  track.appendChild(finalEl);

  var sceneChildren = [];
  if (data.backgroundVideo) sceneChildren.push(buildBackgroundVideo(data.backgroundVideo));
  sceneChildren.push(track);

  var scene = MD.dom.el('div', { class: 'scene-scroll' }, sceneChildren);
  container.appendChild(scene);

  /* ---------- motion: one position, auto-advances, nudge just offsets it ---------- */
  var durationMs = (data.duration || 30) * 1000;
  // stop once finalEl is centered in the viewport, not once it scrolls fully off
  var stopPos = window.innerHeight / 2 + finalEl.offsetTop + finalEl.offsetHeight / 2;
  var velocity = stopPos / durationMs; // px per ms, so `duration` matches time-to-finalEl
  var pos = 0; // 0 = just below the screen, stopPos = finalEl centered, motion halts
  var lastTime = null;
  var stopped = false;

  function clampPos(n) { return Math.max(0, Math.min(stopPos, n)); }

  function frame(now) {
    if (lastTime == null) lastTime = now;
    if (!stopped) {
      pos = clampPos(pos + velocity * (now - lastTime));
      if (pos >= stopPos) { stopped = true; growAndDissolveImage(); rainLove(); }
    }
    lastTime = now;

    track.style.transform = 'translate(-50%, ' + (-pos) + 'px)';
    if (!stopped) requestAnimationFrame(frame);
  }

  // Lifts the final image out of the (still-transformed) track and onto a
  // real viewport-fixed position — matching exactly where it already sits
  // on screen, so the handoff is invisible — then grows it to fill the
  // whole screen and fades it out. Nothing left onscreen after but the
  // background video and the falling hearts/rings.
  function growAndDissolveImage() {
    var rect = finalEl.getBoundingClientRect();
    scene.appendChild(finalEl); // out from under track's transform — plain viewport-fixed now

    finalEl.style.position = 'fixed';
    finalEl.style.top = rect.top + 'px';
    finalEl.style.left = rect.left + 'px';
    finalEl.style.width = rect.width + 'px';
    finalEl.style.height = rect.height + 'px';
    finalEl.style.margin = '0';
    finalEl.style.maxWidth = 'none';
    finalEl.classList.add('scroll-image-fixed');

    void finalEl.offsetWidth; // commit the "from" state before animating to the "to" state

    requestAnimationFrame(function () {
      finalEl.style.top = '0px';
      finalEl.style.left = '0px';
      finalEl.style.width = '100vw';
      finalEl.style.height = '100vh';
      finalEl.style.borderRadius = '0px';
    });

    track.classList.add('scroll-track-fade'); // any leftover text fades along with it

    setTimeout(function () {
      finalEl.classList.add('scroll-image-dissolve');
    }, 3300);
  }

  // Hearts and rings keep gently falling forever after — this is the
  // resting/ending beat, nothing to advance to from here yet.
  function rainLove() {
    var glyphs = ['♥️', '💍'];
    setInterval(function () {
      var drop = MD.dom.el('div', { class: 'scroll-fall' }, [glyphs[Math.floor(Math.random() * glyphs.length)]]);
      drop.style.left = (Math.random() * 94 + 2) + 'vw';
      drop.style.fontSize = (18 + Math.random() * 16) + 'px';
      drop.style.animationDuration = (4 + Math.random() * 3) + 's';
      drop.style.animationDelay = (Math.random() * 0.5) + 's';
      scene.appendChild(drop);
      setTimeout(function () { drop.remove(); }, 8000);
    }, 260);
  }

  /* ---------- nudge: wheel, or drag/touch — locked once it stops ---------- */
  scene.addEventListener('wheel', function (e) {
    if (stopped) return;
    e.preventDefault();
    pos = clampPos(pos + e.deltaY * 1.2);
  }, { passive: false });

  var dragY = null;
  var dragPos = null;
  scene.addEventListener('pointerdown', function (e) {
    if (stopped) return;
    dragY = e.clientY;
    dragPos = pos;
  });
  scene.addEventListener('pointermove', function (e) {
    if (stopped || dragY == null) return;
    pos = clampPos(dragPos - (e.clientY - dragY));
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
    scene.addEventListener(evt, function () { dragY = null; });
  });

  requestAnimationFrame(frame);
};

// Muted, looped, chromeless YouTube embed as a blurred backdrop. Wrapped in
// its own fixed layer with pointer-events:none so it can never eat the
// wheel/drag gestures the scroll track listens for.
function buildBackgroundVideo(videoId) {
  var params = [
    'autoplay=1', 'loop=1', 'playlist=' + videoId,
    'controls=0', 'showinfo=0', 'modestbranding=1', 'rel=0',
    'iv_load_policy=3', 'disablekb=1', 'fs=0', 'playsinline=1'
  ].join('&');

  var iframe = MD.dom.el('iframe', {
    class: 'scroll-bg-frame',
    src: 'https://www.youtube.com/embed/' + videoId + '?' + params,
    frameborder: '0',
    allow: 'autoplay; encrypted-media',
    tabindex: '-1'
  });

  return MD.dom.el('div', { class: 'scroll-bg' }, [iframe]);
}
