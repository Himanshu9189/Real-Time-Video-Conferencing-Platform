import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({

    name: { type: String, required: true },

    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    token: {
        type: String
    },

    history: {
        type: [
            {
                meetingCode: String,
                date: Date
            }
        ],
        default: []
    }

});

const User = mongoose.model("User", userSchema);

export { User };