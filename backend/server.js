const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// ---------------- DB CONNECTION ----------------
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected ✅"))
.catch(err => console.error("MongoDB connection error:", err));

// Models
const Certificate = require("./models/Certificate");
const Admin = require("./models/Admin");

// ---------------- SCHEMA ----------------
const eventSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    point: { type: Number, required: true },
    description: { type: String },
    approved: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    certificateImage: { type: Buffer }, // store image in DB as binary
    certificateImageType: { type: String }, // MIME type of uploaded image
    usn: { type: String, required: true }
});
const Event = mongoose.model("Event", eventSchema);

// ---------------- ADMIN ENDPOINTS ----------------
// Simple admin login using env ADMIN_ID and ADMIN_PASS (for demo only)
app.post("/admin/login", async (req, res) => {
    try {
        const { adminId, passkey } = req.body;
        // Try DB first
        const admin = await Admin.findOne({ adminId });
        if (admin) {
            const ok = await bcrypt.compare(passkey, admin.passhash);
            if (ok) return res.json({ token: "ok", name: admin.name, adminId: admin.adminId });
        }
        // Env fallback (legacy/demo)
        if (adminId === process.env.ADMIN_ID && passkey === process.env.ADMIN_PASS) {
            return res.json({ token: "ok", name: process.env.ADMIN_ID, adminId: process.env.ADMIN_ID });
        }
        return res.status(401).json({ error: "Invalid admin credentials" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Admin login failed" });
    }
});

// Create new admin
app.post("/admin/create", async (req, res) => {
    try {
        const { name, adminId, passkey } = req.body;
        if (!name || !adminId || !passkey) {
            return res.status(400).json({ error: "name, adminId and passkey are required" });
        }
        const exists = await Admin.findOne({ adminId });
        if (exists) return res.status(409).json({ error: "Admin ID already exists" });
        const passhash = await bcrypt.hash(passkey, 10);
        const admin = new Admin({ name, adminId, passhash });
        await admin.save();
        res.status(201).json({ message: "Admin created", admin: { name: admin.name, adminId: admin.adminId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create admin" });
    }
});

// Lightweight middleware placeholder (extend with real auth if needed)
function requireAdmin(req, res, next) { next(); }

// List all user USNs
app.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        const User = mongoose.model("User");
        const users = await User.find({}, { usn: 1, _id: 0 }).sort({ usn: 1 });
        res.json(users.map(u => u.usn));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// List pending (not evaluated) events
app.get("/admin/events/pending", requireAdmin, async (req, res) => {
    try {
        const pending = await Event.find({ status: "pending" }).select("eventName point usn status");
        res.json(pending);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch pending events" });
    }
});

// List events for a specific user
app.get("/admin/users/:usn/events", requireAdmin, async (req, res) => {
    try {
        const { usn } = req.params;
        const events = await Event.find({ usn }).select("eventName point description status approved");
        res.json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user events" });
    }
});

// Update event status (approve or reject)
app.patch("/admin/events/:id/status", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const approved = status === 'approved';
        const updated = await Event.findByIdAndUpdate(id, { status, approved }, { new: true });
        if (!updated) return res.status(404).json({ error: "Event not found" });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update event status" });
    }
});

// ---------------- MULTER CONFIG ----------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------------- ROUTES ----------------

// Create new event
app.post("/events", upload.single("certificateImage"), async (req, res) => {
    try {
        const { eventName, point, description, approved, usn } = req.body;
        const event = new Event({
            eventName,
            point,
            description,
            approved: approved === "true", // kept for backward compatibility
            status: "pending", // admin will evaluate later
            certificateImage: req.file ? req.file.buffer : null,
            certificateImageType: req.file ? req.file.mimetype : null,
            usn
        });
        await event.save();

        // Also create a Certificate document for dashboard aggregation
        const cert = new Certificate({
            title: eventName,
            points: Number(point) || 0,
            usn
        });
        await cert.save();

        res.status(201).json({ message: "Event created", event, certificate: cert });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create event" });
    }
});

// Get all events
app.get("/events", async (req, res) => {
    try {
        const events = await Event.find();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

// Get events for a specific user (by USN)
app.get("/events/user/:usn", async (req, res) => {
    try {
        const { usn } = req.params;
        const events = await Event.find({ usn }).select("eventName point description approved status certificateImage usn");
        // Map to include hasCertificate flag and expose _id
        const result = events.map(e => ({
            _id: e._id,
            eventName: e.eventName,
            point: e.point,
            description: e.description,
            approved: e.approved,
            status: e.status,
            hasCertificate: !!e.certificateImage,
        }));
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user's events" });
    }
});

// Serve certificate image for an event; add ?download=1 to force download
app.get("/events/:id/certificate", async (req, res) => {
    try {
        const { id } = req.params;
        const { download } = req.query;
        const event = await Event.findById(id);
        if (!event || !event.certificateImage) {
            return res.status(404).json({ error: "Certificate image not found" });
        }

        const mime = event.certificateImageType || "image/png";
        res.setHeader("Content-Type", mime);
        if (download) {
            const ext = mime.split("/")[1] || "png";
            res.setHeader("Content-Disposition", `attachment; filename=certificate-${id}.${ext}`);
        }
        res.send(event.certificateImage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to serve certificate image" });
    }
});

// Fallback to frontend for any other routes
//routes file link
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);
//dashboard file link
const dashboardRoutes = require("./routes/dashboard");
app.use("/dashboard", dashboardRoutes);

// Fallback to frontend for any unmatched route (must be after API routes)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});


// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
