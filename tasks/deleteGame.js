const mongoose = require('mongoose');
const Game = require('../models/schedules/game.model');
const TeamMetrics = require('../models/teamMetrics.model');
const CoachMetrics = require('../models/coachMetrics.model');

const args = process.argv.slice(2);

const deleteMetricsGame = async function deleteMetricsGame(gameRef, teamRef) {
  const metrics = await TeamMetrics.findOne({ team: teamRef }).exec();

  for (let i = 0; i < metrics.seasons.length; i += 1) {
    const season = metrics.seasons[i];
    for (let j = 0; j < season.weeks.length; j += 1) {
      const week = season.weeks[j];
      if (week.game && week.game.equals(gameRef)) {
        metrics.seasons[i].weeks.splice(j, 1);
        return metrics.save();
      }
    }
  }

  return false;
};

const deleteCoachMetricsGame = async function deleteCoachMetricsGame(gameRef, coachRef) {
  const metrics = await CoachMetrics.findOne({ coach: coachRef }).exec();

  for (let i = 0; i < metrics.weeks.length; i += 1) {
    const week = metrics.weeks[i];
    const games = [];
    for (let j = 0; j < week.games.length; j += 1) {
      const game = week.games[j];
      if (!game.game.equals(gameRef)) {
        games.push(game);
      } else {
        console.log('found it!');
      }
    }
    if (!games.length) {
      metrics.weeks.splice(i, 1);
      console.log('deleting coach metrics week');
      return metrics.save();
    }
    metrics.weeks[i].games = games;
  }
  return metrics.save();
};

const deleteGame = async function deleteGame(gameId) {
  if (!gameId) {
    throw new Error('Missing args.');
  }

  const game = await Game.findOne({ gameId }).exec();

  if (!game) {
    throw new Error(`Game ${gameId} not found.`);
  }

  await deleteMetricsGame(game._id, game.homeTeam.team);
  await deleteMetricsGame(game._id, game.awayTeam.team);

  const coachMetricsDeletions = [];

  for (let i = 0; i < game.homeTeam.coaches.length; i += 1) {
    const coach = game.homeTeam.coaches[i];
    coachMetricsDeletions.push(deleteCoachMetricsGame(game._id, coach.coach));
  }
  for (let i = 0; i < game.awayTeam.coaches.length; i += 1) {
    const coach = game.awayTeam.coaches[i];
    coachMetricsDeletions.push(deleteCoachMetricsGame(game._id, coach.coach));
  }

  await Promise.all(coachMetricsDeletions);

  return Game.deleteOne({ gameId }).exec();
};

mongoose.set('debug', true);

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => deleteGame(...args))
  .then(() => mongoose.disconnect())
  .catch(console.error);
