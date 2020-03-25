/**
 * Add a game to the database
 */
const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
const Game = require('../models/schedules/game.model');
const Play = require('../models/play.model');

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
 * Saves a game's plays to the database.
 * @param {Array} plays The array of game plays.
 * @param {import('mongoose').Schema.Types.ObjectId} savedGameId ID of the saved game
 */
const savePlays = function savePlaysInDatabase(plays, savedGameId) {
  console.log('Saving plays...');
  const playSaves = [];
  for (let i = 0; i < plays.length; i += 1) {
    const play = plays[i];
    playSaves.push(
      Play.findOne({ commentId: play.commentId })
        .then((fetchedPlay) => {
          if (fetchedPlay) {
            return fetchedPlay;
          }
          play.game = savedGameId;
          const newPlay = new Play(play);
          return newPlay.save()
            .catch((error) => {
              console.error(`Error at play ${play.commentId}`);
              throw error;
            });
        }),
    );
  }
  return Promise.all(playSaves);
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
          const gamePlays = gameInfo.plays;
          const newGameInfo = gameInfo;
          newGameInfo.plays = [];
          const newGame = new Game(gameInfo);
          return savePlays(gamePlays, newGame._id)
            .then((savedPlays) => {
              newGame.plays = savedPlays;
              return newGame.save()
                .then((finalGame) => {
                  week.games.push(finalGame._id);
                  week.save()
                    .then(() => finalGame);
                });
            });
        });
    });
};

module.exports = {
  addGame,
};
