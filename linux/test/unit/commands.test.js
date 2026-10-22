import {test, assert} from './harness.js';
import {parseCommand} from '../../app/src/commands.js';

test('comandos simples e com campos', () => {
    assert.deepEqual(parseCommand('{"name":"playPause"}'), {name: 'playPause'});
    assert.deepEqual(parseCommand({name: 'seek', seconds: 60}), {name: 'seek', seconds: 60});
    assert.deepEqual(parseCommand({name: 'seekFraction', fraction: 0.75}), {name: 'seekFraction', fraction: 0.75});
    assert.deepEqual(parseCommand({name: 'playSearchResult', index: 0, videoID: 'dQw4w9WgXcQ'}),
        {name: 'playSearchResult', index: 0, videoID: 'dQw4w9WgXcQ'});
});

test('campos extras são descartados', () => {
    assert.deepEqual(parseCommand({name: 'next', js: 'alert(1)'}), {name: 'next'});
});

test('comandos desconhecidos ou malformados são recusados', () => {
    assert.equal(parseCommand('nada'), null);
    assert.equal(parseCommand('{"name":"rodarJS"}'), null);
    assert.equal(parseCommand({name: 'toString'}), null);
    assert.equal(parseCommand({name: 'seek', seconds: -1}), null);
    assert.equal(parseCommand({name: 'seek', seconds: '60'}), null);
    assert.equal(parseCommand({name: 'seekFraction', fraction: 1.5}), null);
    assert.equal(parseCommand({name: 'setVolume', value: 101}), null);
    assert.equal(parseCommand({name: 'playQueueItem', index: 1.5}), null);
    assert.equal(parseCommand({name: 'search', query: '   '}), null);
    assert.equal(parseCommand({name: 'playSearchResult', index: 0, videoID: "x'); alert(1); ('"}), null);
    assert.equal(parseCommand(null), null);
});
