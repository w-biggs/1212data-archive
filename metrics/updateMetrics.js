/* eslint-disable no-await-in-loop */
/**
 * Does the calculations for metrics.
 */
const mongoose = require('mongoose');
const { updateWeekElo } = require('./updateElo');
const Team = require('../models/teams/team.model');
const TeamMetrics = require('../models/teamMetrics.model');
const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
// const Game = require('../models/schedules/game.model');

const args = process.argv.slice(2);

/**
 * Create new team metrics for teams that don't have them.
 * @param {import('mongoose').Document} teamDoc The team's document.
 */
const generateMetrics = async function generateMetrics() {
  const teams = await Team.find().exec();
  const metricFetches = [];
  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    metricFetches.push(
      TeamMetrics.findOne({ team: team._id })
        .then((singleTeamMetrics) => {
          if (!singleTeamMetrics) {
            console.log(`Creating team metrics for ${team.name}`);
            const newTeamMetrics = new TeamMetrics({
              team: team._id,
            });
            return newTeamMetrics.save();
          }
          return true;
        }),
    );
  }
  await Promise.all(metricFetches);
};

/**
 * Update metrics.
 * @param {Number} seasonNo The season to update metrics for.
 * @param {Number} weekNo The week to update metrics for.
 */
const updateMetrics = async function updateMetrics(seasonNo = null, weekNo = null) {
  await generateMetrics();
  if (Number.isNaN(seasonNo) || Number.isNaN(weekNo)) {
    throw new Error('One of your arguments were invalid.');
  }
  const seasons = await Season.find(seasonNo ? { seasonNo } : null).exec();
  for (let i = 0; i < seasons.length; i += 1) {
    const season = seasons[i];
    // console.log(weekNo);
    if (weekNo === -1 || weekNo === null) {
      await updateWeekElo(null, season);
    }
    const weekSearchObj = {
      season: season._id,
    };
    if (weekNo !== null) {
      weekSearchObj.weekNo = weekNo;
    }
    const weeks = await Week.find(weekSearchObj).exec();
    for (let j = 0; j < weeks.length; j += 1) {
      const week = weeks[j];
      await updateWeekElo(week, season);
    }
  }
};

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => updateMetrics(...args.map(arg => parseInt(arg, 10))))
  .then(() => mongoose.disconnect())
  .catch(console.error);
