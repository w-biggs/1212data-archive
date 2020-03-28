/* eslint-disable no-await-in-loop */
const { getElo, calcGameElo } = require('./calcElo');
const Team = require('../models/teams/team.model');
const TeamMetrics = require('../models/teamMetrics.model');
const Season = require('../models/schedules/season.model');
// const Week = require('../models/schedules/week.model');
// const Game = require('../models/schedules/game.model');

const updateTeamElo = async function updateTeamElo(team, season, week, game, oppElo, oldElo, elo) {
  // Get the team's metrics
  const teamMetrics = await TeamMetrics.findOne({ team: team._id }).exec();

  // Find the given season in the metrics
  let eloSeason = false;
  for (let i = 0; i < teamMetrics.seasons.length; i += 1) {
    const metricsSeason = teamMetrics.seasons[i];
    if (metricsSeason.season.equals(season._id)) {
      eloSeason = metricsSeason;
    }
  }
  
  // If the season is not in the metrics
  if (eloSeason === false) {
    // Don't add the season if not adding a null week - you need the preseason elo to start
    if (week !== null) {
      throw new Error(`Season not found and week not null for team ${team.name}`);
    }

    // Add the new season
    console.log(`Adding ${team.name} metrics season ${season.seasonNo}`);
    teamMetrics.seasons.push({
      season: season._id,
      weeks: [{
        preseason: true,
        elo: {
          oldElo,
          elo,
        },
      }],
    });
    return teamMetrics.save();
  }

  // Find the week we're updating
  for (let i = 0; i < eloSeason.weeks.length; i += 1) {
    const metricsWeek = eloSeason.weeks[i];
    if ((typeof metricsWeek.week === 'undefined' && week === null)
      || (typeof metricsWeek.week !== 'undefined' && metricsWeek.week.equals(week._id))) {
      console.log(`Updating week ${week ? week.weekNo : 'preseason'} in ${team.name} metrics season ${season.seasonNo}`);
      if (game) {
        metricsWeek.game = game._id;
      }
      metricsWeek.elo = {
        oppElo,
        oldElo,
        elo,
      };
      return teamMetrics.save();
    }
  }

  // If the week we're updating doesn't exist yet
  console.log(`Adding week ${week.weekNo} to ${team.name} metrics season ${season.seasonNo}`);
  eloSeason.weeks.push({
    week: week._id,
    game: game._id,
    elo: {
      oppElo,
      oldElo,
      elo,
    },
  });
  return teamMetrics.save();
};

/**
 * Update teams' elo for a specific week.
 * @param {import('mongoose').Document} week The week document. Null for preseason.
 * @param {import('mongoose').Document} season The season document.
 */
const updateWeekElo = async function updateWeekElo(week, season) {
  const eloUpdates = [];
  if (week === null) {
    const prevSeason = await Season.findOne({ seasonNo: season.seasonNo - 1 }).exec();
    const teams = await Team.find().exec();
    for (let i = 0; i < teams.length; i += 1) {
      const team = teams[i];
      const oldElo = await getElo(team, Number.MAX_VALUE, prevSeason);
      const newElo = ((oldElo / 3) * 2) + 500; // Reset 1/3 of the way to 1500
      eloUpdates.push(
        updateTeamElo(team, season, null, null, null, oldElo, newElo),
      );
    }
  } else {
    for (let i = 0; i < week.games.length; i += 1) {
      const gameId = week.games[i];
      const gameElo = await calcGameElo(gameId);
      if (gameElo) {
        const {
          game,
          homeTeam,
          awayTeam,
          homeElo,
          awayElo,
        } = gameElo;

        eloUpdates.push(
          updateTeamElo(homeTeam, season, week, game, homeElo.oppElo, homeElo.oldElo, homeElo.elo),
          updateTeamElo(awayTeam, season, week, game, awayElo.oppElo, awayElo.oldElo, awayElo.elo),
        );
      }
    }
  }
  return Promise.all(eloUpdates);
};

module.exports = {
  updateWeekElo,
};
