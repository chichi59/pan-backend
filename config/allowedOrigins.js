const { all } = require("../routes/root")

const allowedOrigins = [
    'http://localhost:3500',
    'http://localhost:3000'
    
]

module.exports = allowedOrigins