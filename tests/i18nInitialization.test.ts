import assert from 'node:assert/strict';
import test from 'node:test';

test('language detection and switching work when browser preference writes fail', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map([['i18nextLng', 'en']]);
  const writes: string[] = [];
  let writable = false;
  const browser = {
    parent: undefined as unknown,
    location: {pathname: '/link', search: '?lang=zh'},
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem(key: string, value: string) {
        writes.push(key);
        if (!writable) throw new DOMException('Fixture storage full', 'QuotaExceededError');
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key),
    },
  };
  browser.parent = browser;
  Object.defineProperty(globalThis, 'window', {configurable: true, value: browser});
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const {default: i18n} = await import('../src/i18n');
  assert.equal(i18n.language, 'zh');
  assert.deepEqual(writes, ['i18nextLng']);
  browser.location.search = '';
  await i18n.changeLanguage();
  assert.equal(i18n.language, 'en');
  assert.deepEqual(writes, ['i18nextLng']);
  await i18n.changeLanguage('id');
  assert.equal(i18n.language, 'id');
  assert.equal(values.get('i18nextLng'), 'en');
  writable = true;
  await i18n.changeLanguage('id');
  await i18n.changeLanguage('id');
  assert.equal(values.get('i18nextLng'), 'id');
  assert.deepEqual(writes, ['i18nextLng', 'i18nextLng', 'i18nextLng']);
});
