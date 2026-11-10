import test from 'node:test';
import assert from 'node:assert/strict';
import { demoModel, mutate, studentView } from '../server/model.mjs';
const actor = { id: 'review-teacher', name: 'Fictional Review Teacher' };

test('visibility overrides do not transfer to reassigned or removed placements', () => {
  const m = demoModel();
  const override = (nodeId, visibility = 'show') => mutate(m, 'overrides', {
    studentId: 'student-2', treeId: 'tree-1', nodeId, visibility,
  }, actor);
  override('node-design');
  override('node-code', 'hide');
  override('node-story');
  const tree = structuredClone(m.trees[0]);
  tree.nodes[0].badgeId = 'yet';
  tree.nodes[0].rule = { type: 'badge', badgeId: 'code', minRank: 4 };
  tree.nodes = tree.nodes.filter((n) => n.id !== 'node-story');
  mutate(m, 'trees', tree, actor);
  assert.deepEqual(m.overrides.map((o) => o.nodeId), ['node-code']);
  assert.ok(!studentView(m, 'student-2').badges.some((b) => b.id === 'yet'));
  assert.ok(!studentView(m, 'student-2').badges.some((b) => b.id === 'code'));
  // Reusing the removed ID does not resurrect its prior visibility grant.
  tree.nodes.push({ id: 'node-story', badgeId: 'leadership', x: 20, y: 20,
    showName: true, rule: { type: 'badge', badgeId: 'code', minRank: 4 } });
  mutate(m, 'trees', tree, actor);
  assert.ok(!studentView(m, 'student-2').badges.some((b) => b.id === 'leadership'));
});

test('anonymous silhouettes exclude identifying history after removal while teacher audit survives', () => {
  const m = demoModel();
  const tree = structuredClone(m.trees[0]);
  tree.nodes.find((n) => n.badgeId === 'story').showName = false;
  mutate(m, 'trees', tree, actor);
  mutate(m, 'awards', { studentIds: ['student-1'], badgeId: 'story', rank: 2,
    publicNote: 'Identifying Storytelling note', privateNote: 'Teacher-only detail' }, actor);
  assert.equal(studentView(m, 'student-1').history.filter((h) => h.badgeId === 'story').length, 1);
  mutate(m, 'awards', { studentIds: ['student-1'], badgeId: 'story', rank: 0 }, actor);
  const view = studentView(m, 'student-1');
  assert.equal(view.badges.find((b) => b.id === 'story').concealed, true);
  assert.ok(!view.history.some((h) => h.badgeId === 'story'));
  assert.ok(!JSON.stringify(view).includes('Identifying Storytelling note'));
  assert.ok(!JSON.stringify(view).includes('Teacher-only detail'));
  assert.equal(m.history.filter((h) => h.badgeId === 'story').length, 2);
  assert.equal(m.history[0].next.privateNote, 'Teacher-only detail');
  // Named silhouettes still have their own public journey, never private notes.
  tree.nodes.find((n) => n.badgeId === 'story').showName = true;
  mutate(m, 'trees', tree, actor);
  assert.equal(studentView(m, 'student-1').history.filter((h) => h.badgeId === 'story').length, 2);
});

test('explicit prerequisites cannot reference archived badges or be archived while referenced', () => {
  const m = demoModel();
  const referenced = structuredClone(m.badges.find((b) => b.id === 'design'));
  assert.throws(() => mutate(structuredClone(m), 'badges', {
    ...referenced, archived: true,
  }, actor), /Edit the tree rules before archiving/);
  const archived = structuredClone(m.badges.find((b) => b.id === 'yet'));
  mutate(m, 'badges', { ...archived, archived: true }, actor);
  const tree = structuredClone(m.trees[0]);
  tree.nodes[0].rule = { type: 'any', rules: [
    { type: 'badge', badgeId: 'yet', minRank: 1 },
    { type: 'badge', badgeId: 'code', minRank: 1 },
  ] };
  assert.throws(() => mutate(structuredClone(m), 'trees', tree, actor), /archived badges/);
  // First remove the explicit reference, then archive; historical awards survive.
  const clean = demoModel();
  clean.trees[0].nodes.find((n) => n.badgeId === 'capstone').rule = null;
  const awardBefore = structuredClone(clean.awards);
  mutate(clean, 'badges', { ...referenced, archived: true }, actor);
  assert.deepEqual(clean.awards, awardBefore);
});

test('badge deletion rejects dangling tree and course mapping references', () => {
  const m = demoModel();
  assert.throws(() => mutate(structuredClone(m), 'badges', {}, actor, 'web'), /Invalid tree node/);
  m.mappings.push({ badgeId: 'yet', courseCode: '340110', reference: '', notes: '' });
  assert.throws(() => mutate(structuredClone(m), 'badges', {}, actor, 'yet'), /course mappings before deleting/);
  m.mappings = [];
  assert.doesNotThrow(() => mutate(m, 'badges', {}, actor, 'yet'));
});
