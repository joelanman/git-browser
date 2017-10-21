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

const throttledGetLatestCommitDate = pThrottle(getLatestCommitDate, 1, 5000)

db('repos').select()
.then(function(rows) {
  for (let row of rows) {
    throttledGetLatestCommitDate(row.account, row.name).then(
      function(date){
        log(date)
        log(typeof(date))
        log(row.last_updated)
        if (date > row.last_updated){
          log('getting tree')
        }
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
//   if date_updated < updated date_updated
//   get tree, convert to map and store
//   trigger thumbnails
