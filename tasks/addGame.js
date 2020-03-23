/**
 * Add a game to the database
 */
const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
const Game = require('../models/schedules/game.model');

/**
 * Gets a season from the database. Adds it if it doesn't exist.
 * @param {Number} seasonNo The season number to add.
 */
const getSeason = function getOrAddSeason(seasonNo) {
  return Season.findOne({ seasonNo })
    .then((season) => {
      if (!season) {
        console.log(`Adding season ${seasonNo}`);
        const newSeason = new Season({ seasonNo });
        return newSeason.save();
      }
      return season;
    });
};

/**
 * Gets a week from the database. Adds it if it doesn't exist.
 * @param {Number} weekNo The week number to add.
 */
const getWeek = function getOrAddWeek(weekNo, season) {
  return Week.findOne({ weekNo, season: season._id })
    .then((week) => {
      if (!week) {
        console.log(`Adding week ${weekNo} to season ${season.seasonNo}`);
        const newWeek = new Week({ weekNo, season: season._id });
        return newWeek.save()
          .then((savedWeek) => {
            season.weeks.push(savedWeek._id);
            return season.save()
              .then(() => savedWeek);
          });
      }
      return week;
    });
};

/**
 * Adds a game to the database.
 * @param {Object} gameInfo The game's info.
 * @param {Number} seasonNo The game's season #
 * @param {Number} weekNo The game's week #
 */
const addGame = function addGameToDatabase(gameInfo, seasonNo, weekNo) {
  console.log(`Adding game ${gameInfo.gameId} in season ${seasonNo} week ${weekNo}`);
  return Game.findOne({ gameId: gameInfo.gameId })
    .then((game) => {
      if (game) {
        if (gameInfo.endTime > game.endTime) {
          game.set(gameInfo);
          return game.save();
        }
        return game;
      }
      return getSeason(seasonNo)
        .then(season => getWeek(weekNo, season)) // add week
        .then((week) => {
          const newGame = new Game(gameInfo);
          newGame.save()
            .then((savedGame) => {
              console.log(savedGame._id);
              week.games.push(savedGame._id);
              week.save()
                .then(() => savedGame);
            });
        });
    });
};

module.exports = {
  addGame,
};
