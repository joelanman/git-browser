var express = require('express')
var router = express.Router()
var GitHubApi = require('github')

/* GET home page. */
router.get('/', function (req, res, next) {

  var github = new GitHubApi({
    debug: true,
    headers: {
      'user-agent': 'github-gallery' // GitHub is happy with a unique user agent
    }
  })

  github.repos.getContent({
    'owner': 'UKHomeOffice',
    'repo': 'posters',
    'path': ''
  }, function (err, files){
      console.log(JSON.stringify(files, null, '  '))
      res.render('index', { files: files })
  })

})

module.exports = router
