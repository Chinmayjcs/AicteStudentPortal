const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  usn: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  college: { type: String, enum: ["BMSIT&M", "NITTE", "BMSCE"], required: true }
});

module.exports = mongoose.model("User", userSchema);
