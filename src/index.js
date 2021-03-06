'use strict'

var path = require('path').posix
var BlinkDiff = require('blink-diff')
var reporter = require('webjerk-image-set-diff-reporter')
var intersection = require('lodash/intersection')
var without = require('lodash/without')
var isNil = require('lodash/isNil')
var fs = require('fs-extra')
var bb = require('bluebird')
bb.promisifyAll(fs)

/**
 * executes an image diff test workflow
 * @class ImageSetDiffer
 * @param {*} conf
 * @param {string} conf.refDir folder of reference images. relative or absolute
 * @param {string} conf.runDir folder of test run images. relative or absolute
 * @param {boolean} [conf.allowNewImages] allows new images to enter into the reference set. defaults to true
 * @param {boolean} [conf.approveChanges] updates ref images to match run images
 */
function ImageSetDiffer (conf) {
  if (!conf) throw new Error('missing config')
  if (!conf.refDir || !conf.runDir) throw new Error('refDir and runDir are required')
  if (!conf.diffDir) conf.diffDir = `${path.resolve(conf.runDir)}-diff`
  if (isNil(conf.allowNewImages)) conf.allowNewImages = process.env.WEBJERK_ALLOW_NEW_IMAGES === undefined ? true : !!process.env.WEBJERK_ALLOW_NEW_IMAGES
  if (isNil(conf.approveChanges)) conf.approveChanges = process.env.WEBJERK_APPROVE_CHANGES === undefined ? false : !!process.env.WEBJERK_APPROVE_CHANGES
  Object.assign(this, { conf })
}
ImageSetDiffer.factory = function (conf) { return new ImageSetDiffer(conf) }

Object.assign(ImageSetDiffer.prototype, {
  _refBasenames: [],
  _runBasenames: [],

  _createDiffConfig (basename) {
    return {
      imageAPath: path.resolve(this.conf.refDir, basename),
      imageBPath: path.resolve(this.conf.runDir, basename),
      thresholdType: BlinkDiff.THRESHOLD_PERCENT,
      threshold: 0.01,
      imageOutputPath: path.join(this.conf.diffDir, basename)
    }
  },
  /**
   * Compares all images between ref & run
   * @returns {Promise}
   */
  compare () {
    return fs.mkdirpAsync(this.conf.diffDir)
    .then(() => Promise.all(
      this._imagePartitions.toCompare.map(basename => {
        var diff = new BlinkDiff(this._createDiffConfig(basename))
        return bb.promisify(diff.run.bind(diff))()
        .then(blinkDiff => {
          if (blinkDiff.differences) {
            var err = new Error(`${basename} changed beyond allowed allotted threshold`)
            Object.assign(err, { blinkDiff, basename })
            return err // NOTE, we are not throwing!  We want all results
          }
          return blinkDiff
        })
      })
    ))
    .then(this._handleCompareResults)
  },
  _copyRunImagesToRefImages () {
    return Promise.all(this._runBasenames.map(tBasname => {
      return fs.copyAsync(path.join(this.conf.runDir, tBasname), path.join(this.conf.refDir, tBasname))
    }))
    .then(() => { this._refBasenames = this._runBasenames })
  },
  _handleCompareResults (res) {
    var errors = res.filter(r => r instanceof Error)
    if (errors.length) {
      var err = new Error('image differences detected')
      err.code = 'EIMAGEDIFFS'
      err.differences = errors.map(({ basename, blinkDiff, message }) =>
        ({ basename, blinkDiff, message }))
      throw err
    }
    return res
  },
  _handleNewImages () {
    var { newImages } = this._imagePartitions
    if (!newImages) throw new Error('missing image group')
    if (!newImages.length) return Promise.resolve()
    console.log(`${newImages.length} new images detected`)
    if (!this.conf.allowNewImages) {
      var err = new Error([
        'new images detected:',
        newImages.map(img => `\t${img}\n`),
        'use `allowNewImages` or WEBJERK_ALLOW_NEW_IMAGES to enable'
      ].join('\n'))
      err.code = 'ENEWIMAGESFORBIDDEN'
      throw err
    }
    return Promise.all(newImages.map(tBasname => {
      return fs.copyAsync(
        path.join(this.conf.runDir, tBasname),
        path.join(this.conf.refDir, tBasname)
      )
    }))
    .then(() => { this._refBasenames = this._runBasenames })
  },
  _maybeApproveChanges () {
    if (this.conf.approveChanges) return this._copyRunImagesToRefImages()
    return Promise.resolve()
  },
  _partitionImageBasenames () {
    var refBasenames = this._refBasenames
    var runBasenames = this._runBasenames
    var missingImages = without.apply(null, [refBasenames].concat(runBasenames))
    var toCompare = intersection(refBasenames, runBasenames)
    var newImages = without.apply(null, [runBasenames].concat(refBasenames))
    var imagePartitions = { missingImages, toCompare, newImages }
    Object.assign(this, { _imagePartitions: imagePartitions })
    return imagePartitions
  },
  readTestState () {
    return Promise.all([
      this.conf.refDir,
      this.conf.runDir
    ].map(f => fs.readdirAsync(f)))
    .then(([ref, run]) => {
      this._refBasenames = ref.filter(f => f.match(/\.png$/))
      this._runBasenames = run.filter(f => f.match(/\.png$/))
    })
  },
  report (differences) {
    if (!Array.isArray(differences)) throw new Error('missing array of differences')
    if (!this.conf.report) return Promise.resolve()
    var enriched = differences.map(diff => Object.assign({}, diff, {
      name: diff.basename,
      aFilename: path.join(this.conf.refDir, diff.basename),
      bFilename: path.join(this.conf.runDir, diff.basename)
    }))
    return reporter({ differences: enriched, dest: path.join(this.conf.diffDir, 'report') })
  },
  run () {
    return bb.resolve()
    .then(() => this.readTestState())
    .then(() => this._partitionImageBasenames())
    .then(partitions => this.validateImagePartitions(partitions))
    .then(() => this.upsertReferenceImages())
    .then(() => this._maybeApproveChanges())
    .then(() => this.compare())
    .catch(err => {
      if (err.code !== 'EIMAGEDIFFS') throw err
      return this.report(err.differences)
      .then(() => {
        throw err
      })
    })
  },
  upsertReferenceImages () {
    var { newImages } = this._imagePartitions
    if (!newImages) throw new Error('missing image group')
    if (this._refBasenames.length) {
      // reference images are already in place. handle updates
      if (newImages.length) return this._handleNewImages()
      return Promise.resolve()
    }
    console.log('no reference images found. setting reference images from run.')
    return this._copyRunImagesToRefImages()
  },
  validateImagePartitions ({ missingImages, toCompare, newImages }) {
    if (!missingImages || !toCompare || !newImages) throw new Error('missing image group')
    if (missingImages.length) {
      var err = new Error([
        `missing images:\n\t${missingImages.join('\n\t')}`,
        'if these images are no longer required, please remove them from the reference set.'
      ].join('\n'))
      err.code = 'EMISSINGIMAGES'
      throw err
    }
  }
})

module.exports = ImageSetDiffer
