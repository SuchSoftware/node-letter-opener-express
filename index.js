module.exports = letterOpenerExpress

var _ = require('lodash')
var express = require('express')
var jade = require('jade')
var lessMiddleware = require('less-middleware')
var letterOpener = require('letter-opener')
var path = require('path')

var packageJson = require('./package.json')

var viewsDir = path.join(__dirname, 'views')

// params - An object with the following possible keys
//   app: And Express application where we mount ourselves
//   mountPoint: (optional) the point in `app` where we mount ourselves (default `/letter_opener`)
//   rootPath: (optional) Root URL where this engine lives in the host site.
//             See the documentation for why that would matter.
//            (default - treat `mountPoint as coming off the root)
//   storageDir: path to where the email files are stored
function letterOpenerExpress(params) {
  var core = new letterOpener(params.storageDir)
  var mountPoint = params.mountPoint || '/letter_opener'
  var locals = {
    root: params.rootPath || mountPoint
  , version: packageJson.version
  }

  var endpoints = {
    index: function(req, res, next) {
      var context = _.clone(locals)
      context.messages = req.messageFiles

      var resBody = jade.renderFile(templatePath('index.jade'), context)

      res.send(resBody)
    }

  , show: function(req, res, next) {
      var context = _.clone(locals)
      context.messages = req.messageFiles
      context.message = req.message
      context.id = req.id

      var resBody = jade.renderFile(templatePath('show.jade'), context)

      res.send(resBody)
    }

  // Gets just the HTML for a message so that we can load that in via an iframe and not have the main page's
  // styling interfere with the emails
  , messageHtml: function(req, res, next) {
      res.send(req.message.payload.html)
    }

  , about: function(req, res) {
      var context = _.clone(locals)
      context.messages = req.messageFiles

      var resBody = jade.renderFile(templatePath('about.jade'), context)

      res.send(resBody)
    }

  , feedback: function(req, res) {
      var context = _.clone(locals)
      context.messages = req.messageFiles

      var resBody = jade.renderFile(templatePath('feedback.jade'), context)

      res.send(resBody)
    }

  , _500: function (err, req, res, next) {
      var context = _.clone(locals)
      context.message = err.message
      context.stack = err.stack

      var resBody = jade.renderFile(templatePath('500.jade'), context)

      res.status(500).send(resBody)
    }

    // Isn't this an arbitrary distinction?  We have 2 404 handlers.  This one matches when the URL hit
    // doesn't match any of the routes.
  , _404: function(req, res, next) {
      core.findAllMessages(function allMessages(err, messageFiles) {
        if (err) return next(err)

        var context = _.clone(locals)
        context.messages = messageFiles

        var resBody = jade.renderFile(templatePath('404.jade'), context)

        res.status(404).send(resBody)
      })
    }

    // Isn't this an arbitrary distinction.  We have 2 404 handlers.  This one matches when the URL
    // matches the message routes, but we can't find the message.  The req.param call will bail and put
    // an error in the stack.  Believe it or not, I prefer this to having the show handler check for
    // the existence of the message.
  , _404Error: function(err, req, res, next) {
      if (err.message !== 'not found') return next(err)

      endpoints._404(req, res, next)
    }
  }

  function findAllMessagesMiddleware(req, res, next) {
    core.findAllMessages(function allMessages(err, messageFiles) {
      if (err) return next(err)

      req.messageFiles = messageFiles

      next()
    })
  }

  function loadMessage(req, res, next, id) {
    core.findMessage(id, function gotMessage(err, message) {
      if (err) return next(err)
      if (!message) return next(new Error('not found'))

      message.id = id
      req.message = message
      next()
    })
  }

  // Configure less
  var lessMiddlewareOptions = {
        dest: path.resolve(__dirname, 'public')
      , relativeUrls: true
      , force: true
      , once: false
      , debug: true
      , preprocess: {
          path: function(pathname,req) {
            return pathname.replace('/css', '')
          }
        }
      , parser: {dumpLineNumbers: 'mediaquery'}
      , compiler: {compress: false}
  }

  var router = express.Router()

  router.use(lessMiddleware(path.resolve(__dirname, 'stylesheets'), lessMiddlewareOptions))
  router.use(express.static(path.resolve(__dirname, 'public')))

  router.route('/')
    .get(findAllMessagesMiddleware, endpoints.index)

  router.param('id', loadMessage)
  router.route('/message/:id/html')
    .get(findAllMessagesMiddleware, endpoints.messageHtml)

  router.route('/message/:id')
    .get(findAllMessagesMiddleware, endpoints.show)

  router.route('/about')
    .get(findAllMessagesMiddleware, endpoints.about)

  router.route('/feedback')
    .get(findAllMessagesMiddleware, endpoints.feedback)

  // catch everything else so we 404 inside of letter-opener rather than punting to the hosting app
  router.route('*')
    .all(findAllMessagesMiddleware, endpoints._404)

  router.use(endpoints._404Error)
  router.use(endpoints._500)

  params.app.use(mountPoint, router)

  return router
}

function templatePath(template) {
  return path.resolve(viewsDir, template)
}

