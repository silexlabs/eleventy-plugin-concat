const assert = require('assert')
const {process} = require('../src')
const defaults = require('../src/defaults')
const pages = require('html-pages')

console.log(`
--------------
Tests starting
--------------`)

const page = {
  outputPath: '_site',
}

it('test defaults', async () => {
  assert.equal(defaults.jsPath({ outputPath: '_site/page.html' }), 'js/page-concat.js')
  assert.equal(defaults.jsUrl({ outputPath: '_site/page.html' }), '/js/page-concat.js')
  assert.equal(defaults.cssPath({ outputPath: '_site/page.html' }), 'css/page-concat.css')
  assert.equal(defaults.cssUrl({ outputPath: '_site/page.html' }), '/css/page-concat.css')
})
it('should do nothing', async () => {
  {
    const [html, js, css] = await process(page, '', defaults)
    assert.equal(html, '')
    assert.deepEqual(js, '')
    assert.deepEqual(css, '')
  }
  {
    const init = '<body><script></script><style></style></body>'
    const [html, js, css] = await process(page, init, defaults)
    assert.equal(html, init)
    assert.deepEqual(js, '')
    assert.deepEqual(css, '')
  }
  {
    const init = '<head><script></script><style></style></head>'
    const [html, js, css] = await process(page, init, defaults)
    assert.equal(html, init)
    assert.deepEqual(js, '')
    assert.deepEqual(css, '')
  }
})
it('concat inline scripts', async () => {
  {
    const init = getTestHtml([
      {attributes: 'data-concat', content: 'script 1'},
      {attributes: 'data-concat', content: 'script 2'},
    ])
    const [html, js, css] = await process(page, init, defaults)
    assert.deepEqual(cleanup(html), getTestHtml([
      {attributes: `defer src="${defaults.jsUrl(page)}"`},
    ]))
    assert.deepEqual(js, `script 1;\nscript 2`)
  }
})
it('concat local scripts', async () => {
  {
    const init = getTestHtml([
      {attributes: `data-concat src="${defaults.baseUrl}/tests/local1.js"`},
      {attributes: `data-concat src="/tests/local2.js"`},
      {attributes: `data-concat src="./tests/local3.js"`},
    ])
    const [html, js, css] = await process(page, init, {
      ...defaults,
      output: '.', // No _site folder in tests
    })
    assert.deepEqual(cleanup(html), getTestHtml([
      {attributes: `defer src="${defaults.jsUrl(page)}"`},
    ]))
    assert.equal(cleanup(js), `test 1\n;\ntest 2\n;\ntest 3`)
  }
})
it('concat local scripts which do not exist', async () => {
  {
    const init = getTestHtml([
      {attributes: `data-concat src="${defaults.baseUrl}/tests/not-exist.js"`},
    ])
    shoudlThrow(async () => process(page, init, defaults))
  }
  {
    const init = getTestHtml([
      {attributes: `data-concat src="./tests/not-exist.js"`},
    ])
    shoudlThrow(async () => process(page, init, defaults))
  }
  {
    const init = getTestHtml([
      {attributes: `data-concat src="/tests/not-exist.js"`},
    ])
    shoudlThrow(async () => process(page, init, defaults))
  }
})
const PORT = 1904
describe('remote scripts', () => {
  let pagesServer = null
  before(function(done) {
    console.log('Starting local web server')
    pagesServer = pages(__dirname, {
        port: PORT,
        'no-port-scan': true,
        'no-clipboard': true,
        'no-listing': true,
        'silent': true,
    })
    setTimeout(() => done(), 1000)
  })
  after(function() {
    pagesServer.stop()
    console.log('Stopping local web server')
  })
  it('concat remote scripts', async () => {
    {
      const init = getTestHtml([
        {attributes: `data-concat src="http://0.0.0.0:${PORT}/local1.js"`},
        {attributes: `data-concat src="http://0.0.0.0:${PORT}/local2.js"`},
      ])
      const [html, js, css] = await process(page, init, defaults)
      assert.deepEqual(cleanup(html), getTestHtml([
        {attributes: `defer src="${defaults.jsUrl(page)}"`},
      ]))
      assert.equal(cleanup(js), 'test 1\n;\ntest 2')
    }
  })
})
it('concat inline styles', async () => {
  {
    const init = getTestHtml(null, [
      {attributes: 'data-concat', content: 'style 1'},
      {attributes: 'data-concat', content: 'style 2'},
    ])
    const [html, js, css] = await process(page, init, defaults)
    assert.deepEqual(cleanup(html), getTestHtml(null, [
      {attributes: `href="${defaults.cssUrl(page)}"`},
    ]))
    assert.deepEqual(cleanup(css), `style 1;\nstyle 2`)
  }
})

/* *********************** */
// Utils
async function shoudlThrow(f) {
    let error = null
    try {
      await f
    } catch(e) {
      error = e
    }
    assert.ok(error)
}
function getTestHtml(scripts = [], styles = []) {
  scripts = scripts ?? []
  styles = styles ?? []
  return cleanup(`
    <head>
      ${ scripts.map(script => `
      <script ${script.attributes || ''}>${script.content || ''}</script>
      `).join('\n')}
      ${ styles.map(style => style.content ? `
      <style ${style.attributes || ''}>${style.content || ''}</style>
      ` : `
      <link rel="stylesheet" ${style.attributes || ''}>
      `).join('\n')}
    </head>
  `)
}
function cleanup(str) {
  return str
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .join('\n')
}
it('test of getTestHtml', () => {
  assert.equal(getTestHtml([
    {attributes: 'data-concat', content: 'script 1'},
  ]), cleanup(`<head>
      <script data-concat>script 1</script>
    </head>`))
  assert.equal(getTestHtml(null, [
    {attributes: 'data-concat', content: 'style 1'},
  ]), cleanup(`<head>
      <style data-concat>style 1</style>
    </head>`))
  assert.equal(getTestHtml(null, [
    {attributes: 'data-concat'},
  ]), cleanup(`<head>
      <link rel="stylesheet" data-concat>
    </head>`))
})

