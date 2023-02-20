const Recipe = require('../models/Recipe.js')
const User = require('../models/User.js')
const mongoose = require('mongoose')
const { s3, PutObjectCommand, bucketName, GetObjectCommand, DeleteObjectCommand, getSignedUrl } = require('../config/s3');
const { parseISO, addSeconds } = require('date-fns');



const asyncHandler = require('express-async-handler')
const crypto = require('crypto')


const getAllPublicRecipes = asyncHandler(async (req, res) => {
    const userid = ''

    const recipes = []
    if (req.hasOwnProperty('userid')) {
        userid = req.userid;
        const user = await User.findById(userid).lean()

        if (!user) {
            return res.status(400).json({ message: 'User not found' })
        }
        recipes = await Recipe.find({ owner: { $ne: userid }, public: true }).select('_id title ingredients calories servings cooktime owner -public').lean().exec()
    } else {
        recipes = await Recipe.find({ public: true }).select('_id title ingredients calories servings cooktime owner -public').lean().exec()
    }


    if (!recipes?.length) {
        return res.status(400).json({ message: 'No recipes found' })
    }

    const ownerids = []

    for (const recipe of recipes) {
        ownerids.push(recipe.owner)
    }

    const ownerUsernames = await User.find({ _id: { $in: ownerids } }).select('_id username').exec();

    res.json({ recipes: recipes, ownerusernames: ownerUsernames })
})

const getAllPublicCoverImagesAndProfPics = asyncHandler(async (req, res) => {
    const userid = ''

    const recipes = []
    if (req.hasOwnProperty('userid')) {
        userid = req.userid;
        const user = await User.findById(userid).lean()

        if (!user) {
            return res.status(400).json({ message: 'User not found' })
        }
        recipes = await Recipe.find({ owner: { $ne: userid }, public: true }).select('_id coverImages').lean().exec()
    } else {
        recipes = await Recipe.find({ public: true }).select('_id coverImages').lean().exec()
    }

    const recipesImages = []
    const ownerids = []
    const profilepics = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {
            let updated = false;

            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }

            if (recipe.coverImages.length > 0) {
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
                    }

                    imagesCover.coverImages.push(item);
                }
            }

            if (updated) {
                await recipe.save();
            }




            recipesImages.push(imagesCover);

            ownerids.push(recipe.owner);
        }

        const ownerProfilePics = await User.find({ _id: { $in: ownerids } }).select('_id profilePicture')

        for (const foundUser of ownerProfilePics) {
            if (!foundUser.profilePicture.imageName) {
                profilepics.push({ imageURL: '', id: foundUser._id })
            } else {
                if (!foundUser.profilePicture.imageURL || isExpired(foundUser.profilePicture.imageURL)) {
                    const getObjectParams = {
                        Bucket: bucketName,
                        Key: foundUser.profilePicture.imageName
                    }

                    const command = new GetObjectCommand(getObjectParams);

                    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                    foundUser.profilePicture.imageURL = url;

                    profilepics.push({ imageURL: url, id: foundUser._id })


                    await foundUser.save();


                } else {
                    profilepics.push({ imageURL: foundUser.profilePicture.imageURL, id: foundUser._id })
                }
            }
        }
    }

    res.json({ coverIms: recipesImages, profilePics: profilepics });



})

const getMyRecipes = asyncHandler(async (req, res) => {
    const userid = req.userid
    const recipes = await Recipe.find({ owner: userid }).select('_id title ingredients calories servings cooktime').lean().exec()

    res.json({ recipes: recipes })

})

const getMyCoverImages = asyncHandler(async (req, res) => {
    const userid = req.userid
    const recipes = await Recipe.find({ owner: userid }).select('coverImages _id').exec()


    const recipesImages = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {
            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }
            let updated = false;
            if (recipe.coverImages.length > 0) {
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
                    }

                    imagesCover.coverImages.push(item);
                }
            }

            if (updated) {
                await recipe.save();
            }

            recipesImages.push(imagesCover);
        }
    }

    res.json({ coverIms: recipesImages });



})

