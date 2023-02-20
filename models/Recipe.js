const mongoose = require('mongoose')

const recipeSchema = new mongoose.Schema(
    {
    title: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    public: {
        type: Boolean,
        required: true
    },

    ingredients: [{
        quantity: {type: Number},
        unit: {type: String},
        ingredient: {type: String}

    }],

    steps: [{
        type: String
    }],

    stepImages: [{
        stepNum: {type: Number},
        imageURL: {type: String},
        imageName: {type: String}
    }],

    coverImages: [{
        imageURL: {type: String},
        imageName: {type: String}
    }],

    calories: {
        type: Number
    },
    servings: {
        type: Number
    },
    cooktime: {
        type: String
    }
    },
    {
        timestamps: true
    }
)

module.exports = mongoose.model('Recipe', recipeSchema)