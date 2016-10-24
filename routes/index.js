var fs = require('fs')
var path = require('path')

var express = require('express')
var router = express.Router()
var GitHubApi = require('github')

var log = function (data) {
  console.log(JSON.stringify(data, null, '  '))
}

router.get('/', function (req, res) {
  // list the owners

  var owners = {}

  var ownersList = fs.readdirSync(__dirname + '/../maps')

  ownersList.forEach(function (owner) {
    repos = fs.readdirSync(__dirname + `/../maps/${owner}`)
    repos = repos.map(function (repo) {
      var extension = path.extname(repo)
      return path.basename(repo, extension)
    })
    owners[owner] = {
      repos: repos
    }
  })

  log(owners)

  res.render('home', {owners: owners})
})

router.get(/\/.*/, function (req, res, next) {
  var currentPath = req.path.substr(1) // remove leading /
  pathParts = currentPath.split('/')

  var owner = pathParts.shift()
  var repo = pathParts.shift()

  console.log('owner: ' + owner)
  console.log('repo:  ' + repo)

  try {
    var files = require(`../maps/${owner}/${repo}.json`)
  } catch (error) {
    return next(error)
  }

  var localPath = (pathParts.length === 0) ? '' : pathParts.join('/') + '/'
  log(localPath)

  var breadcrumbs = []

  while (pathParts.length > 0) {
    var pathPart = decodeURI(pathParts.shift())
    breadcrumbs.push(pathPart)
    files = files.children[pathPart]
  }

  for (var fileName in files.children) {
    var extension = path.extname(fileName).toLowerCase()
    var file = files.children[fileName]
    fileName = encodeURIComponent(fileName)
    if (extension == '.jpg' || extension == '.pdf' || extension == '.png') {
      file.thumbnail = true
      file.imagePath = `https://s3-eu-west-1.amazonaws.com/joelanman-github-gallery/out/${currentPath}/${fileName}.thumbnail.jpg`
      file.githubURL = `https://github.com/${owner}/${repo}/blob/master/${localPath}${fileName}`
    }
  }

  res.render('files', {owner: owner,
                       repo: repo,
                       breadcrumbs: breadcrumbs,
                       currentPath: currentPath,
                       files: files.children})
})

module.exports = router
