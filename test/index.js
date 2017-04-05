'use strict'

require('perish')
var tape = require('tape')
var ImageSetDiffer = require('../')
var path = require('path').posix
var fs = require('fs-extra')
var bb = require('bluebird')
bb.promisifyAll(fs)

tape('case-no-dirs', t => {
  t.plan(2)
  try {
    var x = new ImageSetDiffer()
  } catch (err) {
    t.ok(err, 'no conf throws')
  }
  var idr = new ImageSetDiffer({ refDir: 'bad', runDir: 'bad' })
  idr.run().then(() => null).catch(err => {
    t.equals(err.code, 'ENOENT', 'errors on bad conf paths')
  })
})

tape('case-no-refs', t => {
  t.plan(3)
  var testRoot = path.resolve(__dirname, 'case-no-refs')
  var refDir = path.join(testRoot, 'ref')
  var runDir = path.join(testRoot, 'run')
  var idr = new ImageSetDiffer({ refDir, runDir })
  return Promise.resolve()
  .then(() => fs.removeAsync(refDir))
  .then(() => fs.mkdirpAsync(refDir))
  .then(() => fs.readdirAsync(refDir))
  .then(files => t.equals(0, files.length, 'ref dir empty'))
  .then(() => idr.run())
  .then(() => fs.readdirAsync(refDir))
  .then(files => t.equals(2, files.length, 'ref dir populated'))
  .then(() => fs.removeAsync(refDir))
  .then(() => fs.mkdirpAsync(refDir))
  .then(() => t.pass('teardown'))
  .catch(t.end)
})

tape('case-happy-matches', t => {
  t.plan(1)
  var testRoot = path.resolve(__dirname, 'case-happy-matches')
  var refDir = path.join(testRoot, 'ref')
  var runDir = path.join(testRoot, 'run')
  var diffDir = `${runDir}-diff`
  var idr = new ImageSetDiffer({ refDir, runDir })
  return Promise.resolve()
  .then(() => idr.run())
  .then(() => fs.removeAsync(diffDir))
  .then(() => t.pass('teardown'))
  .catch(t.end)
})

tape('case-unhappy-matches', t => {
  t.plan(3)
  var testRoot = path.resolve(__dirname, 'case-unhappy-matches')
  var refDir = path.join(testRoot, 'ref')
  var runDir = path.join(testRoot, 'run')
  var diffDir = `${runDir}-diff`
  var idr = new ImageSetDiffer({ refDir, runDir })
  return Promise.resolve()
  .then(() => idr.run())
  .catch(err => {
    t.equals(err.code, 'EIMAGEDIFFS', 'image diffs detected')
    t.ok(Array.isArray(err.differences), 'has .differences props')
  })
  .then(() => fs.removeAsync(diffDir))
  .then(() => t.pass('teardown'))
  .catch(t.end)
})

tape('case-missing-run-img', t => {
  t.plan(2)
  var testRoot = path.resolve(__dirname, 'case-missing-run-img')
  var refDir = path.join(testRoot, 'ref')
  var runDir = path.join(testRoot, 'run')
  var diffDir = `${runDir}-diff`
  var idr = new ImageSetDiffer({ refDir, runDir })
  return Promise.resolve()
  .then(() => idr.run())
  .catch(err => {
    t.equals(err.code, 'EMISSINGIMAGES', 'missing images detected')
  })
  .then(() => fs.removeAsync(diffDir))
  .then(() => t.pass('teardown'))
  .catch(t.end)
})
