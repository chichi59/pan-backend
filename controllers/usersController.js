const User = require('../models/User.js')
const Recipe = require('../models/Recipe.js')
const bcrypt = require('bcrypt')
const asyncHandler = require('express-async-handler')
const { use } = require('../routes/root.js')
const { s3, PutObjectCommand, bucketName, GetObjectCommand, DeleteObjectCommand, getSignedUrl } = require('../config/s3');
const { parseISO, addSeconds } = require('date-fns');
const { getUsersPublicRecipes } = require('./recipesController.js')


// Get all users
// GET /users
// Private

const getAllUsers = asyncHandler(async (req, res) => {
    const users = await User.find().select('-password -refreshToken').lean()
    if (!users?.length) {
        return res.status(400).json({ message: 'No users found' })
    }

    res.json(users)
})

const getAUser = asyncHandler(async (req, res) => {
    const userid = req.userid

    const user = await User.findById(userid).select('-password -refreshToken').lean()
    if (!user) {
        return res.status(400).json({ message: 'No users found' })
    }

    res.json(user)
})

// Create new user
//POST /users
//Private


function isExpired(url){
    const params = new Proxy(new URLSearchParams(url), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    const creationDate = parseISO(params['X-Amz-Date']);
    const expiresInSecs = Number(params['X-Amz-Expires']);
    
    const expiryDate = addSeconds(creationDate, expiresInSecs);

    return expiryDate < new Date();
}

const createNewUser = asyncHandler(async (req, res) => {
    const { username, password, firstname, lastname } = req.body

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' })
    }

    const duplicate = await User.findOne({ username }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate username' })
    }

    const hashedPwd = await bcrypt.hash(password, 10)

    const userObject = { username, "password": hashedPwd, firstname, lastname }

    const user = await User.create(userObject)

    if (user) {
        res.status(201).json({ message: `New user ${username} created` })
    } else {
        res.status(400).json({ message: 'Invalid user data recieved' })
    }

})

const getProfilePic = asyncHandler(async (req, res) => {
    const { userid } = req.body

    if (!userid) {
        return res.status(400).json({ message: 'Userid required' })
    }

    const user = await User.findById(userid).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    let imageurl = ''

    if(!user.profilePicture.imageURL || isExpired(user.profilePicture.imageURL)){
        const getObjectParams = {
            Bucket: bucketName,
            Key: user.profilePicture.imageName
        }

        const command = new GetObjectCommand(getObjectParams);

        const url = await getSignedUrl(s3, command, {expiresIn: 3600 }) //expires in an hour

        user.profilePicture.imageURL = url;

        imageurl = url;

        await user.save();
    }

    res.send({imageURL: imageurl});

})



//Update user
//PATCH /users
//Private

const updateUser = asyncHandler(async (req, res) => {
    const { username, password, firstname, lastname, recipeid, following } = req.body
    const userid = req.userid

    if (!userid) {
        return res.status(400).json({ message: 'Userid required' })
    }

    const user = await User.findById(userid).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const duplicate = await User.findOne({ _id: { $ne: userid }, username }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Username already exists' })
    }

    if (username) {
        user.username = username
    }

    if (firstname) {
        user.firstname = firstname
    }

    if (lastname) {
        user.lastname = lastname
    }

    if (password) {
        user.password = await bcrypt.hash(password, 10)
    }

    if (recipeid) {
        if (user.favorites.includes(recipeid)) {
            const mod = user.favorites.filter((item) => item.toString() !== recipeid);
            user.favorites = mod;
        } else {
            const mod = [...user.favorites, recipeid]
            user.favorites = mod;

        }
    }

    if(following){
        if (user.following.includes(following)) {
            const mod = user.following.filter((item) => item.toString() !== following);
            user.following = mod;
        } else {
            if(following !== userid){
                const mod = [...user.following, following]
                user.following = mod;
            }
        }

    }

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.username} updated` })



})

const createProfilePic = asyncHandler(async (req, res) => {
    const userid = req.userid;

    if (!userid) {
        return res.status(400).json({ message: 'Userid required' })
    }

    const user = await User.findById(userid).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const file = req.file;

    const imageName = crypto.randomBytes(32).toString('hex')

    const params = {
        Bucket: bucketName,
        Key: imageName,
        Body: file.buffer,
        ContentType: file.mimetype
    }

    const command = new PutObjectCommand(params);

    await s3.send(command);

    let profilePic = {
        imageName: imageName,
        imageURL: ''
    }

    user.profilePicture = profilePic;

    await user.save()

    res.send({message: "Profile picture uploaded"})


})

const updateProfilePic = asyncHandler(async (req, res) => {
    const userid = req.userid;

    if (!userid) {
        return res.status(400).json({ message: 'Userid required' })
    }

    const user = await User.findById(userid).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const file = req.file;

    const imageName = user.profilePicture.imageName

    if(!file && imageName){
        //delete file

        
        const params = {
            Bucket: bucketName,
            Key: imageName,
        }
    
        const command = new DeleteObjectCommand(params);
    
        await s3.send(command);
    

        user.profilePicture.imageName = ''
        user.profilePicture.imageURL = ''

        await user.save();

        res.send({})
    }

    else if (file && imageName){
        const paramsdelete = {
            Bucket: bucketName,
            Key: imageName,
        }
    
        const command = new DeleteObjectCommand(paramsdelete);
    
        await s3.send(command);

        const newImageName = crypto.randomBytes(32).toString('hex')

        const paramsnew = {
            Bucket: bucketName,
            Key: newImageName,
            Body: file.buffer,
            ContentType: file.mimetype
        }

        const command2 = new PutObjectCommand(paramsnew);

        await s3.send(command2);

        let profilePic = {
            imageName: imageName,
            imageURL: ''
        }

        user.profilePicture = profilePic;

        await user.save()
    
        res.send({})
    }

    else if(file && !imageName){
        const newImageName = crypto.randomBytes(32).toString('hex')

        const paramsnew = {
            Bucket: bucketName,
            Key: newImageName,
            Body: file.buffer,
            ContentType: file.mimetype
        }

        const command2 = new PutObjectCommand(paramsnew);

        await s3.send(command2);

        let profilePic = {
            imageName: imageName,
            imageURL: ''
        }

        user.profilePicture = profilePic;

        await user.save()
    
        res.send({})

    }
    





})




//Delete a user
//DELETE /users
//Private

const deleteUser = asyncHandler(async (req, res) => {
    const userid = req.userid;

    if (!userid) {
        return res.status(400).json({ message: 'User ID required' })
    }

    const recipe = await Recipe.findOne({ user: userid }).lean().exec()

    if (recipe) {
        return res.status(400).json({ message: 'User has active recipes ' })
    }

    const user = await User.findById(userid).exec()
    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const result = await user.deleteOne()

    const reply = `Username ${result.username} with id ${result._id} deleted`

    res.json({ message: reply })
})





module.exports = {
    getAllUsers,
    getAUser,
    getProfilePic,
    createNewUser,
    createProfilePic, 
    updateProfilePic,
    updateUser,
    deleteUser
}