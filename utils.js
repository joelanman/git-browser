const log = function (data) {
  if (typeof (data) == "object"){
    console.log(JSON.stringify(data, null, '  '))
  } else {
    console.log(data)
  }
}

exports.log = log
