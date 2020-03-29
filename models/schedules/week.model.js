const mongoose = require('mongoose');

const { Schema } = mongoose;

const weekSchema = new Schema({
  weekNo: {
    type: Number,
    required: [true, 'All weeks must have a week number.'],
  },
  weekName: String,
  season: {
    type: Schema.Types.ObjectId,
    ref: 'Season',
  },
  games: [{
    type: Schema.Types.ObjectId,
    ref: 'Game',
  }],
});

weekSchema.index({ season: 1, weekNo: 1 }, { unique: true });

weekSchema.methods.getWeekName = () => (this.weekName ? this.weekName : `Week ${this.weekNo}`);

weekSchema.methods.getSortedGames = function getSortedGames() {
  return this.populate({
    path: 'games',
    populate: [{
      path: 'homeTeam.team',
      select: '-_id',
      populate: {
        path: 'division',
        select: '-_id',
        options: {
          retainNullValues: true,
        },
        populate: {
          path: 'conference',
          select: 'name shortName -_id',
        },
      },
    }, {
      path: 'homeTeam.coaches.coach',
      select: '-_id',
    }, {
      path: 'awayTeam.team',
      select: '-_id',
      populate: {
        path: 'division',
        select: '-_id',
        options: {
          retainNullValues: true,
        },
        populate: {
          path: 'conference',
          select: 'name shortName -_id',
        },
      },
    }, {
      path: 'awayTeam.coaches.coach',
      select: '-_id',
    }],
  })
    .execPopulate()
    .then((populatedWeek) => {
      const { games } = populatedWeek;
      games.sort((a, b) => {
        const [gameA, gameB] = [a, b].map((game) => {
          const timeElapsed = game.status.quarter
            ? ((game.status.quarter - 1) * 420) + (420 - game.status.clock)
            : 1680;
          return {
            timeElapsed: game.live ? timeElapsed : 1680,
            lastUpdate: game.endTime,
          };
        });
        if (gameA.timeElapsed === gameB.timeElapsed) {
          return gameB.lastUpdate - gameA.lastUpdate;
        }
        if (gameA.timeElapsed === 1680) {
          return 1;
        }
        if (gameB.timeElapsed === 1680) {
          return -1;
        }
        return gameB.timeElapsed - gameA.timeElapsed;
      });
      return games;
    });
};

module.exports = mongoose.model('Week', weekSchema);
