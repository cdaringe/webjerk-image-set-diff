# webjerk-image-set-diff

[![Greenkeeper badge](https://badges.greenkeeper.io/cdaringe/webjerk-image-set-diff.svg)](https://greenkeeper.io/)

compares two sets of images.  image sets are PNGs derived from from a user provided folders, `refDir` & `runDir`.  images are compared by basename. that is, `/refDir/test-image.png` would be compared to `/runDir/test-image.png`.

the comparisons use [blink-diff](https://github.com/yahoo/blink-diff) to compare images.

## usage

```js
var ImageSetDiffer = require('webjerk-image-set-diff')
var refDir = '/reference-images'
var runDir = '/test-run-images'
var idr = new ImageSetDiffer({ refDir, runDir, report: true, allowNewImages: false })
idr.run()
.then(...) // resolves a set of blinkDifference results
```

when there are mismatches, an `ImageSetDiffer` instance throws.  `err.code` will equal `'EIMAGEDIFFS'`. more interestingly, `err.differences` will have an array of the blink difference data attached to the failing image.

```js
console.log(err.differences)
// => [{ basename, blinkDiff, message }, ..., for, each, image, mismatch]
```

## config

some settings may be set from the env:

`WEBJERK_ALLOW_NEW_IMAGES`, empty string ~false, anything else, ~true
