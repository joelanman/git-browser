const path = require('path')

const express = require('express')
const GitHubApi = require('github')

const db = require('../db').db
const log = require('../utils').log

var router = express.Router()

router.get('/', function (req, res) {
  // list the owners
  // get from db

  db('repos').then((rows) => {

      res.render('home', {repos: rows})

  })

})

router.get(/\/.*/, function (req, res, next) {
  var currentPath = req.path.substr(1) // remove leading /
  pathParts = currentPath.split('/')

  var owner = pathParts.shift()
  var repo = pathParts.shift()

  console.log('owner: ' + owner)
  console.log('repo:  ' + repo)

  // get from db

  // try {
  //   var files = require(`../maps/${owner}/${repo}.json`)
  // } catch (error) {
  //   return next(error)
  // }

  db('repos').where({
    owner: owner,
    name: repo
  }).then((rows) => {
    var row = rows[0]
    var files = row.map
    log(files)
    var localPath = (pathParts.length === 0) ? '' : pathParts.join('/') + '/'
    log(localPath)

    var breadcrumbs = []

    while (pathParts.length > 0) {

      var pathPart = decodeURI(pathParts.shift())

      files = files.children[pathPart] // move down the tree

      var breadcrumb = {
        'name': pathPart,
        'url': '/' + owner + '/' + repo + '/'
      }

      if (pathParts.length == 0){
        breadcrumb.last = true
      }

      if (breadcrumbs.length > 0){
        breadcrumb.url = breadcrumbs[breadcrumbs.length-1].url + '/'
      }

      breadcrumb.url += pathPart

      breadcrumbs.push(breadcrumb)

    }

    for (var fileName in files.children) {
      var extension = path.extname(fileName).toLowerCase()
      var file = files.children[fileName]
      fileName = encodeURIComponent(fileName)
      file.githubURL = `https://github.com/${owner}/${repo}/blob/master/${localPath}${fileName}`
      if (extension == '.jpg' || extension == '.pdf' || extension == '.png' || extension == '.svg') {
        file.thumbnail = true
        file.imagePath = `https://s3-eu-west-1.amazonaws.com/joelanman-github-gallery/out/${currentPath}/${fileName}.thumbnail.jpg`
      }
    }

    res.render('files', {owner: owner,
                         repo: repo,
                         breadcrumbs: breadcrumbs,
                         currentPath: currentPath,
                         files: files.children})
  }).catch((error) => {
    return next(error)
  })

})

module.exports = router
