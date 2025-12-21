import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

export const test = (req, res) => {
  res.json({
    message: "API is working!",
  });
};

export const verifyAdmin = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return next(errorHandler(401, "Unauthorized access!"));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(errorHandler(403, "Invalid token!"));
    if (!decoded.isAdmin)
      return next(errorHandler(403, "Admin access required!"));
    req.user = decoded;
    next();
  });
};

// UPDATE USER
export const updateUser = async (req, res, next) => {
  try {
    if (req.body.password) {
      req.body.password = bcryptjs.hashSync(req.body.password, 10);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found!" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          username: req.body.username,
          email: req.body.email,
          password: req.body.password,
          profilePicture: req.body.profilePicture,
          role: req.body.role || user.role,
          isAdmin:
            typeof req.body.isAdmin === "boolean"
              ? req.body.isAdmin
              : user.isAdmin,
        },
      },
      { new: true }
    );

    const { password, ...rest } = updatedUser._doc;
    res.status(200).json({ ...rest, isAdmin: updatedUser.isAdmin });
  } catch (error) {
    next(error);
  }
};

// GET ALL USERS
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find(
      {},
      "username email profilePicture role isAdmin"
    );
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

// DELETE USER
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.isAdmin || req.user.id === req.params.id) {
      await User.findByIdAndDelete(req.params.id);
      return res
        .status(200)
        .json({ message: "User has been deleted successfully." });
    } else {
      return next(
        errorHandler(403, "You do not have permission to delete this account.")
      );
    }
  } catch (error) {
    next(error);
  }
};
