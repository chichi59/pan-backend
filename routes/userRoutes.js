const express = require('express')
const router = express.Router()
const usersController = require('../controllers/usersController')
const verifyJWT = require('../middleware/verifyJWT')

router.route('/')
    .get(usersController.getAllUsers)
    .post(usersController.createNewUser)

router.route('/profilepic')
    .get(usersController.getProfilePic)

router.route('/')
    
router.use(verifyJWT)
router.route('/')    
    .patch(usersController.updateUser)
    .delete(usersController.deleteUser)

router.route('/profilepic')
    .post(usersController.createProfilePic)
    .patch(usersController.updateProfilePic)

router.route('/me')
    .get(usersController.getAUser)

module.exports = router