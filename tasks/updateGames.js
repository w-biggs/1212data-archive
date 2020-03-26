const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
const { addGame } = require('../tasks/addGame');
const fetchGameInfo = require('../tasks/fetchGameInfo');

const updateGames = async function updateCurrentWeekGames(seasonNo, weekNo) {
  console.log('Starting game update.');
  const updateStart = Date.now();
  const season = await Season.findOne({ seasonNo });
  if (season) {
    const week = await Week.findOne({ season: season._id, weekNo }).populate('season');
    if (week) {
      week.games = await week.getSortedGames();
      for (let i = 0; i < week.games.length; i += 1) {
        if (week.games[i].live) {
          // eslint-disable-next-line no-await-in-loop
          const updatedGame = await fetchGameInfo(week.games[i].gameId, false, false)
            .then(gameInfo => addGame(gameInfo, seasonNo, weekNo));

          // eslint-disable-next-line no-await-in-loop
          const populatedGame = await updatedGame
            .populate('homeTeam.team')
            .populate('awayTeam.team')
            .execPopulate();
          week.games[i] = populatedGame;
        }
      }
      console.log(`Updated games. Took ${(Date.now() - updateStart) / 1000} seconds.`);
      return true;
    }
    throw new Error(`Week ${weekNo} not found.`);
  }
  throw new Error(`Season ${seasonNo} not found.`);
};

module.exports = updateGames;
