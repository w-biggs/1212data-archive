const mongoose = require('mongoose');
const Week = require('./schedules/week.model');

const { Schema } = mongoose;

const coachMetricsSchema = new Schema({
  coach: {
    type: Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  weeks: [{
    week: {
      type: Schema.Types.ObjectId,
      ref: 'Week',
    },
    games: [{
      game: {
        type: Schema.Types.ObjectId,
        ref: 'Game',
      },
      elo: {
        oppElo: Number,
        oldElo: Number,
        elo: Number,
      },
    }],
  }],
});

coachMetricsSchema.methods.getCurrentElo = function getCurrentElo() {
  const latestWeek = this.weeks[this.weeks.length - 1];
  const latestGame = latestWeek.games[latestWeek.games.length - 1];
  return latestGame.elo.elo;
};

coachMetricsSchema.statics.getRanges = async function getRanges() {
  const start = process.hrtime();
  const fetches = [];
  fetches.push(
    Week.find().lean()
      .populate('season', 'seasonNo')
      .exec(),
    this.find()
      .lean()
      .populate({
        path: 'weeks.week',
        select: 'weekNo',
        populate: {
          path: 'season',
          select: 'seasonNo',
        },
      })
      .exec(),
  );
  const [weeks, metrics] = await Promise.all(fetches);
  const mid = process.hrtime(start);
  const midStart = process.hrtime();
  const ranges = weeks.map(week => ({
    seasonNo: week.season.seasonNo,
    weekNo: week.weekNo,
    min: 1500,
    max: 1500,
  }));
  for (let i = 0; i < metrics.length; i += 1) {
    const singleMetrics = metrics[i];
    let rollingElo = 1500;
    for (let j = 0; j < ranges.length; j += 1) {
      const week = ranges[j];
      const metricsWeek = singleMetrics.weeks.find(
        mW => mW.week.season.seasonNo === week.seasonNo && mW.week.weekNo === week.weekNo,
      );
      if (metricsWeek) {
        const latestGame = metricsWeek.games[metricsWeek.games.length - 1];
        rollingElo = latestGame.elo.elo;
      }
      if (rollingElo < week.min) {
        week.min = rollingElo;
      } else if (rollingElo > week.max) {
        week.max = rollingElo;
      }
    }
  }
  const end = process.hrtime(midStart);
  console.log(`${mid[0]}s ${mid[1] / 1e6}ms`);
  console.log(`${end[0]}s ${end[1] / 1e6}ms`);
  return ranges;
};

module.exports = mongoose.model('CoachMetrics', coachMetricsSchema);
