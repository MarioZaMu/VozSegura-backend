// Local server that runs the api/ handlers like Vercel does, without the Vercel CLI.
// /api/<name> maps to api/<name>.ts and the exported function named after the HTTP method.
import { createServer, type IncomingMessage } from 'node:http'
import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Handler = (request: Request) => Response | Promise<Response>

const port = Number(process.env.PORT ?? 3000)
const apiDir = fileURLToPath(new URL('../api/', import.meta.url))

function toWebRequest(req: IncomingMessage, url: URL): Request {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: 'half',
  } as RequestInit)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  const match = /^\/api\/([\w-]+)$/.exec(url.pathname)
  const file = match ? `${apiDir}${match[1]}.ts` : ''

  try {
    if (!match || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Not found"}')
      return
    }
    const module = (await import(pathToFileURL(file).href)) as Record<string, Handler | undefined>
    const handler = module[req.method ?? 'GET']
    if (!handler) {
      res.writeHead(405, { 'Content-Type': 'application/json' }).end('{"error":"Method not allowed"}')
      return
    }
    const response = await handler(toWebRequest(req, url))
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"Internal error"}')
  } finally {
    console.log(`${req.method} ${url.pathname} -> ${res.statusCode}`)
  }
})

server.listen(port, () => console.log(`API running at http://localhost:${port}/api/health`))
