const express = require("express");
const router = express.Router();
const Certificate = require("../models/Certificate");
const mongoose = require("mongoose");

router.get("/:usn", async (req, res) => {
  try {
    const { usn } = req.params;
    const certificates = await Certificate.find({ usn });
    // Compute approved points from Event model registered in server
    const Event = mongoose.model("Event");
    const approvedEvents = await Event.find({ usn, status: "approved" });
    const totalPoints = approvedEvents.reduce((sum, e) => sum + (e.point || 0), 0);
    res.json({ certificates, totalPoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
