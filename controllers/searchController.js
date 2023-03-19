const Recipe = require('../models/Recipe.js')
const User = require('../models/User.js')
const mongoose = require('mongoose')
const { s3, PutObjectCommand, bucketName, GetObjectCommand, DeleteObjectCommand, getSignedUrl } = require('../config/s3');
const { parseISO, addSeconds } = require('date-fns');
const asyncHandler = require('express-async-handler')
const crypto = require('crypto')


function isExpired(url) {
    const params = new Proxy(new URLSearchParams(url), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    const creationDate = parseISO(params['X-Amz-Date']);
    const expiresInSecs = Number(params['X-Amz-Expires']);

    const expiryDate = addSeconds(creationDate, expiresInSecs);

    return expiryDate < new Date();
}


const getSearchResults = asyncHandler(async (req, res) => {

    const query = req.query.q;

    const userid = req.userid;

    const user = await User.findById(userid).lean().exec();

    if (!user) {
        return res.status(400).json({ message: 'No such user exists, cannot retrieve search results' })
    }

    let recipeSearchResults = []

    recipeSearchResults = await Recipe.aggregate([
        {
            $search: {
                index: 'recipeSearch',
                text: {
                    query: query,
                    path: {
                        wildcard: "*"
                    },
                    fuzzy: {}
                }
            }
        },
        {
            $match: {
                $or: [
                    { public: true },
                    { owner: mongoose.Types.ObjectId(userid) }
                ]
            }
        },
        {
            $project: {
                steps: 0,
                stepImages: 0
            }

        },
        {
            $limit: 20
        }
    ]).exec()

    let favoriteids = new Set();

    if (user.favorites) {
        for (const faveid of user.favorites) {
            favoriteids.add(faveid.toString())
        }
    }

    let recipeProfPics = []
    let recipeCoverIms = []
    let ownerids = new Set();


    for (const recipe of recipeSearchResults) {

        let updated = false

        const imagesCover = {
            id: recipe._id,
            coverImages: []
        }

        if (recipe.coverImages) {
            for (const item of recipe.coverImages) {
                if (!item.imageURL || isExpired(item.imageURL)) {
                    updated = true;
                    const getObjectParams = {
                        Bucket: bucketName,
                        Key: item.imageName
                    }

                    const command = new GetObjectCommand(getObjectParams);

                    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                    item.imageURL = url;

                    const newitem = { imageName: item.imageName, imageURL: item.imageURL }
                    imagesCover.coverImages.push(newitem)
                } else {
                    imagesCover.coverImages.push(item)
                }
            }
        }

        if (updated) {
            const r = await Recipe.findById(recipe._id).exec()
            r.coverImages = imagesCover.coverImages;
            await r.save()
        }

        recipeCoverIms.push(imagesCover);
        delete recipe.coverImages;

        if (recipe.owner.toString() === userid) {
            delete recipe.owner
        } else {
            delete recipe.public
            ownerids.add(recipe.owner)

        }
    }

    const owners = [...ownerids];

    const ownerList = owners.length > 0 ? await User.find({ _id: { $in: owners } }).select('_id profilePicture username').exec() : [];

    let usernamesList = new Map();

    for (const foundUser of ownerList) {
        usernamesList.set(foundUser._id.toString(), foundUser.username)

        if (!foundUser.profilePicture || !foundUser.profilePicture.imageName) {
            recipeProfPics.push({ imageURL: '', id: foundUser._id })
            continue
        }

        if (!foundUser.profilePicture.imageURL || isExpired(foundUser.profilePicture.imageURL)) {
            const getObjectParams = {
                Bucket: bucketName,
                Key: foundUser.profilePicture.imageName
            }

            const command = new GetObjectCommand(getObjectParams);

            const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

            foundUser.profilePicture.imageURL = url;

            recipeProfPics.push({ imageURL: url, id: foundUser._id })


            await foundUser.save();


        } else {
            recipeProfPics.push({ imageURL: foundUser.profilePicture.imageURL, id: foundUser._id })
        }
    }

    for (const recipe of recipeSearchResults) {
        if(recipe.hasOwnProperty('owner')){
            recipe.ownerusername = usernamesList.get(recipe.owner.toString())
        }

        recipe.favorite = favoriteids.has(recipe._id.toString()) ? true : false;


    }

    const following = user.following ? new Set(user.following.map((item) => item.toString())) : new Set();

    let userSearchResults = []

    userSearchResults = await User.aggregate([
        {
            $search: {
                index: "userSearch",
                text: {
                    query: query,
                    path: 'username',
                    fuzzy: {}
                }
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0
            }

        },
        {
            $limit: 20
        }
    ]).exec()


    for (const userResult of userSearchResults) {

        let updated = false;
        let url = ''

        if (userResult.profilePicture && userResult.profilePicture.imageName) {
            if (!userResult.profilePicture.imageURL || isExpired(userResult.profilePicture.imageURL)) {
                updated = true;
                const getObjectParams = {
                    Bucket: bucketName,
                    Key: userResult.profilePicture.imageName
                }

                const command = new GetObjectCommand(getObjectParams);

                url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour
            }else{
                url = userResult.profilePicture.imageURL;
            }
        }

        if (updated) {
            const u = await User.findById(userResult._id).exec()
            u.profilePicture.imageURL = url
            u.save()
        }

        if (userResult._id.toString() !== userid) {
            if (following.has(userResult._id.toString())) {
                userResult.followed = true
            } else {
                userResult.followed = false
            }
        }

        userResult.profilePictureURL = url;
        delete userResult.profilePicture;

    }


    res.json({ users: userSearchResults, recipes: recipeSearchResults, recipeProfPics: recipeProfPics, recipeCoverIms: recipeCoverIms})








})

const getAutoCompleteRecipeResults = asyncHandler(async (req, res) => {
    const query = req.query.q;

    const userid = req.userid;

    const user = await User.findById(userid).lean().exec();

    if (!user) {
        return res.status(400).json({ message: 'No such user exists, cannot retrieve search results' })
    }


    const suggestions = await Recipe.aggregate([
        {
            $search: {
                index: 'recipeAutocompleteSearch',
                compound: {
                    should: [
                        {
                            autocomplete:
                            {
                                query: query,
                                path: 'title',
                                fuzzy: {}
                            }
                        },

                        {
                            autocomplete:
                            {
                                query: query,
                                path: 'ingredients.ingredient',
                                fuzzy: {}
                            }
                        }

                    ],
                }
            }
        },
        {
            $match: {
                $or: [
                    { public: true },
                    { owner: mongoose.Types.ObjectId(userid) }
                ]
            }
        },

        {
            $limit: 8
        }
    ]).exec()



    //get usernames for recipe owners!

    const ids = suggestions.map((item) => item.owner.toString())

    const usernames = new Map();

    const owners = await User.find({ _id: { $in: ids } }).select('username _id').exec()

    for (const owner of owners) {
        usernames.set(owner._id.toString(), owner.username)
    }

    for (const recipe of suggestions) {
        recipe.ownerusername = usernames.get(recipe.owner.toString())
    }

    res.json(suggestions);


})


module.exports = { getSearchResults, getAutoCompleteRecipeResults }