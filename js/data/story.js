/**
 * Порядок усієї гри. MD.sceneManager просто йде по цьому масиву.
 * Кожен запис: { type: '<ключ з MD.sceneTypes>', data: <дані для цієї сцени> }.
 *
 * Щоб додати квест 2/3/4 — заведи новий файл у js/data/quests/,
 * підключи його в index.html (перед цим файлом) і встав сюди.
 */
MD.data.storyline = [
  { type: 'title', data: MD.data.cards.introQuest1 },
  { type: 'chat',  data: MD.data.quests.quest1 },
  { type: 'title', data: MD.data.cards.outroQuest1 }
  // квест 2 (поцілунок у пивбарі), 3 (набережна), 4 (Троєщина), бос, титри — далі тут
];