const getFollowingsPublicRecipes = asyncHandler(async (req, res) => {
    const userid = req.userid
    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const following = user.following
    let usernames = []
    let recipes = []

    if(following.length > 0){
        usernames = await User.find({ _id: { $in: following}}).select('username _id').exec();
    }

    recipes = await Recipe.find({ owner: { $in: following}, public: true}).select('_id title ingredients calories servings cooktime owner -public').exec();

    res.send({ownerusernames: usernames, recipes: recipes})

})


const getFollowingsPublicCoverImagesAndProfPics = asyncHandler(async (req, res) => {
    const userid = req.userid
    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const following = user.following
    const recipes = await Recipe.find({ owner: { $in: following }, public: true }).select('coverImages _id').exec();

    const recipesImages = []
    const profilepics = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {
            let updated = false;

            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }

            if (recipe.coverImages.length > 0) {
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
                    }

                    imagesCover.coverImages.push(item);
                }
            }

            if (updated) {
                await recipe.save();
            }




            recipesImages.push(imagesCover);

        }

        const ownerProfilePics = await User.find({ _id: { $in: following } }).select('_id profilePicture')

        for (const foundUser of ownerProfilePics) {
            if (!foundUser.profilePicture.imageName) {
                profilepics.push({ imageURL: '', id: foundUser._id })
            } else {
                if (!foundUser.profilePicture.imageURL || isExpired(foundUser.profilePicture.imageURL)) {
                    const getObjectParams = {
                        Bucket: bucketName,
                        Key: foundUser.profilePicture.imageName
                    }

                    const command = new GetObjectCommand(getObjectParams);

                    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                    foundUser.profilePicture.imageURL = url;

                    profilepics.push({ imageURL: url, id: foundUser._id })


                    await foundUser.save();


                } else {
                    profilepics.push({ imageURL: foundUser.profilePicture.imageURL, id: foundUser._id })
                }
            }
        }
    }

    res.json({ coverIms: recipesImages, profilePics: profilepics });



    
    

})

const getUsersPublicRecipes = asyncHandler(async (req, res) => {
    const userid = req.params.userid;

    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const recipes = await Recipe.find({ owner: userid, public: true }).select('_id title ingredients calories servings cooktime').lean().exec()

    res.json({ recipes: recipes, ownerusername: user.username })

})

const getUsersPublicCoverImagesAndProfPic = asyncHandler(async (req, res) => {
    const userid = req.params.userid;

    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const recipes = await Recipe.find({ owner: userid, public: true }).select('coverImages _id').exec()


    const recipesImages = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {
            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }

            let updated = false;

            if (recipe.coverImages.length > 0) {
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
                    }

                    imagesCover.coverImages.push(item);
                }
            }

            recipesImages.push(imagesCover);

            if (updated) {
                await recipe.save();
            }
        }
    }

    const profilepic = ''

    if (user.profilePic.imageName && (!user.profilePicture.imageURL || isExpired(user.profilePicture.imageURL))) {
        const getObjectParams = {
            Bucket: bucketName,
            Key: user.profilePicture.imageName
        }

        const command = new GetObjectCommand(getObjectParams);

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

        user.profilePicture.imageURL = url;
        profilepic = url;

        await user.save();
    }


    res.json({ coverIms: recipesImages, profilePic: profilepic });


})


const getMyFavoriteRecipes = asyncHandler(async (req, res) => {
    const userid = req.userid

    const user = await User.findById(userid).lean().exec();

    if (!user) {
        return res.status(400).json({ message: 'No such user exists, cannot retrieve favorites' })
    }

    const recipes = await Recipe.find({ _id: { $in: user.favorites } }).lean().exec();

    const ownerids = []

    for (const recipe of recipes) {
        if (recipe.owner.toString() !== userid) {
            delete recipe.public
            ownerids.push(recipe.owner)

        } else {
            delete recipe.owner
        }
    }

    const ownerusernames = await User.find({ _id: { $in: ownerids } }).select('_id username').lean().exec();

    res.json({ recipes: recipes, ownerusernames: ownerusernames })

})

