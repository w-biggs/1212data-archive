/**
 * Add a game to the database
 */
const fetchGameInfo = require('./fetchGameInfo');

/**
 * The reddit ID of the game to add to the DB.
 * @param {String} gameId The reddit ID of the game.
 * @param {Number} seasonNo The season number of the game.
 * @param {Number} weekNo The week number of the game.
 */
const addGame = function addGameToDatabase(gameId, seasonNo, weekNo) {
  console.log(`Adding game ${gameId}`);
  return fetchGameInfo(gameId);
};

module.exports = {
  addGame,
};
