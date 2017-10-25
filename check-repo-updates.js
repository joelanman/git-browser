require('dotenv').config()
var pg = require('pg')
pg.defaults.ssl = true

const dateFns = require('date-fns')
const pQueue = require('p-queue')
const pThrottle = require('p-throttle')

const getLatestCommitDate = require('./process-repo').getLatestCommitDate
const getRepoMap = require('./process-repo').getRepoMap
const githubToS3 = require('./process-repo').githubToS3

const log = require('./utils').log
const queue = new pQueue({concurrency: 1})

var db = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL
})

log('check-repo-updates')

const throttledGetLatestCommitDate = pThrottle(getLatestCommitDate, 1, 2000)
const throttledGetRepoMap = pThrottle(getRepoMap, 1, 2000)

processRepoMap = function(row, data){

  log(`processRow`)

  return new Promise((resolve, reject) => {

    // put map in db
    var now = new Date()

    db('repos')
      .where('id', row.id)
      .update({
        'last_updated': now.toISOString(),
        'map': data.map
        // ERROR map is updated before the actual images generated
      }).then(function(){
        log('done db update')
        // process images
        githubToS3(row.account, row.name, data.filesToConvert)
        .then(function(){
          resolve()
        })
        .catch(function(error) {
          // to do should we roll back the updated date?
          console.error(error)
          reject()
        })
      })
  })
}

const processRow = function(row){

  log(`---------------`)
  log(`processRow`)
  log(`${row.id}`)

  return new Promise((resolve, reject) => {

    if (row.last_updated === null){
      log(`No last_updated, processing repo`)
      throttledGetRepoMap(row.account, row.name).then(
        function(data){
          processRepoMap(row, data).then(resolve)
          // done
        }
      )
    } else {
      throttledGetLatestCommitDate(row.account, row.name).then(
        function(date){
          log(`comparing dates`)
          date = dateFns.parse(date)
          last_updated = dateFns.parse(row.last_updated)
          if (date > row.last_updated){
            log('updated since last_updated')
            throttledGetRepoMap(row.account, row.name).then(
              function(data){
                processRepoMap(row, data).then(resolve)
                // done
              }
            )
          } else {
            log('no changes - skipping')
            resolve()
          }
        }
      )
    }
  })
}

db('repos')
.select()
// .whereIn('id', [8,9])
.then(function(rows) {
  for (let row of rows) {
    queue.add(function(){
      return processRow(row)
    })
  }
})
.then(function(){
  queue.add(function(){
    return new Promise(function (resolve, reject){
      log(`All done`)
      db.destroy()
    })
  })
})
.catch(function(error) {
  console.error(error)
})

// to do
// processing each row needs to be queued
// idea
// one throttledGithub function that manages reqests to github