const getMyFavoriteCoverImagesAndProfPics = asyncHandler(async (req, res) => {
    const userid = req.userid
    const user = await User.findById(userid).lean().exec();

    if (!user) {
        return res.status(400).json({ message: 'No such user exists, cannot retrieve favorites' })
    }

    const recipes = await Recipe.find({ _id: { $in: user.favorites } }).select('coverImages owner _id').exec();


    const recipesImages = []
    const ownerids = []
    const profilepics = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {

            let updated = false;
            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }

            if (recipe.coverImages.length > 0) {
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


                    }

                    imagesCover.coverImages.push(item);
                }
            }

            if (updated) {
                await recipe.save();
            }

            recipesImages.push(imagesCover);

            ownerids.push(recipe.owner);
        }

        const ownerProfilePics = await User.find({ _id: { $in: ownerids } }).select('_id profilePicture').exec();

        for (const foundUser of ownerProfilePics) {
            if (foundUser._id.toString() === userid) {
                continue;
            }
            if (!foundUser.profilePicture.imageName) {
                profilepics.push({ imageURL: '', id: foundUser._id })
            } else {
                if (!foundUser.profilePicture.imageURL || isExpired(foundUser.profilePicture.imageURL)) {
                    const getObjectParams = {
                        Bucket: bucketName,
                        Key: foundUser.profilePicture.imageName
                    }

                    const command = new GetObjectCommand(getObjectParams);

                    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                    foundUser.profilePicture.imageURL = url;

                    profilepics.push({ imageURL: url, id: foundUser._id })


                    await foundUser.save();


                } else {
                    profilepics.push({ imageURL: foundUser.profilePicture.imageURL, id: foundUser._id })
                }
            }
        }

    }

    res.json({ coverIms: recipesImages, profilePics: profilepics });



})

const getUsersPublicFavorites = asyncHandler(async (req, res) => {
    const userid = req.params.userid;

    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const recipes = await Recipe.find({ _id: { $in: user.favorites }, public: true }).lean().exec();

    const ownerids = []

    for (const recipe of recipes) {
        if (recipe.owner.toString() !== userid) {
            delete recipe.public
            ownerids.push(recipe.owner)

        } else {
            delete recipe.owner

        }
    }

    const ownerusernames = await User.find({ _id: { $in: ownerids } }).select('_id username').lean().exec();

    res.json({ recipes: recipes, ownerusernames: ownerusernames })




})


const getUsersPublicFavoritesCoverImagesAndProfPics = asyncHandler(async (req, res) => {
    const userid = req.params.userid;

    const user = await User.findById(userid).lean()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const recipes = await Recipe.find({ _id: { $in: user.favorites }, public: true }).select('coverImages _id').exec();


    const recipesImages = []
    const ownerids = []
    const profilepics = []

    if (recipes.length > 0) {
        for (const recipe of recipes) {
            let updated = false;

            const imagesCover = {
                id: recipe._id,
                coverImages: []
            }

            if (recipe.coverImages.length > 0) {
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
                    }

                    imagesCover.coverImages.push(item);
                }
            }

            if (updated) {
                await recipe.save();
            }




            recipesImages.push(imagesCover);

            ownerids.push(recipe.owner);
        }

        const ownerProfilePics = await User.find({ _id: { $in: ownerids } }).select('_id profilePicture')

        for (const foundUser of ownerProfilePics) {
            if (foundUser._id.toString() === userid) {
                continue;
            }
            if (!foundUser.profilePicture.imageName) {
                profilepics.push({ imageURL: '', id: foundUser._id })
            } else {
                if (!foundUser.profilePicture.imageURL || isExpired(foundUser.profilePicture.imageURL)) {
                    const getObjectParams = {
                        Bucket: bucketName,
                        Key: foundUser.profilePicture.imageName
                    }

                    const command = new GetObjectCommand(getObjectParams);

                    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                    foundUser.profilePicture.imageURL = url;

                    profilepics.push({ imageURL: url, id: foundUser._id })


                    await foundUser.save();


                } else {
                    profilepics.push({ imageURL: foundUser.profilePicture.imageURL, id: foundUser._id })
                }
            }
        }
    }

    res.json({ coverIms: recipesImages, profilePics: profilepics });



})

