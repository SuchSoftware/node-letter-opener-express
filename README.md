# node-letter-opener-express

Bindings into letter-opener sufficient for an Express 4 application.

[![NPM version](https://badge.fury.io/js/letter-opener-express.svg)](http://badge.fury.io/js/letter-opener-express)

## Installation

```bash
$ npm install letter-opener-express
```

## Quick Start

```javascript
var letterOpener = require('letter-opener-express')

var letterOpenerConfig = {
  app: app
, storageDir: 'tmp'
}

letterOpener(letterOpenerConfig)
```

## Contributors

 Author: [Ethan Garofolo](http://learnallthenodes.com)

## License

[MIT](LICENSE)
