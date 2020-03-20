const mongoose = require('mongoose');

const { Schema } = mongoose;

const levelSchema = new Schema({
  name: String,
  abbreviation: String,
  conferences: [{
    type: Schema.Types.ObjectId,
    ref: 'Conference',
  }],
});

module.exports = mongoose.model('Level', levelSchema);
