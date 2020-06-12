const mongoose = require('mongoose');

const { Schema } = mongoose;

const divisionSchema = new Schema({
  name: String,
  conference: {
    type: Schema.Types.ObjectId,
    ref: 'Conference',
  },
});

module.exports = mongoose.model('Division', divisionSchema);
