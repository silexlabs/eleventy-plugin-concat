#!/usr/bin/env node

const { readFile, writeFile, mkdir } = require('fs/promises')
const { resolve, dirname, join } = require('path')
const { glob } = require('glob')
const { process: processContent } = require('./index')
const defaults = require('./defaults')

const USAGE = `
Usage: eleventy-plugin-concat [options] <input-pattern> [output-dir]

Options:
  -h, --help              Show this help message
  --base-url <url>        Base URL for your site (default: http://localhost:8080)
  --js-path <pattern>     JS output path pattern (default: js/{name}-concat.js)
  --css-path <pattern>    CSS output path pattern (default: css/{name}-concat.css)
  --js-url <pattern>      JS URL pattern in HTML (default: /js/{name}-concat.js)
  --css-url <pattern>     CSS URL pattern in HTML (default: /css/{name}-concat.css)

Examples:
  eleventy-plugin-concat "dist/**/*.html"
  eleventy-plugin-concat "dist/**/*.html" --base-url "https://example.com"
  eleventy-plugin-concat "_site/**/*.html" "_site"
`

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(USAGE)
    process.exit(0)
  }
  
  const inputPattern = args[0]
  let outputDir = null
  let options = { ...defaults }
  
  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1]
      
      if (!value || value.startsWith('--')) {
        console.error(`Error: Missing value for ${arg}`)
        process.exit(1)
      }
      
      switch (key) {
        case 'base-url':
          options.baseUrl = value
          break
        case 'js-path':
          options.jsPath = (page) => value.replace('{name}', getPageName(page))
          break
        case 'css-path':
          options.cssPath = (page) => value.replace('{name}', getPageName(page))
          break
        case 'js-url':
          options.jsUrl = (page) => value.replace('{name}', getPageName(page))
          break
        case 'css-url':
          options.cssUrl = (page) => value.replace('{name}', getPageName(page))
          break
        default:
          console.error(`Error: Unknown option ${arg}`)
          process.exit(1)
      }
      i++ // Skip the value
    } else if (!outputDir) {
      outputDir = arg
    }
  }
  
  // Find HTML files
  const files = await glob(inputPattern, { absolute: true })
  
  if (files.length === 0) {
    console.error(`Error: No files found matching pattern: ${inputPattern}`)
    process.exit(1)
  }
  
  console.log(`Processing ${files.length} HTML files...`)
  
  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8')
      const relativePath = filePath.replace(process.cwd() + '/', '')
      const page = {
        outputPath: relativePath,
        inputPath: relativePath
      }
      
      // Set output directory for file resolution
      options.output = outputDir || dirname(filePath)
      
      const [html, js, css] = await processContent(page, content, options)
      
      // Determine output paths
      const jsOutputPath = resolve(options.output, options.jsPath(page))
      const cssOutputPath = resolve(options.output, options.cssPath(page))
      
      // Create directories if needed
      await mkdir(dirname(jsOutputPath), { recursive: true })
      await mkdir(dirname(cssOutputPath), { recursive: true })
      
      // Write concatenated files
      await writeFile(jsOutputPath, js)
      await writeFile(cssOutputPath, css)
      
      // Write updated HTML
      await writeFile(filePath, html)
      
      console.log(`✓ Processed: ${relativePath}`)
      if (js.trim()) console.log(`  → JS: ${jsOutputPath}`)
      if (css.trim()) console.log(`  → CSS: ${cssOutputPath}`)
      
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message)
      process.exit(1)
    }
  }
  
  console.log('\nDone! 🎉')
}

function getPageName(page) {
  const path = page.outputPath || page.inputPath || 'page'
  return require('path').basename(path, '.html')
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message)
    process.exit(1)
  })
}

module.exports = { main }