// Só no GJS (usa GLib/Soup): gjs -m linux/test/unit/run-gjs.js
import GLib from 'gi://GLib';
import {test, assert} from './harness.js';
import {ImageCache} from '../../app/src/images.js';

const dir = GLib.dir_make_tmp('vitrola-capas-XXXXXX');

test('o nome do arquivo é o sha1 da URL, dentro da pasta de capas', () => {
    const cache = new ImageCache(dir);
    const url = 'https://lh3.googleusercontent.com/abc=w800-h800';
    const expected = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, url, -1);
    assert.equal(cache.pathFor(url), `${dir}/${expected}.jpg`);
    assert.ok(cache.pathFor(url) !== cache.pathFor(`${url}x`));
});

test('URL que não é https não baixa nada', async () => {
    const cache = new ImageCache(dir);
    assert.equal(await cache.fetch('file:///etc/passwd'), null);
    assert.equal(await cache.fetch('http://exemplo.com/a.jpg'), null);
    assert.equal(await cache.fetch(null), null);
});

test('imagem já baixada é reaproveitada sem rede', async () => {
    const cache = new ImageCache(dir);
    const url = 'https://exemplo.invalid/capa.jpg';
    GLib.file_set_contents(cache.pathFor(url), 'jpg');
    assert.equal(await cache.fetch(url), cache.pathFor(url));
});

test('falha de rede resolve null em vez de lançar erro', async () => {
    const cache = new ImageCache(dir);
    assert.equal(await cache.fetch('https://exemplo.invalid/nao-existe.jpg'), null);
});
