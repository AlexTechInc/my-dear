/**
 * Walks MD.data.storyline in order, mounting each scene into #app via its
 * MD.sceneTypes[scene.type] renderer, and advancing (with a fade) whenever
 * that renderer calls onComplete().
 */
MD.sceneManager = {
  container: null,
  scenes: [],
  index: 0,

  init: function (containerId, scenes) {
    this.container = document.getElementById(containerId);
    this.scenes = scenes;
    this.index = 0;
    this.playCurrent();
  },

  playCurrent: function () {
    var scene = this.scenes[this.index];
    if (!scene) return; // end of everything scripted so far

    MD.dom.clear(this.container);
    this.container.classList.remove('fade-out');

    var render = MD.sceneTypes[scene.type];
    if (!render) {
      console.error('MD.sceneManager: unknown scene type "' + scene.type + '"');
      return;
    }

    var self = this;
    render(this.container, scene.data, function () { self.advance(); });
  },

  advance: function () {
    var self = this;
    this.container.classList.add('fade-out');
    setTimeout(function () {
      self.index++;
      self.playCurrent();
    }, 500);
  }
};
