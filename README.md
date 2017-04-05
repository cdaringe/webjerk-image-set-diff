# webjerk-image-set-diff

compares two sets of images.  image sets are PNGs derived from from a user provided folders, `refDir` & `runDir`.  images are compared by basename. that is, `/refDir/test-image.png` would be compared to `/runDir/test-image.png`.

the comparisons use [blink-diff](https://github.com/yahoo/blink-diff) to compare images.

```js
var ImageSetDiffer = require('webjerk-image-set-diff')
var refDir = '/reference-images'
var runDir = '/test-run-images'
var idr = new ImageSetDiffer({ refDir, runDir, report: true })
idr.run()
.then(...) // resolves a set of blinkDifference results
```

when there are mismatches, an `ImageSetDiffer` instance throws.  `err.code` will equal `'EIMAGEDIFFS'`. more interestingly, `err.differences` will have an array of the blink difference data attached to the failing image.

```js
console.log(err.differences)
// => [{ basename, blinkDiff, message }, ..., for, each, image, mismatch]
```
