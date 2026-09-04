/**
 * Повноекранні "титульні" картки — інтро, розділові екрани між квестами,
 * фінальний вивід. Рендеряться MD.sceneTypes.title (js/scenes/titleScene.js).
 */
MD.data.cards = {
  introQuest1: {
    title: 'MY DEAR',
    subtitle: 'Это наша история. Ты — Маша. Выбирай, что написать, и посмотри, получится ли уговорить меня пойти сегодня на пиво 😏',
    hint: 'нажми, чтобы начать',
    hearts: false,
    chimeOnEnter: false,
    gate: {
      label: 'ВВЕДИ ДАТУ',
      placeholder: 'ДД.ММ.РРРР',
      answer: '04.09.2025',
      hintWrong: 'не тот код... попробуй ещё 🤔',
      hintRight: 'она самая! 💛'
    }
  },
  outroQuest1: {
    title: 'ХОРОШО ПОПИЛИ ПИВА?',
    subtitle: '',
    hint: 'нажми, чтобы продолжить',
    hearts: true,
    chimeOnEnter: true
  }
};
