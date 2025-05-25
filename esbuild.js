const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyL10nFiles() {
  console.log('Copying localization files...');
  
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  const nlsFiles = fs.readdirSync('.').filter(f => f.startsWith('package.nls'));
  for (const file of nlsFiles) {
    fs.copyFileSync(file, path.join('dist', file));
    console.log(`Copied: ${file} -> dist/${file}`);
  }
  
  const distL10nDir = path.join('dist', 'l10n');
  if (!fs.existsSync(distL10nDir)) {
    fs.mkdirSync(distL10nDir, { recursive: true });
  }
  
  const sourceL10nDir = path.join('.', 'l10n');
  if (fs.existsSync(sourceL10nDir)) {
    const l10nFiles = fs.readdirSync(sourceL10nDir);
    for (const file of l10nFiles) {
      fs.copyFileSync(
        path.join(sourceL10nDir, file),
        path.join(distL10nDir, file)
      );
      console.log(`Copied: l10n/${file} -> dist/l10n/${file}`);
    }
  }
}


async function main() {
  copyL10nFiles();

  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'warning',    plugins: [
      esbuildProblemMatcherPlugin,
    ]
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location === null) { return; }
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
