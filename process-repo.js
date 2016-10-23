var path = require('path')
var GitHubApi = require('github')
var aws = require('aws-sdk')
var request = require('request')

var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY
var S3_BUCKET = 'joelanman-github-gallery'

aws.config.update({accessKeyId: AWS_ACCESS_KEY,
                   secretAccessKey: AWS_SECRET_KEY})

var s3Stream = require('s3-upload-stream')(new aws.S3())

var owner = 'UKHomeOffice'
var repo = 'posters'

var log = function (data) {
  console.log(JSON.stringify(data, null, '  '))
}

var github = new GitHubApi({
  debug: true,
  headers: {
    'user-agent': 'github-gallery'
  }
})

github.gitdata.getTree({
  'owner': owner,
  'repo': repo,
  'sha': 'c9c8d1b1be8b1c213bd3176684ba93baebc5e7f8',
  'recursive': true
}, function (err, response) {
  if (err) {
    console.error(err)
    return
  }

  var tree = response.tree

  var map = {}

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

  var pdfs = []

  for (var i = 0; i < tree.length; i++) {
    var filePath = tree[i].path
    // var fileType = tree[i].type
    // var pathParts = path.split('/')
    // addToMap(pathParts, type, map)
    var fileExtension = path.extname(filePath)

    if (fileExtension === '.pdf') {
      pdfs.push(filePath)
    }
  }
  log(pdfs)
  githubToS3(pdfs)
})

function githubToS3 (files) {
  var file = files.pop()
  console.log(`githubToS3: ${file}`)
  var url = 'https://raw.githubusercontent.com'
  url += `/${owner}/${repo}/master/${file}`

  request(url).pipe(s3Stream.upload({
    'Bucket': S3_BUCKET,
    'Key': `pdf/${owner}/${repo}/${file}`,
    'ContentType': 'application/pdf'
  }).on('uploaded', function () {
    console.log(`uploaded ${file}`)
  }))

  if (files.length !== 0) {
    setTimeout(githubToS3, 2000, files)
  }
}
