/**
 * Adds old games to the database.
 */
const games = require('./games.json');
const fetchGameInfo = require('../tasks/fetchGameInfo');

const addOldGames = function addOldGames() {
  const gameFetches = [];
  
  for (let i = 0; i < /* games.seasons.length */ 1; i += 1) {
    const season = games.seasons[i];
    for (let j = 0; j < /* season.weeks.length */ 1; j += 1) {
      const week = season.weeks[j];
      for (let k = 0; k < /* sweek.games.length */ 1; k += 1) {
        const game = week.games[k];
        gameFetches.push(fetchGameInfo(game.id));
      }
    }
  }
  
  return Promise.all(gameFetches);
};

module.exports = addOldGames;
