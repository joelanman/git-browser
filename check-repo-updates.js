require('dotenv').config()
var pg = require('pg')
pg.defaults.ssl = true

const pThrottle = require('p-throttle')

const getLatestCommitDate = require('./process-repo').getLatestCommitDate

const log = require('./utils').log

var db = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL
})

log('check-repo-updates')

const throttled = pThrottle(getLatestCommitDate, 1, 5000)

db('repos').select()
.then(function(rows) {
  for (let row of rows) {
    throttled(row.account, row.name).then(
      function(date){
        log(date)
      }
    )
    // getLatestCommitDate(row.account, row.name)
  }
  db.destroy()
})
.catch(function(error) {
  console.error(error)
  db.destroy()
})

// to do
//   get updated date from github
//   if date_updated < updated date_updated
//   get tree, convert to map and store
//   trigger thumbnails
