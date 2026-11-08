/**
 * Inject shared admin sidebar into each admin HTML page (build-time).
 * Source of truth: public/admin/_sidebar.html (from orders page / index.html)
 * Result is baked into HTML → sidebar paints immediately (no runtime fetch).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adminDir = path.join(root, 'public', 'admin');
const fragmentPath = path.join(adminDir, '_sidebar.html');

const START = '<!-- ADMIN_SIDEBAR_START -->';
const END = '<!-- ADMIN_SIDEBAR_END -->';

const SKIP = new Set(['m.html', '_sidebar.html']);

/** Detail pages share active nav with parent list page */
const ACTIVE_ALIAS = {
  'ctv-detail.html': 'ctv.html'
};

const INACTIVE =
  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 font-medium transition-colors hover:bg-gray-50';
const ACTIVE =
  'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 font-medium transition-colors';

function resolveActiveNav(fileName) {
  return ACTIVE_ALIAS[fileName] || fileName;
}

function withActiveState(sidebarHtml, activeNav) {
  return sidebarHtml.replace(
    /<a\s+([^>]*?)>/g,
    (full, attrs) => {
      const navMatch = attrs.match(/\bdata-nav="([^"]+)"/);
      if (!navMatch) return full;
      const isActive = navMatch[1] === activeNav;
      let nextAttrs = attrs;
      if (/\bclass="[^"]*"/.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bclass="[^"]*"/, `class="${isActive ? ACTIVE : INACTIVE}"`);
      } else {
        nextAttrs += ` class="${isActive ? ACTIVE : INACTIVE}"`;
      }
      return `<a ${nextAttrs}>`;
    }
  );
}

function wrapSidebar(sidebarHtml) {
  const body = sidebarHtml.trim();
  return `${START}\n${body}\n${END}`;
}

/** Replace marked block, or first fixed left sidebar <aside> */
function replaceSidebar(html, wrapped) {
  const marked = new RegExp(
    `${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`,
    'm'
  );
  if (marked.test(html)) {
    return html.replace(marked, wrapped);
  }

  // Prefer comment + aside, else aside alone
  const withComment =
    /(?:<!--\s*Sidebar\s*-->\s*)?<aside\b[^>]*\bfixed\b[^>]*\bleft-0\b[^>]*>[\s\S]*?<\/aside>/i;
  if (withComment.test(html)) {
    return html.replace(withComment, wrapped);
  }

  throw new Error('No sidebar <aside> found to replace');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  if (!fs.existsSync(fragmentPath)) {
    console.error(`Missing fragment: ${fragmentPath}`);
    process.exit(1);
  }

  const fragment = fs.readFileSync(fragmentPath, 'utf8');
  if (!fragment.includes('<aside')) {
    console.error('_sidebar.html must contain an <aside>');
    process.exit(1);
  }

  const files = fs
    .readdirSync(adminDir)
    .filter((f) => f.endsWith('.html') && !SKIP.has(f))
    .sort();

  let updated = 0;
  let unchanged = 0;

  for (const file of files) {
    const full = path.join(adminDir, file);
    const before = fs.readFileSync(full, 'utf8');
    const activeNav = resolveActiveNav(file);
    const sidebar = withActiveState(fragment, activeNav);
    const wrapped = wrapSidebar(sidebar);

    let after;
    try {
      after = replaceSidebar(before, wrapped);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }

    if (after === before) {
      unchanged += 1;
      console.log(`· ${file} (unchanged, active=${activeNav})`);
      continue;
    }

    fs.writeFileSync(full, after, 'utf8');
    updated += 1;
    console.log(`✓ ${file} (active=${activeNav})`);
  }

  console.log(`\nAdmin sidebar inject done: ${updated} updated, ${unchanged} unchanged, ${files.length} total`);
}

main();
