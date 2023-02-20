const { format } = require('date-fns')
const {v4: uuid } = require('uuid')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')

const logEvents = async (message, fileName) => {
    const d = `${format(new Date(), 'yyyyMMdd\tHH:mm:ss')}`
    const logItem = `${d}\t${uuid()}\t${message}\n`

    try{
        if(!fs.existsSync(path.join(__dirname, '..', 'logs'))){
            await fsPromises.mkdir(path.join(__dirname, '..', 'logs'))
        }
        await fsPromises.appendFile(path.join(__dirname, '..', 'logs', fileName), logItem)
    }catch (err){
        console.log(err)
    }
}

const logger = (req, res, next) => {
    logEvents(`${req.method}\t${req.url}\t${req.headers.origin}`, 'logs.txt')
    console.log(`${req.method} ${req.path}`)
    next()
}

module.exports = {logEvents, logger}
