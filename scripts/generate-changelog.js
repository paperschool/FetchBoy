#!/usr/bin/env node

/**
 * Changelog Generator Script
 * 
 * This script generates a changelog from git commits following conventional commits format.
 * Run: node scripts/generate-changelog.js
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
const currentVersion = packageJson.version;

// Get all commits since last tag or from beginning
function getCommits() {
  try {
    // Get tags sorted by version
    const tags = execSync('git tag -l "v*" --sort=-v:refname 2>/dev/null || echo ""', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(t => t);
    
    const lastTag = tags.length > 0 ? tags[0] : null;
    
    let gitLog;
    if (lastTag) {
      gitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s||%b||%an" 2>/dev/null`, { encoding: 'utf-8' });
    } else {
      gitLog = execSync('git log --pretty=format:"%s||%b||%an" 2>/dev/null', { encoding: 'utf-8' });
    }
    
    return gitLog.trim().split('\n').filter(c => c);
  } catch (error) {
    console.log('No git history found, using existing changelog');
    return [];
  }
}

// Parse conventional commits
function parseCommits(commits) {
  const changes = {
    features: [],
    fixes: [],
    breaking: [],
    other: []
  };
  
  for (const commit of commits) {
    const [subject, body = '', author = ''] = commit.split('||');
    const message = body ? `${subject}\n${body}` : subject;
    
    if (message.includes('BREAKING CHANGE') || subject.includes('BREAKING CHANGE')) {
      changes.breaking.push({ subject: subject.replace(/^[a-zA-Z]+\([^)]*\):\s*/, ''), author });
    } else if (subject.startsWith('feat') || subject.startsWith('feat:')) {
      changes.features.push({ subject: subject.replace(/^[a-zA-Z]+\([^)]*\):\s*/, ''), author });
    } else if (subject.startsWith('fix') || subject.startsWith('fix:')) {
      changes.fixes.push({ subject: subject.replace(/^[a-zA-Z]+\([^)]*\):\s*/, ''), author });
    } else if (!subject.includes('chore') && !subject.includes('docs') && !subject.includes('refactor')) {
      changes.other.push({ subject: subject.replace(/^[a-zA-Z]+\([^)]*\):\s*/, ''), author });
    }
  }
  
  return changes;
}

// Generate markdown changelog
function generateMarkdown(changes) {
  let md = `# Changelog\n\n`;
  md += `All notable changes to this project will be documented in this file.\n\n`;
  md += `## [${currentVersion}] - ${new Date().toISOString().split('T')[0]}\n\n`;
  
  if (changes.breaking.length > 0) {
    md += `### ⚠️ BREAKING CHANGES\n\n`;
    for (const item of changes.breaking) {
      md += `- ${item.subject}\n`;
    }
    md += '\n';
  }
  
  if (changes.features.length > 0) {
    md += `### ✨ Features\n\n`;
    for (const item of changes.features) {
      md += `- ${item.subject}\n`;
    }
    md += '\n';
  }
  
  if (changes.fixes.length > 0) {
    md += `### 🐛 Bug Fixes\n\n`;
    for (const item of changes.fixes) {
      md += `- ${item.subject}\n`;
    }
    md += '\n';
  }
  
  if (changes.other.length > 0) {
    md += `### Other Changes\n\n`;
    for (const item of changes.other) {
      md += `- ${item.subject}\n`;
    }
    md += '\n';
  }
  
  // Add previous changelog if exists
  try {
    const existingChangelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
    if (existingChangelog) {
      md += '\n---\n\n';
      md += existingChangelog;
    }
  } catch (e) {
    // No existing changelog
  }
  
  return md;
}

// Generate JSON changelog for the app
function generateJsonChangelog(changes) {
  const existingChangelog = { changelog: [] };
  
  try {
    const data = readFileSync(join(process.cwd(), 'src/data/changelog.json'), 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed.changelog) {
      existingChangelog.changelog = parsed.changelog;
    }
  } catch (e) {
    // Use defaults
  }
  
  const newChanges = [];
  
  if (changes.breaking.length > 0) {
    newChanges.push(...changes.breaking.map(c => `BREAKING: ${c.subject}`));
  }
  if (changes.features.length > 0) {
    newChanges.push(...changes.features.map(c => c.subject));
  }
  if (changes.fixes.length > 0) {
    newChanges.push(...changes.fixes.map(c => c.subject));
  }
  if (changes.other.length > 0) {
    newChanges.push(...changes.other.map(c => c.subject));
  }
  
  // Only add if there are new changes
  if (newChanges.length > 0) {
    existingChangelog.changelog.unshift({
      version: currentVersion,
      date: new Date().toISOString().split('T')[0],
      changes: newChanges
    });
  }
  
  return existingChangelog;
}

// Main execution
console.log('Generating changelog...');
const commits = getCommits();
const changes = parseCommits(commits);

// Generate and write CHANGELOG.md
const changelogMd = generateMarkdown(changes);
writeFileSync(join(process.cwd(), 'CHANGELOG.md'), changelogMd);
console.log('✓ Generated CHANGELOG.md');

// Generate and write src/data/changelog.json
const changelogJson = generateJsonChangelog(changes);
writeFileSync(
  join(process.cwd(), 'src/data/changelog.json'), 
  JSON.stringify(changelogJson, null, 2)
);
console.log('✓ Updated src/data/changelog.json');

// Output for GitHub Actions
console.log('\n--- CHANGELOG OUTPUT ---');
console.log(changelogMd);
