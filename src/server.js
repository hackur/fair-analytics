const micro = require('micro')
const cors = require('micro-cors')({ allowMethods: ['POST'] })
const url = require('url')
const SseChannel = require('sse-channel')
const sse = new SseChannel({
  cors: {
    origins: ['*']
  },
  jsonEncode: true
})
const { json, send, sendError } = micro

const createServer = feed => {
  async function storeLog (rawBody) {
    // TODO: filter out not needed data
    const data = rawBody
    return new Promise((resolve, reject) =>
      feed.append(rawBody, err => {
        if (err) return reject(err)
        sse.send({
          event: 'owt',
          data
        })
        resolve()
      })
    )
  }

  async function postHandler (req, res) {
    const body = await json(req)
    await storeLog(body)
    send(res, 204, null)
  }

  async function getHandler (req, res) {
    const { pathname } = url.parse(req.url)
    if (pathname === '/favicon.ico') {
      send(res, 204, null)
      return
    }
    if (pathname === '/_live') {
      sse.addClient(req, res)
      return
    }
    return feed.discoveryKey.toString('hex')
  }

  async function handler (req, res, feed) {
    try {
      switch (req.method) {
        case 'POST':
          return await cors(postHandler)(req, res, feed)
        case 'GET':
          return await getHandler(req, res)
        default:
          send(res, 405, 'Method Not Allowed')
          break
      }
    } catch (err) {
      throw err
    }
  }

  return micro(async (req, res) => {
    try {
      return await handler(req, res, feed)
    } catch (err) {
      sendError(req, res, err)
    }
  })
}

module.exports = createServer