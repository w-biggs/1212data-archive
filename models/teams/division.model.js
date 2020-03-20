const mongoose = require('mongoose');

const { Schema } = mongoose;

const divisionSchema = new Schema({
  name: String,
  conference: {
    type: Schema.Types.ObjectId,
    ref: 'Conference',
  },
  teams: [{
    type: Schema.Types.ObjectId,
    ref: 'Team',
  }],
});

module.exports = mongoose.model('Division', divisionSchema);
