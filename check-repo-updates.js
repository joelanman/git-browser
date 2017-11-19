const dateFns = require('date-fns')
const pQueue = require('p-queue')
const pThrottle = require('p-throttle')
const sgMail = require('@sendgrid/mail')

const getLatestCommitDate = require('./process-repo').getLatestCommitDate
const getRepoMap = require('./process-repo').getRepoMap
const githubToS3 = require('./process-repo').githubToS3

const db = require('./db').db

const log = require('./utils').log
const queue = new pQueue({concurrency: 1})

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

var email = {
  to: 'joelanman@gmail.com',
  from: 'joelanman@gmail.com',
  subject: 'Git Browser update - ' + dateFns.format(new Date(), 'H:mm [on] MM/DD/YYYY'),
  text: ''
}

log('check-repo-updates')

const throttledGetLatestCommitDate = pThrottle(getLatestCommitDate, 1, 2000)
const throttledGetRepoMap = pThrottle(getRepoMap, 1, 2000)

processRepoMap = function(row, data, lastCommitDate){

  log(`processRow`)

  return new Promise((resolve, reject) => {

    // process images
    githubToS3(row.owner, row.name, data.filesToConvert)
    .then(function(){

      // update db
      db('repos')
        .where('id', row.id)
        .update({
          'last_updated': lastCommitDate.toISOString(),
          'map': data.map
        }).then(function(){
          resolve()
        })
    })
    .catch(function(error) {
      console.error(error)
      reject()
    })
  })
}

const processRow = function(row){

  log(`---------------`)
  log(`processRow`)
  log(`${row.owner} - ${row.name}`)

  email.text += `${row.owner} - ${row.name} \n`

  return new Promise((resolve, reject) => {
    throttledGetLatestCommitDate(row.owner, row.name).then(function(lastCommitDate){
      log(`comparing dates`)
      lastCommitDate  = dateFns.parse(lastCommitDate)
      let lastUpdated = dateFns.parse(row.last_updated)
      if (lastCommitDate > lastUpdated){
        log('new commit since last updated')
        email.text += `new commit since last updated \n`
        throttledGetRepoMap(row.owner, row.name).then(
          function(data){
            processRepoMap(row, data, lastCommitDate)
            .then(resolve)
            // done
          }
        )
      } else {
        log('no changes - skipping')
        email.text += `no changes - skipping \n`
        resolve()
      }
    })
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
      sgMail.send(email)
      db.destroy()
    })
  })
})
.catch(function(error) {
  console.error(error)
})

// idea
// one throttledGithub function that manages reqests to github
