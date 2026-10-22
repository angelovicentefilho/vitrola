import {test, assert} from './harness.js';

test('o harness compara valores e estruturas', () => {
    assert.ok(true);
    assert.equal(1 + 1, 2);
    assert.deepEqual({a: [1, 2]}, {a: [1, 2]});
});

test('o harness acusa diferenças', () => {
    let threw = false;
    try {
        assert.equal('a', 'b');
    } catch {
        threw = true;
    }
    assert.ok(threw, 'assert.equal deveria falhar com valores diferentes');
});