const createNewRecipe = asyncHandler(async (req, res) => {
    const { title, public, ingredients, steps, servings, calories, cooktime } = req.body
    const userid = req.userid;

    if (!title || !userid) {
        return res.status(400).json({ message: 'Title and owner required' })
    }

    const owner = await User.findById(userid).lean().exec();

    if (!owner) {
        return res.status(400).json({ message: 'No such user exists, recipe cannot be created' })
    }

    const duplicate = await Recipe.findOne({ title: title, owner: userid, public: public }).lean().exec()

    if (duplicate) {
        return res.status(400).json({ message: 'Recipe already exists' })
    }

    const recipe = await Recipe.create({ title, owner: userid, public, ingredients, steps, servings, calories, cooktime });

    if (recipe) {
        return res.status(201).json({ newrecipeid: recipe._id })
    } else {
        return res.status(400).json({ message: 'Invalid recipe data entered' })
    }

})

const createImageLists = asyncHandler(async (req, res) => {

    const recipeid = req.params.id;
    const userid = req.userid;

    const recipe = await Recipe.findById(recipeid).exec();

    if (!recipe) {
        return res.status(400).json({ message: 'No recipe found, images cannot be uploaded' })
    }

    if (recipe.owner.toString() !== userid) {
        return res.status(400).json({ message: 'Unauthorized, image upload by owner only' })
    }

    let index = 0
    if (req.files['stepImages'].length > 0) {
        for (const file of req.files['stepImages']) {
            const imageName = crypto.randomBytes(32).toString('hex')

            const params = {
                Bucket: bucketName,
                Key: imageName,
                Body: file.buffer,
                ContentType: file.mimetype
            }

            const command = new PutObjectCommand(params);

            await s3.send(command);

            let stepImage = {
                stepNum: req.body.stepImageStepNo[index],
                imageName: imageName,
                imageURL: ''
            }

            recipe.stepImages.push(stepImage);
            index++;
        }
    }

    if (req.files['stepImages'].length > 0) {
        for (const file of req.files['coverImages']) {
            const imageName = crypto.randomBytes(32).toString('hex')

            const params = {
                Bucket: bucketName,
                Key: imageName,
                Body: file.buffer,
                ContentType: file.mimetype
            }

            const command = new PutObjectCommand(params);

            await s3.send(command);

            let coverImage = {
                imageName: imageName,
                imageURL: ''
            }

            recipe.coverImages.push(coverImage);
        }
    }

    const updatedRecipe = await recipe.save()

    res.send({})
})

const updateRecipe = asyncHandler(async (req, res) => {
    const { title, recipeid, public, ingredients, steps, calories, cooktime, servings } = req.body

    const userid = req.userid

    if (!recipeid) {
        return res.status(400).json({ message: 'Recipe id required' })
    }

    const recipe = await Recipe.findById(recipeid).exec()

    if (!recipe) {
        return res.status(400).json({ message: 'Recipe does not exist' })
    }

    const duplicate = await Recipe.findOne({ _id: { $ne: recipeid }, title: title, owner: userid, public: public })

    if (duplicate) {
        return res.status(400).json({ message: 'Recipe already exists' })
    }


    if (recipe.title !== title) {
        recipe.title = title
    }

    if (recipe.public !== public) {
        recipe.public = public

        if (!public) {
            //if recipe was made private, remove from people's favorites lists
            const cleanup = await User.updateMany(
                { _id: { $ne: userid } },
                { $pull: { favorites: mongoose.Types.ObjectId(recipeid) } })
        }
    }

    if (recipe.ingredients !== ingredients) {
        recipe.ingredients = ingredients
    }

    if (recipe.steps !== steps) {
        recipe.steps = steps
    }

    if (recipe.calories !== calories) {
        recipe.calories = calories
    }

    if (recipe.cooktime !== cooktime) {
        recipe.cooktime = cooktime
    }

    if (recipe.servings !== servings) {
        recipe.servings = servings
    }



    const updatedRecipe = await recipe.save()

    res.json({ message: `${updatedRecipe.title} updated` })


})

