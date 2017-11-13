require('dotenv').config()
var pg = require('pg')
pg.defaults.ssl = true

var db = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL
})

exports.db = db
