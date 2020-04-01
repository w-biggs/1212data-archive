const { ObjectId } = require('mongoose').Types;
const Team = require('../models/teams/team.model');
const TeamMetrics = require('../models/teamMetrics.model');
const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
const Game = require('../models/schedules/game.model');
const { generateTeamScore } = require('./calcWPN');
const avgScore = require('./avgScore');

const updateTeamWPN = async function updateTeamWPN(team, season, wPN) {
  // Get the team's metrics
  const teamMetrics = await TeamMetrics.findOne({ team: team._id }).exec();

  // Find the given season in the metrics
  let wPNSeason = false;
  for (let i = 0; i < teamMetrics.seasons.length; i += 1) {
    const metricsSeason = teamMetrics.seasons[i];
    if (metricsSeason.season.equals(season._id)) {
      wPNSeason = metricsSeason;
    }
  }
  
  // If the season is not in the metrics
  if (wPNSeason === false) {
    throw new Error(`Season ${season.seasonNo} not found for team ${team.name} when adding wPN.`);
  }

  console.log(`Updating season ${season.seasonNo} wPN for team ${team.name}`);
  wPNSeason.wPN = wPN;
  return teamMetrics.save();
};

const updateSeasonWPN = async function updateSeasonWPN(seasonNo) {
  const updates = [];

  const teams = await Team.find({
    [`division.${seasonNo - 1}`]: {
      $not: {
        $eq: new ObjectId('5e7ff80b509a2008ccbf4bf7'),
      },
    },
  }).exec();
  
  // Get the games
  const season = await Season.findOne({ seasonNo })
    .lean()
    .populate({
      path: 'weeks',
      model: Week,
      populate: {
        path: 'games',
        model: Game,
        populate: [{
          path: 'homeTeam.team',
          select: 'name',
        }, {
          path: 'awayTeam.team',
          select: 'name',
        }],
      },
    })
    .exec();

  const { medMov } = await avgScore();

  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const teamUpdate = generateTeamScore(team.name, season, false, 0.25, medMov)
      .then(wPN => updateTeamWPN(team, season, wPN.score));
    updates.push(teamUpdate);
  }

  return Promise.all(updates);
};

module.exports = updateSeasonWPN;
