const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const weekSchema = new Schema({
  weekNo: Number,
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

weekSchema.methods.weekName = () => {
  return this.weekName ? this.weekName : `Week ${this.weekNo}`;
}

module.exports = mongoose.model('Week', weekSchema);