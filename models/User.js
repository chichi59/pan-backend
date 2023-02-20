const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
    {
    username: {
        type: String,
        required: true
    },
    password: {
        type: String, 
        required: true
    },
    firstname: {
        type: String,
    },
    lastname: {
        type: String,
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
    }],
    
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    refreshToken: {
        type: String
    },
    profilePicture: {
        imageName: {type: String},
        imageURL: {type: String}
    }
    },
    {
        timestamps: true
    }
)


module.exports = mongoose.model('User', userSchema)