const mongoose = require('mongoose');
const Season = require('./schedules/season.model');

const { Schema } = mongoose;

const teamMetricsSchema = new Schema({
  team: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  seasons: [{
    season: {
      type: Schema.Types.ObjectId,
      ref: 'Season',
      required: true,
    },
    weeks: [{
      preseason: {
        type: Boolean,
        default: false,
      },
      week: {
        type: Schema.Types.ObjectId,
        ref: 'Week',
      },
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
    wPN: Number,
  }],
});

teamMetricsSchema.methods.getCurrentElo = function getCurrentElo() {
  const latestSeason = this.seasons[this.seasons.length - 1];
  const latestWeek = latestSeason.weeks[latestSeason.weeks.length - 1];
  return latestWeek.elo.elo;
};

teamMetricsSchema.statics.getRanges = async function getRanges() {
  // const start = process.hrtime();
  const fetches = [];
  fetches.push(
    Season.find().lean()
      .populate([{
        path: 'weeks',
        select: 'weekNo',
      }])
      .exec(),
    this.find()
      .lean()
      .populate([{
        path: 'seasons.season',
        select: 'seasonNo -_id',
      }, {
        path: 'seasons.weeks.week',
        select: 'weekNo -_id',
      }])
      .exec(),
  );
  const [seasons, metrics] = await Promise.all(fetches);
  // const mid = process.hrtime(start);
  // const midStart = process.hrtime();
  const ranges = seasons.map(season => ({
    seasonNo: season.seasonNo,
    weeks: [{
      weekNo: -1,
      min: 1500,
      max: 1500,
    },
    ...season.weeks.map(week => ({ weekNo: week.weekNo, min: 1500, max: 1500 })),
    ],
  }));
  for (let i = 0; i < metrics.length; i += 1) {
    const singleMetrics = metrics[i];
    for (let j = 0; j < ranges.length; j += 1) {
      const season = ranges[j];
      const metricsSeason = singleMetrics.seasons.find(
        mS => mS.season.seasonNo === season.seasonNo,
      );
      if (metricsSeason) {
        let rollingElo = 0;
        for (let k = 0; k < season.weeks.length; k += 1) {
          const week = season.weeks[k];
          const metricsWeek = metricsSeason.weeks.find((mW) => {
            if (mW.preseason === true) {
              return (week.weekNo === -1);
            }
            return (mW.week.weekNo === week.weekNo);
          });
          if (metricsWeek) {
            rollingElo = metricsWeek.elo.elo;
          }
          if (rollingElo < week.min) {
            week.min = rollingElo;
          } else if (rollingElo > week.max) {
            week.max = rollingElo;
          }
        }
      }
    }
  }
  // const end = process.hrtime(midStart);
  // console.log(`${mid[0]}s ${mid[1] / 1e6}ms`);
  // console.log(`${end[0]}s ${end[1] / 1e6}ms`);
  return ranges;
};

module.exports = mongoose.model('TeamMetrics', teamMetricsSchema);
