/**
 * Adds old games to the database.
 */
const games = require('./games.json');
const fetchGameInfo = require('../tasks/fetchGameInfo');
const { addGame } = require('../tasks/addGame');
const Game = require('../models/schedules/game.model');

const addOldGames = function addOldGames() {
  const gamePromises = [];
  const modifiedGames = [];
  
  for (let i = 0; i < /* games.seasons.length */ 1; i += 1) {
    const season = games.seasons[i];
    console.log(`Season ${season.seasonNo}`);
    for (let j = 0; j < /* season.weeks.length */ 1; j += 1) {
      const week = season.weeks[j];
      console.log(`Week ${week.weekNo}`);
      for (let k = 0; k < week.games.length; k += 1) {
        const game = week.games[k];
        gamePromises.push(
          Game.findOne({ gameId: game.id })
            .then((gameDoc) => {
              if (gameDoc) {
                console.log(`Game ${game.id} already exists.`);
                return gameDoc;
              }
              return fetchGameInfo(game.id)
                .catch((error) => {
                  console.error(`Error in game ${game.id}.`);
                  console.error(error);
                  process.exit();
                })
                .then((gameInfo) => {
                  if (gameInfo.homeTeam.stats.score.final !== game.home.score
                    || gameInfo.awayTeam.stats.score.final !== game.away.score
                  ) {
                    modifiedGames.push(game.id);
                  }
                  console.log(`Adding game ${game.id}.`);
                  return addGame(gameInfo, season.seasonNo, week.weekNo);
                });
            }),
        );
      }
    }
  }
  
  return Promise.all(gamePromises);
};

module.exports = addOldGames;
