'use strict'

var path = require('path').posix
var ImageSetDiffer = require('../') // in your code, require('webjerk-image-set-diff')
var diff = new ImageSetDiffer({
  runDir: path.join(__dirname, 'run'),
  refDir: path.join(__dirname, 'ref'),
  report: true
})
diff.run() // or ImageSetDiffer.factory(conf).run().then(...)
