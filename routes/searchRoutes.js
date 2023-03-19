const express = require('express')
const router = express.Router()
const searchController = require('../controllers/searchController')
const verifyJWT = require('../middleware/verifyJWT')


router.use(verifyJWT)

router.route('/')
    .get(searchController.getSearchResults)

router.route('/autocomplete')
    .get(searchController.getAutoCompleteRecipeResults)

module.exports = router;

