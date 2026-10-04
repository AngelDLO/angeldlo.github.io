import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneState, scrollProgress, renderScale } from '../src/story.js';
test('The story moves from a luminous whole to a moon, open shell and orbital core',()=>{
  assert.deepEqual([sceneState(0).moon,sceneState(0).opening,sceneState(0).orbit],[0,0,0]);
  assert.deepEqual([sceneState(1).moon,sceneState(1).opening],[1,0]);
  assert.equal(sceneState(2).opening,1);assert.equal(sceneState(3).orbit,1);
  assert.equal(sceneState(4).exit,1);
});
test('Scrolling backwards exactly restores every stage; out-of-range scroll is bounded',()=>{
  const forward=Array.from({length:401},(_,i)=>sceneState(i/100));
  for(let i=400;i>=0;i--)assert.deepEqual(sceneState(i/100),forward[i]);
  assert.deepEqual(sceneState(-20),sceneState(0));assert.deepEqual(sceneState(100),sceneState(4));
  for(const s of forward)for(const value of Object.values(s))assert.ok(Number.isFinite(value));
});
test('Chapter positions follow measured section anchors, including uneven mobile heights',()=>{
  const anchors=[0,850,1740,2700,3590];
  assert.equal(scrollProgress(-10,anchors),0);assert.equal(scrollProgress(1295,anchors),1.5);
  assert.equal(scrollProgress(3590,anchors),4);assert.equal(scrollProgress(9999,anchors),4);
});
test('Canvas resolution remains within the pixel budget on dense and large displays',()=>{
  for(const [w,h,dpr] of [[390,844,3],[1440,900,2],[3840,2160,3]]){
    const ratio=renderScale(w,h,dpr);assert.ok(w*h*ratio*ratio<=2200001);assert.ok(ratio<=dpr);
  }
});
