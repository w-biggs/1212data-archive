/* eslint-disable no-await-in-loop */
/**
 * Streamlines adding a new week and its games.
 */
const mongoose = require('mongoose');
const Season = require('./models/schedules/season.model');
const Team = require('./models/teams/team.model');
const TeamMetrics = require('./models/teamMetrics.model');

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.log(`Requires one argument - season number. ${args.length} arguments were given.`);
  process.exit(1);
}

const seasonNo = parseInt(args[0], 10);

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => {
    Season.findOne({ seasonNo })
      .then((season) => Team.find({ [`division.${seasonNo - 1}`]: { $not: { $eq: null } } })
        .then(async (teams) => {
          for (let i = 0; i < teams.length; i += 1) {
            const team = teams[i];
            await TeamMetrics.findOne({ team: team._id })
              .then(async (metrics) => {
                const lastSeason = metrics.seasons[metrics.seasons.length - 1];
                const oldElo = lastSeason.weeks[lastSeason.weeks.length - 1].elo.elo;
                metrics.seasons.push({
                  season: season._id,
                  weeks: [{
                    elo: {
                      oppElo: null,
                      oldElo,
                      elo: ((oldElo * 2) + 1500) / 3,
                    },
                    preseason: true,
                  }],
                });
                await metrics.save();
              });
          }
        }))
      .catch(console.error)
      .finally(() => mongoose.disconnect());
  });
