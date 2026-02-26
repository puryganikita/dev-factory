#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function processAgentsDir(agentsDir, destDir) {
  if (!fs.existsSync(agentsDir)) return;

  const levelsDir = path.join(agentsDir, 'levels');
  const entries = fs.readdirSync(agentsDir);

  // Collect names of agents that have body files (leveled agents)
  const bodyAgentNames = new Set(
    entries
      .filter(f => f.endsWith('.body.md'))
      .map(f => f.replace('.body.md', ''))
  );

  // Process simple agents (plain .md, not .body.md, not the levels dir)
  for (const entry of entries) {
    const fullPath = path.join(agentsDir, entry);
    if (fs.statSync(fullPath).isDirectory()) continue;
    if (!entry.endsWith('.md') || entry.endsWith('.body.md')) continue;

    copyFile(fullPath, path.join(destDir, entry));
    console.log(`  copied: ${entry}`);
  }

  // Process leveled agents: head + body -> merged file
  if (!fs.existsSync(levelsDir)) return;

  for (const headFile of fs.readdirSync(levelsDir)) {
    if (!headFile.endsWith('.head.md')) continue;

    const agentName = headFile.replace('.head.md', '');
    const levelMatch = agentName.match(/^(.+)_(low|medium|high)$/);
    if (!levelMatch) {
      console.warn(`  warn: unexpected head filename format: ${headFile}`);
      continue;
    }

    const baseName = levelMatch[1];
    const bodyFile = path.join(agentsDir, `${baseName}.body.md`);

    if (!fs.existsSync(bodyFile)) {
      console.warn(`  warn: body file not found for ${agentName}: ${bodyFile}`);
      continue;
    }

    const headContent = fs.readFileSync(path.join(levelsDir, headFile), 'utf8').trimEnd();
    const bodyContent = fs.readFileSync(bodyFile, 'utf8').trimStart();
    const merged = headContent + '\n\n' + bodyContent;

    const destFile = path.join(destDir, `${agentName}.md`);
    fs.writeFileSync(destFile, merged, 'utf8');
    console.log(`  built: ${agentName}.md (head + body)`);
  }
}

function processSkillsDir(skillsDir, destDir) {
  if (!fs.existsSync(skillsDir)) return;

  for (const skillFolder of fs.readdirSync(skillsDir)) {
    const skillFile = path.join(skillsDir, skillFolder, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    copyFile(skillFile, path.join(destDir, skillFolder, 'SKILL.md'));
    console.log(`  copied skill: ${skillFolder}/SKILL.md`);
  }
}

function buildTarget(label, versions, destBase) {
  console.log(`\nCleaning ${path.relative(ROOT, destBase)}/...`);
  cleanDir(path.join(destBase, 'agents'));
  cleanDir(path.join(destBase, 'skills'));

  for (const version of versions) {
    console.log(`\n[${label}] Processing ${version} agents...`);
    processAgentsDir(path.join(SRC, version, 'agents'), path.join(destBase, 'agents'));

    console.log(`[${label}] Processing ${version} skills...`);
    processSkillsDir(path.join(SRC, version, 'skills'), path.join(destBase, 'skills'));
  }

  console.log(`\n${path.relative(ROOT, destBase)}/ contents:`);
  console.log('  agents:', fs.readdirSync(path.join(destBase, 'agents')).join(', '));
  console.log('  skills:', fs.readdirSync(path.join(destBase, 'skills')).filter(f => fs.statSync(path.join(destBase, 'skills', f)).isDirectory()).join(', '));
}

// --- Main ---

buildTarget('just-do-it',        ['just-do-it'],                                        path.join(DIST, 'just-do-it'));
buildTarget('analytics-factory', ['analytics-factory'],                                  path.join(DIST, 'analytics-factory'));
buildTarget('code-factory',      ['code-factory'],                                       path.join(DIST, 'code-factory'));
buildTarget('all-in',            ['just-do-it', 'analytics-factory', 'code-factory'],    path.join(DIST, 'all-in'));

// --- Extensions (copy as-is) ---

const extSrc = path.join(SRC, 'extensions');
const extDist = path.join(DIST, 'extensions');
if (fs.existsSync(extSrc)) {
  if (fs.existsSync(extDist)) {
    fs.rmSync(extDist, { recursive: true });
  }
  fs.cpSync(extSrc, extDist, { recursive: true });
  console.log('\nCopied extensions/');
}

console.log('\nDone.');
