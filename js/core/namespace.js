/**
 * Global namespace for the whole game. Everything hangs off `MD` so we never
 * pollute `window` with random globals while still avoiding ES modules
 * (plain <script> tags work from file:// during dev AND on GitHub Pages —
 * no build step, no server required).
 *
 * Load order (see index.html):
 *   1. core/*      — engine primitives (dom helpers, sound)
 *   2. data/*       — story content (quests, cards, the storyline order)
 *   3. scenes/*     — scene renderers, keyed by type, + the scene manager
 *   4. main.js      — boots MD.sceneManager with MD.data.storyline
 */
window.MD = window.MD || {};
MD.data = MD.data || {};        // all story content lives here
MD.sceneTypes = MD.sceneTypes || {}; // type name -> render(container, data, onComplete)
