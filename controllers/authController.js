const User = require('../models/User')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const asyncHandler = require('express-async-handler')

const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body

    if(!username || !password){
        return res.status(400).json({message: 'All fields required'})
    }

    const foundUser = await User.findOne({username}).exec()

    if(!foundUser){
        return res.status(401).json({message: 'Username not found'})
    }

    const match = await bcrypt.compare(password, foundUser.password);
 
    if(!match) return res.status(401).json({message: 'Incorrect password'})

    const accessToken = jwt.sign(
        {
            "UserInfo": {
                "username": foundUser.username,
                "id": foundUser._id
            }

        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '3h'}

    )

    const refreshToken = jwt.sign(
        {"username": foundUser.username,
         "id": foundUser._id },
        process.env.REFRESH_TOKEN_SECRET,
        {expiresIn: '1d'}
    )

    foundUser.refreshToken = refreshToken
    const result = await foundUser.save();

    res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 24 * 60 * 60 * 1000    //matches refresh token
    })

    res.json({accessToken})



})

const refresh = async (req, res) => {
    const cookies = req.cookies

    if(!cookies?.jwt) {
        return res.status(401).json({message: 'Unauthorized'})
    }

    const refreshToken = cookies.jwt

    const foundUser = await User.findOne({refreshToken}).exec()

    if (!foundUser){
        return res.sendStatus(403).json({message: 'Unauthorized'});
    } 

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        asyncHandler(async(err, decoded) => {
            if(err || foundUser.username !== decoded.username){
                return res.status(401).json({message: 'Forbidden'})
            } 
            
            
            const accessToken = jwt.sign(
                {
                    "UserInfo": {
                        "username": foundUser.username,
                        "id": foundUser._id
                    }
        
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '3h'}
        
            )

            res.json({accessToken})

        })
    )







}

const logout = async (req, res) => {
    const cookies = req.cookies 
    if(!cookies?.jwt) return res.sendStatus(204)

    const refreshToken = cookies.jwt

    const foundUser = await User.findOne({refreshToken}).exec()

    if(!foundUser){
        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
        return res.sendStatus(204);
    }

    foundUser.refreshToken = ''
    const result = await foundUser.save();


    res.clearCookie('jwt', {httpOnly: true, sameSite: 'None', secure: true})
    res.json({message: 'Cookie cleared'})
}

module.exports = {
    login,
    refresh,
    logout
}

 