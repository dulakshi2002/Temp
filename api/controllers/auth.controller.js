import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { errorHandler } from "../utils/error.js";
import jwt from "jsonwebtoken";

// SIGNUP
export const signup = async (req, res, next) => {
  const { username, email, password, role } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return next(errorHandler(400, "User already exists"));

    const hashedPassword = bcryptjs.hashSync(password, 10);

    const isAdmin = role === "admin"; 

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "student",
      isAdmin,
    });

    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    next(error);
  }
};

// SIGNIN
export const signin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const validUser = await User.findOne({ email });
    if (!validUser) return next(errorHandler(404, "User not found"));

    const validPassword = bcryptjs.compareSync(password, validUser.password);
    if (!validPassword) return next(errorHandler(401, "Wrong credentials"));

    const token = jwt.sign(
      { id: validUser._id, isAdmin: validUser.isAdmin, role: validUser.role },
      process.env.JWT_SECRET
    );

    const { password: hashedPassword, ...rest } = validUser._doc;
    const expiryDate = new Date(Date.now() + 86400000); // 1 day

    res
      .cookie("access_token", token, { httpOnly: true, expires: expiryDate })
      .status(200)
      .json({
        ...rest,
        token,
        role: validUser.role,
        isAdmin: validUser.isAdmin,
      });
  } catch (error) {
    next(error);
  }
};

// GOOGLE (optional – keep as is, only tweak user fields)
export const google = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin, role: user.role },
        process.env.JWT_SECRET
      );
      const { password: hashedPassword, ...rest } = user._doc;
      const expiryDate = new Date(Date.now() + 86400000); // 1 day
      return res
        .cookie("access_token", token, {
          httpOnly: true,
          expires: expiryDate,
        })
        .status(200)
        .json(rest);
    } else {
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);
      const newUser = new User({
        username:
          req.body.name.split(" ").join("").toLowerCase() +
          Math.random().toString(36).slice(-8),
        email: req.body.email,
        password: hashedPassword,
        profilePicture: req.body.photo,
        role: "student",
        isAdmin: false,
      });
      await newUser.save();
      const token = jwt.sign(
        { id: newUser._id, isAdmin: newUser.isAdmin, role: newUser.role },
        process.env.JWT_SECRET
      );
      const { password: hashedPassword2, ...rest } = newUser._doc;
      const expiryDate = new Date(Date.now() + 86400000); // 1 day
      return res
        .cookie("access_token", token, {
          httpOnly: true,
          expires: expiryDate,
        })
        .status(200)
        .json(rest);
    }
  } catch (error) {
    next(error);
  }
};

// SIGNOUT
export const signout = (req, res) => {
  res.clearCookie("access_token").status(200).json("Signout success!");
};

// NEW: GET CURRENT USER (for frontend session & ACE)
export const getCurrentUser = async (req, res, next) => {
  try {
    // verifyToken already set req.user
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};
