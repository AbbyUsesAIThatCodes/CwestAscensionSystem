import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTone, rankNumeral } from '../public/rank-display.js';

test('Ascension markers use named sublevels, not the overall ladder position', () => {
  const badge = { ranks: ['Introduced', 'Beginner I', 'Beginner II', 'Beginner III', 'Intermediate I', 'Intermediate II', 'Intermediate III', 'Advanced I', 'Advanced II', 'Advanced III', 'Obsidian I', 'Obsidian II', 'Obsidian III', 'Obsidian Mastery'] };
  assert.equal(rankNumeral(2, badge), 'I');
  assert.equal(rankNumeral(6, badge), 'II');
  assert.equal(rankNumeral(13, badge), 'III');
  assert.equal(rankNumeral(1, badge), '');
  assert.equal(rankNumeral(14, badge), '');
  assert.equal(rankTone(badge, 2), '#dfbf70');
  assert.equal(rankTone(badge, 8), '#ee657b');
  assert.equal(rankTone(badge, 11), '#bc8bff');
});

test('short custom ladders preserve their ordinal and non-color identity', () => {
  const badge = { ranks: ['Beginning', 'Developing', 'Consistent'] };
  assert.equal(rankNumeral(0, badge), '');
  assert.equal(rankNumeral(1, badge), 'I');
  assert.equal(rankNumeral(3, badge), 'III');
});
