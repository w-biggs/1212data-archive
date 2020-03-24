/**
 * Compares json games with db games to find which games are different.
 */
const games = require('./games.json');
const Game = require('../models/schedules/game.model');

const checkModifiedGames = function checkModifiedGames() {
  const gamePromises = [];
  
  for (let i = 0; i < /* games.seasons.length */ 1; i += 1) {
    const season = games.seasons[i];
    console.log(`Season ${season.seasonNo}`);
    for (let j = 0; j < season.weeks.length; j += 1) {
      const week = season.weeks[j];
      console.log(`Week ${week.weekNo}`);
      for (let k = 0; k < week.games.length; k += 1) {
        const game = week.games[k];
        gamePromises.push(
          Game.findOne({ gameId: game.id })
            .then((gameDoc) => {
              if (gameDoc.homeTeam.stats.score.final !== game.home.score
                || gameDoc.awayTeam.stats.score.final !== game.away.score
              ) {
                return game.id;
              }
              return null;
            }),
        );
      }
    }
  }
  
  return Promise.all(gamePromises)
    .then(values => values.filter(v => v !== null));
};

module.exports = checkModifiedGames;
