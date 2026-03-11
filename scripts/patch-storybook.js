/**
 * Patches @storybook/react-native and @storybook/addon-ondevice-backgrounds
 * to add null guards that prevent crashes when no story is selected yet.
 *
 * Run:  node scripts/patch-storybook.js
 * Safe: idempotent — skips already-patched files.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function patch(filePath, description, find, replace) {
  const full = path.join(__dirname, '..', filePath);
  let content = fs.readFileSync(full, 'utf8');

  if (content.includes(replace)) {
    console.log('[SKIP]  Already patched:', description);
    return;
  }
  if (!content.includes(find)) {
    console.error('[FAIL]  Pattern not found in:', filePath);
    process.exit(1);
  }
  fs.writeFileSync(full, content.replace(find, replace), 'utf8');
  console.log('[OK]    Patched:', description);
}

// ── Patch 1: V6.js ────────────────────────────────────────────────────────────
//
// PROBLEM: fromId() calls getStoryContext(this._idToPrepared[id]) without
// checking if _idToPrepared[id] exists.  When a story hasn't been prepared yet
// (async loadStory not yet resolved) the arg is undefined, which causes:
//   "TypeError: Cannot read property 'id' of undefined"
//
// FIX: Guard against undefined before passing to getStoryContext.
//
// NOTE: A previous sed run left literal backslash-n (\+n) instead of real
// newlines in this file.  The find string below corrects that broken state.

// The broken sed output has literal \n (backslash + char 'n') — represented in
// a JS string as '\\n'.
const V6_BROKEN_FIND =
  'const prepared = this._idToPrepared[id];\\n' +
  '          if (!prepared) return null;\\n' +
  '          return this._preview.storyStore.getStoryContext(prepared);';

const V6_ORIGINAL_FIND =
  'return this._preview.storyStore.getStoryContext(this._idToPrepared[id]);';

const V6_REPLACE =
  'const prepared = this._idToPrepared[id];\n' +
  '          if (!prepared) return null;\n' +
  '          return this._preview.storyStore.getStoryContext(prepared);';

const v6Path = 'node_modules/@storybook/react-native/dist/V6.js';
const v6Content = fs.readFileSync(path.join(__dirname, '..', v6Path), 'utf8');

if (v6Content.includes(V6_REPLACE)) {
  console.log('[SKIP]  Already patched: V6.js fromId null guard');
} else if (v6Content.includes(V6_BROKEN_FIND)) {
  // Fix the broken sed state — replace literal \n with real newlines
  const fixed = v6Content.replace(V6_BROKEN_FIND, V6_REPLACE);
  fs.writeFileSync(path.join(__dirname, '..', v6Path), fixed, 'utf8');
  console.log('[OK]    Fixed broken V6.js patch (literal \\n → real newlines)');
} else if (v6Content.includes(V6_ORIGINAL_FIND)) {
  const fixed = v6Content.replace(V6_ORIGINAL_FIND, V6_REPLACE);
  fs.writeFileSync(path.join(__dirname, '..', v6Path), fixed, 'utf8');
  console.log('[OK]    Patched V6.js fromId null guard');
} else {
  console.error('[FAIL]  V6.js: could not find any expected pattern');
  process.exit(1);
}

// ── Patch 2: BackgroundPanel.js ───────────────────────────────────────────────
//
// PROBLEM: BackgroundPanel calls store.fromId(storyId) and immediately accesses
// story.parameters without checking for null.  fromId() returns null when no
// story has been prepared, crashing with:
//   "TypeError: Cannot read property 'id' of undefined"
//
// FIX: Guard getSelection() result and the story before accessing .parameters.

patch(
  'node_modules/@storybook/addon-ondevice-backgrounds/dist/BackgroundPanel.js',
  'BackgroundPanel null guard',
  // ── find ──
  '    const storyId = store.getSelection().storyId;\n' +
  '    const story = store.fromId(storyId);\n' +
  '    const backgrounds = story.parameters[constants_1.PARAM_KEY];',
  // ── replace ──
  '    const selection = store.getSelection();\n' +
  '    if (!selection || !selection.storyId) return null;\n' +
  '    const story = store.fromId(selection.storyId);\n' +
  '    if (!story) return null;\n' +
  '    const backgrounds = story.parameters[constants_1.PARAM_KEY];',
);

console.log('\nAll patches applied successfully.');
