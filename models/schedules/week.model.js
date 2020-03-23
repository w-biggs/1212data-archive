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

module.exports = mongoose.model('Week', weekSchema);