const deleteRecipe = asyncHandler(async (req, res) => {
    const { recipeid } = req.body
    const userid = req.userid

    let message = "";

    if (!recipeid) {
        return res.status(400).json({ message: 'Id required for deletion' })
    }

    const recipe = await Recipe.findOne({ _id: recipeid, owner: userid })

    if (!recipe) {
        return res.status(400).json({ message: 'Recipe not found' })
    }

    if (recipe.coverImages.length > 0) {
        for (item of recipe.coverImages) {
            const params = {
                Bucket: bucketName,
                Key: item.imageName,
            }

            const command = new DeleteObjectCommand(params);
            await s3.send(command);
        }
    }

    if (recipe.stepImages.length > 0) {
        for (item of recipe.stepImages) {
            const params = {
                Bucket: bucketName,
                Key: item.imageName,
            }

            const command = new DeleteObjectCommand(params);
            await s3.send(command);

        }
    }

    const result = await recipe.deleteOne()

    if (recipe.public) {
        const cleanup = await User.updateMany(
            {},
            { $pull: { favorites: mongoose.Types.ObjectId(recipeid) } })
    } else {
        const user = await User.findById(userid);
        if (!user) {
            return res.status(400).json({ message: 'Owner of recipe not found' })

        }

        const newfave = user.favorites.filter((item) => item.toString() !== recipeid)
        user.favorites = newfave

        const updatedUser = await user.save()

        message = message + `${updatedUser.username} updated. `;


    }

    const reply = message + `Recipe ${result.title} with id ${result._id} deleted`

    res.json({ message: reply })


})

const getRecipe = asyncHandler(async (req, res) => {
    const userid = req.userid;

    const recipeid = req.params.id;

    const recipe = await Recipe.findById(recipeid).lean()

    if (!recipe) {
        return res.status(400).json({ message: 'No recipes found' })
    }

    const username = userid !== recipe.owner.toString() ? await User.findById(recipe.owner).select('username').exec() : '';

    res.json({ recipe: recipe, ownerusername: username })
})


function isExpired(url) {
    const params = new Proxy(new URLSearchParams(url), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    const creationDate = parseISO(params['X-Amz-Date']);
    const expiresInSecs = Number(params['X-Amz-Expires']);

    const expiryDate = addSeconds(creationDate, expiresInSecs);

    return expiryDate < new Date();
}


const getStepImages = asyncHandler(async (req, res) => {
    const recipeid = req.params.id;
    const userid = req.userid;

    const recipe = await Recipe.findById(recipeid).lean()

    if (!recipe) {
        return res.status(400).json({ message: 'Recipe not found' })
    }

    if (!userid) {
        return res.status(401).json({ message: 'Log in to view step images' })
    }

    const imagesStep = []

    if (recipe.stepImages.length > 0) {
        for (const item of recipe.stepImages) {
            if (!item.imageURL || isExpired(item.imageURL)) {
                const getObjectParams = {
                    Bucket: bucketName,
                    Key: item.imageName
                }

                const command = new GetObjectCommand(getObjectParams);

                const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                item.imageURL = url;
            }

            imagesStep.push(item)

        }
    }

    res.json({
        stepIms: imagesStep,
        stepListLength: recipe.steps.length
    })

})


const getCoverImages = asyncHandler(async (req, res) => {
    const userid = req.userid;
    const recipeid = req.params.id;

    const recipe = await Recipe.findById(recipeid).lean()

    if (!recipe) {
        return res.status(400).json({ message: 'Recipe not found' })
    }

    const imagesCover = []
    const profilepic = 'myrecipe'

    if (recipe.coverImages.length > 0) {
        let updated = false;
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
            }

            imagesCover.push(item);
        }

        if (updated) {
            await recipe.save();
        }

        if (userid !== recipe.owner.toString()) {
            const user = await User.findById(recipe.owner).select('profilePicture _id').exec();

            if (user.profilePic.imageName && (!user.profilePicture.imageURL || isExpired(user.profilePicture.imageURL))) {
                const getObjectParams = {
                    Bucket: bucketName,
                    Key: user.profilePicture.imageName
                }

                const command = new GetObjectCommand(getObjectParams);

                const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) //expires in an hour

                user.profilePicture.imageURL = url;
                profilepic = url;

                await user.save();
            } else {
                profilepic = ''
            }
        }
    }



    res.json({
        coverIms: imagesCover,
        profilePic: profilepic
    })

})

