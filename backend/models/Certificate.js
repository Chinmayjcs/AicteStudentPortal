const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  title: String,
  points: Number,
  date: { type: Date, default: Date.now },
  usn: { type: String, required: true } // link to student
});

module.exports = mongoose.model("Certificate", certificateSchema);
