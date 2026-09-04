/**
 * Zero-asset sound engine. Every UI sound is synthesized on the fly with
 * WebAudio (no mp3/wav files to fetch or keep in sync with the repo).
 * Background/credits music is a real audio file added separately later.
 */
(function () {
  var audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Browsers start contexts suspended until a user gesture — every sfx
    // call routes through here so the very first click/tap unlocks audio.
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(opts) {
    opts = opts || {};
    var freq = opts.freq || 440;
    var dur = opts.dur || 0.08;
    var type = opts.type || 'sine';
    var vol = opts.vol || 0.06;
    var glideTo = opts.glideTo || null;
    var delay = opts.delay || 0;

    try {
      ensureAudio();
      var t0 = audioCtx.currentTime + delay;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);

      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) {
      /* audio not available yet (no user gesture) — fail silently */
    }
  }

  MD.sfx = {
    ensureAudio: ensureAudio,
    hover:   function () { beep({ freq: 1300, dur: 0.02, type: 'sine',    vol: 0.02  }); },
    click:   function () { beep({ freq: 700,  dur: 0.05, type: 'square',  vol: 0.035, glideTo: 280 }); },
    send:    function () { beep({ freq: 520,  dur: 0.09, type: 'triangle',vol: 0.05,  glideTo: 920 }); },
    receive: function () { beep({ freq: 840,  dur: 0.09, type: 'sine',    vol: 0.05,  glideTo: 560 }); },
    chime:   function () {
      [660, 880, 990, 1320].forEach(function (f, i) {
        beep({ freq: f, dur: 0.32, type: 'sine', vol: 0.045, delay: i * 0.11 });
      });
    },
    unlock:  function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        beep({ freq: f, dur: 0.22, type: 'square', vol: 0.05, delay: i * 0.09 });
      });
    },
    error:   function () { beep({ freq: 220, dur: 0.16, type: 'sawtooth', vol: 0.05, glideTo: 130 }); },
    // two quick ascending clicks — the "phone just unlocked" feel
    phoneUnlock: function () {
      beep({ freq: 1046, dur: 0.05, type: 'square', vol: 0.04 });
      beep({ freq: 1568, dur: 0.06, type: 'square', vol: 0.045, delay: 0.07 });
    }
  };
})();
