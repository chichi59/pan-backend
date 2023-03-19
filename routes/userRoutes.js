const express = require('express')
const router = express.Router()
const usersController = require('../controllers/usersController')
const verifyJWT = require('../middleware/verifyJWT')
const upload = require('../middleware/multer');


router.route('/')
    .get(usersController.getAllUsers)
    .post(usersController.createNewUser)

router.route('/explore/:id/profilepic')
    .get(usersController.getProfilePic)

router.route('/explore/:id')
    .get(usersController.getUser)
    
router.use(verifyJWT)
router.route('/')    
    .patch(usersController.updateUser)
    .delete(usersController.deleteUser)

router.route('/following')
    .get(usersController.getFollowing)

router.route('/profilepic')
    .post(upload.single('profilepic'), usersController.createProfilePic)
    .patch(upload.single('profilepic'), usersController.updateProfilePic)

router.route('/me')
    .get(usersController.getMe)

router.route('/:id')
    .get(usersController.getUser)

module.exports = router