const updateImageLists = asyncHandler(async (req, res) => {
    const recipeid = req.params.id;
    const userid = req.userid;

    const recipe = await Recipe.findById(recipeid).exec();

    if (!recipe) {
        return res.status(400).json({ message: 'No recipe found, images cannot be uploaded' })
    }

    if (recipe.owner.toString() !== userid) {
        return res.status(400).json({ message: 'Unauthorized, image edit by owner only' })
    }

    const coverImMap = new Map();
    const newCoverImages = []

    if (recipe.coverImages.length > 0) {
        for (const image of recipe.coverImages) {
            coverImMap.set(image.imageName, image.imageURL);
        }
    }

    let i = 0

    if (req.body.coverImageOrder.length > 0) {
        for (const name of req.body.coverImageOrder) {
            if (name === 'img') {
                const imageName = crypto.randomBytes(32).toString('hex')

                const params = {
                    Bucket: bucketName,
                    Key: imageName,
                    Body: req.files['newCoverImages'][i].buffer,
                    ContentType: req.files['newCoverImages'][i].mimetype
                }

                const command = new PutObjectCommand(params);

                await s3.send(command);

                let coverImage = {
                    imageName: imageName,
                    imageURL: ''
                }

                newCoverImages.push(coverImage);
                i++;
            }

            else {
                let coverImage = {
                    imageName: name,
                    imageURL: coverImMap.get(name)
                }

                newCoverImages.push(coverImage);
                coverImMap.set(name, 'found');
            }

        }
    }

    if (coverImMap.size > 0) {
        for (let [imageName, value] of coverImMap) {
            if (value !== 'found') {
                const params = {
                    Bucket: bucketName,
                    Key: imageName
                }

                const command = new DeleteObjectCommand(params);

                await s3.send(command);

            }

        }
    }

    recipe.coverImages = newCoverImages;


    const stepImMap = new Map();
    const newStepImages = []

    if (recipe.stepImages.length > 0) {
        for (const image of recipe.stepImages) {
            stepImMap.set(image.imageName, image.imageURL);
        }
    }

    let imageNumber = 0
    let index = 0

    if (req.body.stepImageOrder.length > 0) {
        for (const name of req.body.stepImageOrder) {
            if (name === 'img') {
                const imageName = crypto.randomBytes(32).toString('hex')

                const params = {
                    Bucket: bucketName,
                    Key: imageName,
                    Body: req.files['newStepImages'][imageNumber].buffer,
                    ContentType: req.files['newStepImages'][imageNumber].mimetype
                }

                const command = new PutObjectCommand(params);

                await s3.send(command);

                let stepImage = {
                    imageName: imageName,
                    imageURL: '',
                    stepNum: index + 1

                }

                newStepImages.push(stepImage);
                imageNumber++;
            }

            else if (name !== '') {
                let stepImage = {
                    imageName: name,
                    imageURL: stepImMap.get(name),
                    stepNum: index + 1
                }

                newStepImages.push(stepImage);
                stepImMap.set(name, 'found');
            }

            index++

        }
    }

    if (stepImMap.size > 0) {
        for (let [imageName, value] of stepImMap) {
            if (value !== 'found') {
                const params = {
                    Bucket: bucketName,
                    Key: imageName
                }

                const command = new DeleteObjectCommand(params);

                await s3.send(command);

            }

        }
    }

    recipe.stepImages = newStepImages;


    const updatedRecipe = await recipe.save()

    res.send({})





})




module.exports = {
    getAllPublicRecipes,
    getAllPublicCoverImagesAndProfPics,
    getMyRecipes,
    getMyCoverImages,
    getMyFavoriteRecipes,
    getMyFavoriteCoverImagesAndProfPics,
    getUsersPublicRecipes,
    getUsersPublicCoverImagesAndProfPic,
    getUsersPublicFavorites,
    getUsersPublicFavoritesCoverImagesAndProfPics,
    getFollowingsPublicRecipes, 
    getFollowingsPublicCoverImagesAndProfPics,
    createNewRecipe,
    createImageLists,
    updateRecipe,
    deleteRecipe,
    updateImageLists,
    getRecipe,
    getCoverImages,
    getStepImages
}


