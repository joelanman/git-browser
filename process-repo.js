#!/usr/bin/env node

var fs = require('fs')
var path = require('path')

var aws = require('aws-sdk')
var GitHubApi = require('github')
var minimist = require('minimist')
var mkdirp = require('mkdirp')
var request = require('request')

var argv = minimist(process.argv.slice(2))

var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY
var S3_BUCKET = 'joelanman-github-gallery'

aws.config.update({accessKeyId: AWS_ACCESS_KEY,
                   secretAccessKey: AWS_SECRET_KEY})

var s3Stream = require('s3-upload-stream')(new aws.S3())

var owner = argv._[0]
var repo = argv._[1]
var sha = (argv._[2]) ? argv._[2] : "master"

if (!owner) {
  console.error('No owner specified. Usage: process-repo [owner] [repo]')
  process.exit(1)
}

if (!repo) {
  console.error('No repo specified. Usage: process-repo [owner] [repo]')
  process.exit(1)
}

var log = function (data) {
  console.log(JSON.stringify(data, null, '  '))
}

var github = new GitHubApi({
  headers: {
    'user-agent': 'github-gallery'
  }
})

github.gitdata.getTree({
  'owner': owner,
  'repo': repo,
  'sha': sha,
  'recursive': true
}, function (err, response) {
  if (err) {
    console.error(err)
    return
  }

  var tree = response.tree

  var map = {
    'type': 'tree',
    'children': {}
  }

  var addToMap = function (pathParts, type, parent) {
    if (pathParts.length > 1) {
      var folder = pathParts.shift()
      if (!parent[folder]) {
        parent[folder] = {
          'type': 'tree',
          'children': {}
        }
      }
      addToMap(pathParts, type, parent[folder].children)
      return
    }

    var name = pathParts[0]

    if (type === 'tree') {
      parent[name] = {
        'type': 'tree',
        'children': {}
      }
    } else {
      parent[name] = {
        'type': type
      }
    }
  }

  var filesToConvert = []

  for (var i = 0; i < tree.length; i++) {
    var filePath = tree[i].path
    var fileType = tree[i].type
    var pathParts = filePath.split('/')
    addToMap(pathParts, fileType, map.children)
    var fileExtension = path.extname(filePath).toLowerCase()

    if (fileExtension === '.pdf' || fileExtension === '.png' || fileExtension === '.jpg'|| fileExtension === '.svg') {
      filesToConvert.push(filePath)
    }
  }
  log(map)
  log(filesToConvert)

  mkdirp.sync(`maps/${owner}/`)

  fs.writeFileSync(`maps/${owner}/${repo}.json`, JSON.stringify(map))
  githubToS3(filesToConvert)
})

function githubToS3 (files) {
  var file = files.pop()
  console.log(`githubToS3: ${file}`)
  var url = 'https://raw.githubusercontent.com'
  url += `/${owner}/${repo}/master/${file}`

  var contentTypes = {
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png'
  }

  var fileExtension = path.extname(file)

  var ContentType = contentTypes[fileExtension]

  request(url).pipe(s3Stream.upload({
    'Bucket': S3_BUCKET,
    'Key': `in/${owner}/${repo}/${file}`,
    'ContentType': ContentType
  }).on('uploaded', function () {
    console.log(`uploaded ${file}`)
  }))

  if (files.length !== 0) {
    setTimeout(githubToS3, 2000, files)
  }
}
