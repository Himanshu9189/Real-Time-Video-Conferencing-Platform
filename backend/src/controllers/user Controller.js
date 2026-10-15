import { User } from "../models/user.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(404).json({
            message: "Please Provide"
        });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "User Not Found"
            });
        }

        let isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;

            await user.save();

            return res.status(httpStatus.OK).json({
                token: token
            });

        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Invalid username or password"
            });
        }

    } catch (e) {
        return res.status(500).json({
            message: `something went wrong ${e}`
        });
    }
};


const register = async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(httpStatus.FOUND).json({
                message: "User already exist"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(httpStatus.CREATED).json({
            message: "User Registered"
        });

    } catch (e) {
        res.json({
            message: `something went wrong ${e}`
        });
    }
};


// ADD USER ACTIVITY
const addToActivity = async (req, res) => {
    console.log("ADD ACTIVITY CALLED");
    console.log(req.body);


    const { token, meeting_code } = req.body;

    try {

        const user = await User.findOne({ token });
        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        })


        await newMeeting.save();

        return res.status(httpStatus.OK).json({ message: "Activity added"});

    } catch (e) {

        return res.status(500).json({ message: `Something went wrong ${e}` });

    }
};


// GET USER ACTIVITY
const getAllActivity = async (req, res) => {

    const { token } = req.query;

    try {

        const user = await User.findOne({ token });
        const meetings = await Meeting.find({ user_id: user.username })

         res.json(meetings)
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}

       


export {
    login,
    register,
    addToActivity,
    getAllActivity
};