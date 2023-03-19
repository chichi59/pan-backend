const express = require('express')
const router = express.Router()
const recipesController = require('../controllers/recipesController.js')
const verifyJWT = require('../middleware/verifyJWT')
const upload = require('../middleware/multer');



router.route('/explore')
    .get(recipesController.getAllPublicRecipes)

router.route('/explore/images')
    .get(recipesController.getAllPublicCoverImagesAndProfPics)

router.route('/explore/user/:userid/')
    .get(recipesController.getUsersPublicRecipes)

router.route('/explore/user/:userid/coverimages')
    .get(recipesController.getUsersPublicCoverImagesAndProfPic)

router.route('/explore/user/:userid/favorites')
    .get(recipesController.getUsersPublicFavorites)

router.route('/explore/user/:userid/favorites/coverimages')
    .get(recipesController.getUsersPublicFavoritesCoverImagesAndProfPics)

    

router.use(verifyJWT)

router.route('/')
    .get(recipesController.getAllPublicRecipes)

router.route('/user/:userid/')
    .get(recipesController.getUsersPublicRecipes)

router.route('/user/:userid/favorites')
    .get(recipesController.getUsersPublicFavorites)

router.route('/myrecipes')
    .get(recipesController.getMyRecipes)
    .post(recipesController.createNewRecipe)
    .patch(recipesController.updateRecipe)
    .delete(recipesController.deleteRecipe)

router.route('/myrecipes/coverimages')
    .get(recipesController.getMyCoverImages)

router.route('/myrecipes/favorites')
    .get(recipesController.getMyFavoriteRecipes)

router.route('/myrecipes/favorites/coverimages')
    .get(recipesController.getMyFavoriteCoverImagesAndProfPics)

router.route('/following')
    .get(recipesController.getFollowingsPublicRecipes)

router.route('/following/images')
    .get(recipesController.getFollowingsPublicCoverImagesAndProfPics)

router.route('/:id')
    .get(recipesController.getRecipe)

router.route('/:id/images')
    .post(upload.fields([{ name: 'coverImages', maxCount: 3 }, { name: 'stepImages', maxCount: 20 }]), recipesController.createImageLists)
    .patch(upload.fields([{ name: 'newCoverImages', maxCount: 3 }, { name: 'newStepImages', maxCount: 20 }]), recipesController.updateImageLists)

router.route('/:id/stepimages')    
    .get(recipesController.getStepImages)

router.route('/:id/coverimages')
    .get(recipesController.getCoverImages);

module.exports = router

