require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Changed bcrypt to bcryptjs
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(bodyParser.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

// Static folder to serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const apkPath = path.join(__dirname, "uploads/app-release.apk");

// MongoDB connection

const uri = "mongodb+srv://jmudit467:dcHvfaWWcjJLLlWv@zucol.f1wni.mongodb.net/?retryWrites=true&w=majority&appName=zucol";

mongoose.connect(uri)
.then(() => console.log("MongoDB connected successfully"))
.catch(err => console.error("Connection error:", err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String }, // For storing image path
});

const User = mongoose.model("User", userSchema);

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save images to the 'uploads' folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name
  },
});
const upload = multer({ storage });

// Signup Route with Profile Image
app.post("/api/signup", upload.single("profileImage"), async (req, res) => {
  const { username, email, phone, password } = req.body;

  if (!username || !email || !phone || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash the password using bcryptjs
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle profile image
    const profileImagePath = req.file ? `/uploads/${req.file.filename}` : "";

    // Save the user to the database
    const newUser = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      profileImage: profileImagePath,
    });

    await newUser.save();

    // Generate a JWT token (optional)
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || "your_jwt_secret", {
      expiresIn: "1d",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        profileImage: profileImagePath,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Compare the entered password with the stored password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Send user details
    const userDetails = {
      id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage || '',
    };

    res.status(200).json({ userDetails });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/update-profile/:userId', upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user details
    if (req.body.username) user.username = req.body.username;
    if (req.body.email) user.email = req.body.email;
    if (req.body.phone) user.phone = req.body.phone;

    // Update profile image if a new one is uploaded
    if (req.file) {
      user.profileImage = `/uploads/${req.file.filename}`;
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile', error });
  }
});

app.delete('/delete-user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find and delete the user
    const result = await User.findByIdAndDelete(userId);

    if (result) {
      res.status(200).json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get("/get-users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Route to download APK
app.get("/download-apk", (req, res) => {
  res.download(apkPath, "app-release.apk", (err) => {
    if (err) {
      res.status(500).send("Unable to download APK file.");
    }
  });
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "m.sethia465@gmail.com", // Replace with your email
    pass: "tkef xivi yqou hqeg",  // Replace with your app-specific password
  },
});

// Send APK link
app.get("/send-apk", async (req, res) => {
  const testerEmails = ["jmudit467@gmail.com", "jmudit66@gmail.com"];

  const mailOptions = {
    from: "m.sethia65@gmail.com",
    to: testerEmails.join(", "),
    subject: "Download the Latest APK",
    text: `Hi,\n\nPlease click the link below to download the latest APK:\n\nhttp://localhost:${PORT}/download-apk\n\nThank you!`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send("APK download link has been sent to testers!");
  } catch (error) {
    res.status(500).send("Failed to send email.");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
