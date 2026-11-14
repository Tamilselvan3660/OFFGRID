import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const token = execSync('gh auth token').toString().trim();
const OWNER = 'Tamilselvan3660';
const REPO = 'OFFGRID';
const BRANCH = 'main';
const ROOT = path.resolve('d:/OFFGRID');

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dist-app', '.git', 'data']);
const IGNORED_EXTS = ['.log', '.db', '.db-journal', '.db-wal', '.db-shm', '.zip'];
const IGNORED_FILES = new Set(['.env', '.env.local', '.DS_Store']);

function shouldIgnore(relPath) {
  const parts = relPath.split(/[/\\]/);
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }
  const basename = path.basename(relPath);
  if (IGNORED_FILES.has(basename)) return true;
  for (const ext of IGNORED_EXTS) {
    if (basename.endsWith(ext)) return true;
  }
  return false;
}

function getAllFiles(dir, baseDir = dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (shouldIgnore(relPath)) continue;

    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

async function githubApi(endpoint, options = {}) {
  const url = `https://api.github.com/${endpoint.replace(/^\//, '')}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OFFGRID-Pusher',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API Error ${res.status} on ${endpoint}: ${errorText}`);
  }
  return res.json();
}

async function main() {
  console.log(`Starting push to https://github.com/${OWNER}/${REPO} on branch '${BRANCH}'...`);

  // 1. Get branch commit SHA
  console.log('Fetching latest commit SHA...');
  const refData = await githubApi(`repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const parentCommitSha = refData.object.sha;
  console.log(`Parent commit SHA: ${parentCommitSha}`);

  // 2. Collect all local files
  const files = getAllFiles(ROOT);
  console.log(`Found ${files.length} project files to commit.`);

  // 3. Create blobs for each file in batches
  const treeItems = [];
  const BATCH_SIZE = 8;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (file) => {
      const fullPath = path.join(ROOT, file);
      const contentBuffer = fs.readFileSync(fullPath);
      const contentBase64 = contentBuffer.toString('base64');
      const blob = await githubApi(`repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: contentBase64,
          encoding: 'base64',
        }),
      });
      treeItems.push({
        path: file,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }));
    process.stdout.write(`\rUploaded blobs: ${Math.min(i + BATCH_SIZE, files.length)} / ${files.length}`);
  }
  console.log('\nAll blobs created.');

  // 4. Create new tree
  console.log('Creating Git tree...');
  const tree = await githubApi(`repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      tree: treeItems,
    }),
  });
  console.log(`Tree created with SHA: ${tree.sha}`);

  // 5. Create commit
  console.log('Creating commit...');
  const commitMessage = 'Upgrade OFFGRID: Enterprise Emergency Notification, SMTP & Intelligent Communication, and Advanced Logout & Session Security System';
  const commit = await githubApi(`repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: [parentCommitSha],
    }),
  });
  console.log(`Commit created with SHA: ${commit.sha}`);

  // 6. Update reference
  console.log(`Updating ref heads/${BRANCH}...`);
  await githubApi(`repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commit.sha,
      force: false,
    }),
  });

  console.log(`\nSUCCESS! Pushed to https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
}

main().catch((err) => {
  console.error('\nPush failed:', err.message);
  process.exit(1);
});
