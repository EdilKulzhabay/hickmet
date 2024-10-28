const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema(
    {
        iin: {
            type: String,
            required: true
        },
        balance: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", UserSchema);