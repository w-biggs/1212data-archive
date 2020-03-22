/**
 * Adds old games to the database.
 */
const games = require('./games.json');
const fetchGameInfo = require('../tasks/fetchGameInfo');

const addOldGames = function addOldGames() {
  const gameFetches = [];
  
  for (let i = 0; i < /* games.seasons.length */ 1; i += 1) {
    const season = games.seasons[i];
    console.log(`Adding season ${season.seasonNo}`);
    for (let j = 0; j < /* season.weeks.length */ 1; j += 1) {
      const week = season.weeks[j];
      console.log(`Adding week ${week.weekNo}`);
      for (let k = 0; k < week.games.length; k += 1) {
        const game = week.games[k];
        gameFetches.push(
          fetchGameInfo(game.id)
            .catch((error) => {
              console.error(`Error in game ${game.id}.`);
              console.error(error);
              process.exit();
            })
            .then((gameInfo) => {
              if (gameInfo.homeTeam.stats.score.final !== game.home.score
                || gameInfo.awayTeam.stats.score.final !== game.away.score
              ) {
                console.log(game.id);
              }
            }),
        );
      }
    }
  }
  
  return Promise.all(gameFetches);
};

module.exports = addOldGames;
