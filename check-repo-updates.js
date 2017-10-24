require('dotenv').config()
var pg = require('pg')
pg.defaults.ssl = true

const dateFns = require('date-fns')

const pThrottle = require('p-throttle')

const getLatestCommitDate = require('./process-repo').getLatestCommitDate
const getRepoMap = require('./process-repo').getRepoMap
const githubToS3 = require('./process-repo').githubToS3

const log = require('./utils').log

var db = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL
})

log('check-repo-updates')

const throttledGetLatestCommitDate = pThrottle(getLatestCommitDate, 1, 2000)
const throttledGetRepoMap = pThrottle(getRepoMap, 1, 2000)

processRepoMap = function(rowId, data){
  // put map in db
  var now = new Date()

  db('repos')
    .where('id', rowId)
    .update({
      'last_updated': now.toISOString(),
      'map': data.map
    }).then(function(){
      log('done update')
    })
  // process images
  githubToS3(data.filesToConvert)
}

db('repos').select()
.then(function(rows) {
  for (let row of rows) {
    if (row.last_updated === null){
      throttledGetRepoMap(row.account, row.name).then(
        function(data){
          processRepoMap(row.id, data)
        }
      )
    } else {
      throttledGetLatestCommitDate(row.account, row.name).then(
        function(date){
          date = dateFns.parse(date)
          last_updated = dateFns.parse(row.last_updated)
          if (date > row.last_updated){
            log('updated since last_updated')
            throttledGetRepoMap(row.account, row.name).then(
              function(data){
                processRepoMap(row.id, data)
              }
            )
          } else {
            log('no changes - skipping')
          }
        }
      )
    }
  }
})
.catch(function(error) {
  console.error(error)
})

// to do
// processing each row needs to be queued
// idea
// one throttledGithub function that manages reqests to github
