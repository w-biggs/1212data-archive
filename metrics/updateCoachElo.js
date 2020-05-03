/* eslint-disable no-await-in-loop */
const { calcGameCoachElo } = require('./calcCoachElo');
const CoachMetrics = require('../models/coachMetrics.model');
// const Week = require('../models/schedules/week.model');
// const Game = require('../models/schedules/game.model');

const updateCoachElo = async function updateCoachElo(
  coach, week, game, oppElo, oldElo, elo,
) {
  // Get the team's metrics
  const coachMetrics = await CoachMetrics.findOne({ coach: coach._id }).exec();

  // Find the given week in the metrics
  let eloWeek = false;
  for (let i = 0; i < coachMetrics.weeks.length; i += 1) {
    const metricsWeek = coachMetrics.weeks[i];
    if (metricsWeek.week.equals(week._id)) {
      eloWeek = metricsWeek;
    }
  }
  
  // If the week is not in the metrics
  if (eloWeek === false) {
    // Add the new week
    console.log(`Adding ${coach.username} metrics week ${week.weekNo}`);
    coachMetrics.weeks.push({
      week: week._id,
      games: [{
        game: game._id,
        elo: {
          oppElo,
          oldElo,
          elo,
        },
      }],
    });
    return coachMetrics.save();
  }

  // Find the week
  const eloGame = eloWeek.games.find((eG) => eG.game.equals(game._id));
  if (!eloGame) {
    console.log(`Updating week ${week.weekNo} in ${coach.username} metrics`);
    eloWeek.games.push({
      game: game._id,
      elo: {
        oppElo,
        oldElo,
        elo,
      },
    });
    return coachMetrics.save();
  }

  console.log(`Game already existed in week ${week.weekNo} of ${coach.username} metrics`);
  return true;
};

/**
 * Update teams' elo for a specific week.
 * @param {import('mongoose').Document} week The week document, populated and sorted.
 */
const updateWeekCoachElo = async function updateWeekCoachElo(week) {
  const eloUpdates = [];
  for (let i = 0; i < week.games.length; i += 1) {
    const gameId = week.games[i];
    const gameElo = await calcGameCoachElo(gameId);
    if (gameElo) {
      for (let j = 0; j < gameElo.length; j += 1) {
        const coachElo = gameElo[j];
        const {
          game,
          coach,
          oppElo,
          oldElo,
          elo,
        } = coachElo;

        eloUpdates.push(
          updateCoachElo(coach, week, game, oppElo, oldElo, elo),
        );
      }
    }
  }
  return Promise.all(eloUpdates);
};

module.exports = {
  updateWeekCoachElo,
};
