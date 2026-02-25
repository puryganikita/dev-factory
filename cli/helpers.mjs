import fs from 'fs'
import path from 'path'

const MANIFEST_FILE = '.dev-factory-manifest.json'

export function loadManifest(cursorDir) {
  const p = path.join(cursorDir, MANIFEST_FILE)
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  }
  return { version: null, installedAt: null, agents: [], skills: [], extensions: {} }
}

export function saveManifest(cursorDir, manifest) {
  fs.mkdirSync(cursorDir, { recursive: true })
  fs.writeFileSync(
    path.join(cursorDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
}

/**
 * Collect all known agent filenames and skill folder names
 * from all dist versions (v1, v2, all-in) to identify dev-factory owned files.
 */
export function collectAllKnownFiles(distDir) {
  const agents = new Set()
  const skills = new Set()

  for (const ver of ['v1', 'v2', 'all-in']) {
    const agentsDir = path.join(distDir, ver, 'agents')
    if (fs.existsSync(agentsDir)) {
      for (const f of fs.readdirSync(agentsDir)) {
        if (f.endsWith('.md')) agents.add(f)
      }
    }

    const skillsDir = path.join(distDir, ver, 'skills')
    if (fs.existsSync(skillsDir)) {
      for (const f of fs.readdirSync(skillsDir)) {
        const full = path.join(skillsDir, f)
        if (fs.statSync(full).isDirectory()) skills.add(f)
      }
    }
  }

  return { agents, skills }
}

/**
 * Recursively copy a directory.
 */
export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Read and parse JSON file, or return fallback.
 */
export function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

/**
 * Write JSON file with pretty formatting.
 */
export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}
