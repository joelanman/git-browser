var express = require('express')
var router = express.Router()
var GitHubApi = require('github')
var path = require('path')

var log = function (data) {
  console.log(JSON.stringify(data, null, '  '))
}

router.get('browse', function (req, res) {

  // list the owners

})

router.get('browse/:owner', function (req, res) {

  // list the repos

})

router.get(/\/browse.*/, function (req, res, next) {

  var currentPath = req.path.substr('/browse/'.length)
  pathParts = currentPath.split('/')

  var owner = pathParts.shift()
  var repo  = pathParts.shift()

  console.log('owner: ' + owner)
  console.log('repo:  ' + repo)

  try{
    var files = require(`../maps/${owner}/${repo}.json`)
  } catch (error){
    return next(error);
  }

  log(files)

  while (pathParts.length > 0){
    files = files.children[pathParts.shift()]
  }

  log(files.children)

  for (var fileName in files.children){
    var extension = path.extname(fileName)
    if (extension == '.pdf'){
      var basename = path.basename(fileName, extension)
      var file = files.children[fileName]
      file.type = 'pdf'
      file.imagePath = `https://s3-eu-west-1.amazonaws.com/joelanman-github-gallery/png/${currentPath}/${basename}.png`
    }
  }

  log(files.children)
  
  res.render('files', {currentPath: currentPath, files: files.children})

})

module.exports = router
