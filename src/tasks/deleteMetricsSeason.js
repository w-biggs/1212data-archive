const mongoose = require('mongoose');
const Season = require('../models/schedules/season.model');
const TeamMetrics = require('../models/teamMetrics.model');
const CoachMetrics = require('../models/coachMetrics.model');

const deleteTeamMetricsSeason = async function deleteTeamMetricsSeason(seasonId) {
  const teamsMetrics = await TeamMetrics.find();
  for (let i = 0; i < teamsMetrics.length; i += 1) {
    const teamMetrics = teamsMetrics[i];
    for (let j = 0; j < teamMetrics.seasons.length; j += 1) {
      const season = teamMetrics.seasons[j];
      if (season.season.equals(seasonId)) {
        for (let k = 0; k < season.weeks.length; k += 1) {
          const week = season.weeks[k];
          if (week.preseason) {
            season.weeks = [week];
          }
        }
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await teamMetrics.save();
  }
  return true;
};

const deleteCoachMetricsSeason = async function deleteCoachMetricsSeason(seasonWeeks) {
  const coachesMetrics = await CoachMetrics.find();
  for (let i = 0; i < coachesMetrics.length; i += 1) {
    const coachMetrics = coachesMetrics[i];
    const saveWeeks = [];
    for (let j = 0; j < coachMetrics.weeks.length; j += 1) {
      const week = coachMetrics.weeks[j];
      let save = true;
      for (let k = 0; k < seasonWeeks.length; k += 1) {
        if (week.week.equals(seasonWeeks[k])) {
          save = false;
        }
      }
      if (save) {
        saveWeeks.push(week);
      }
    }
    coachMetrics.weeks = saveWeeks;
    // eslint-disable-next-line no-await-in-loop
    await coachMetrics.save();
  }
};

const deleteMetricsSeason = async function deleteMetricsSeason(seasonNo) {
  const searchSeason = await Season.findOne({ seasonNo });
  mongoose.set('debug', true);
  await deleteTeamMetricsSeason(searchSeason._id);
  await deleteCoachMetricsSeason(searchSeason.weeks);
  mongoose.set('debug', false);
  return true;
};

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => deleteMetricsSeason(3))
  .then(() => mongoose.disconnect())
  .catch(console.error);
