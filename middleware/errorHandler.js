const { logEvents } = require('./logger.js') 

const errorHandler = (err, req, res, next) => {
    logEvents(`${err.name}\t${err.message}\t${req.method}\t${req.url}\t${req.headers.origin}`, 'errorlogs.txt')
    next()

    const status = res.statusCode ? res.statusCode : 500

    res.status(status)

    res.json({message: err.message})
}


module.exports = errorHandler