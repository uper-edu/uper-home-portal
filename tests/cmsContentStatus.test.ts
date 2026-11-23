import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { client } from '../src/cmsClient';
import { beginContentRead } from '../src/components/CmsContentStatus';

function contentWindow(t: TestContext, pathname: string) {
  const location = { pathname };
  const browser = Object.assign(new EventTarget(), { location });
  const dispatch = t.mock.method(browser, 'dispatchEvent');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  return { location, dispatches: () => dispatch.mock.callCount() };
}

test('a superseded CMS read cannot override the latest result for the same query and parameters', t => {
  const { dispatches } = contentWindow(t, '/news/example');
  const first = beginContentRead('article');
  const latest = beginContentRead('article');
  latest(false);
  first(true);
  assert.equal(dispatches(), 0);

  const retry = beginContentRead('article');
  retry(true);
  beginContentRead('article')(false);
  assert.equal(dispatches(), 2);
});

test('a CMS read that finishes on a different page cannot trigger that page’s failure notice', t => {
  const { location, dispatches } = contentWindow(t, '/');
  const finish = beginContentRead('homepage-news');
  location.pathname = '/enrollment';
  finish(true);
  assert.equal(dispatches(), 0);
});

test('the CMS client sets a deadline and treats an absent result as a failed read', async t => {
  const { dispatches } = contentWindow(t, '/news');
  const timeout = t.mock.method(AbortSignal, 'timeout');
  const fetchContent = t.mock.method(globalThis, 'fetch', async (..._args: Parameters<typeof fetch>) => Response.json({}));

  await assert.rejects(client.fetch('article', { slug: 'first' }), /Content unavailable/);
  assert.deepEqual(timeout.mock.calls[0].arguments, [15000]);
  assert.equal(fetchContent.mock.calls[0].arguments[1]?.signal, timeout.mock.calls[0].result);
  assert.equal(dispatches(), 1);

  fetchContent.mock.mockImplementation(async () => Response.json({ result: null }));
  assert.equal(await client.fetch('article', { slug: 'second' }), null);
  assert.equal(dispatches(), 1);
  assert.equal(await client.fetch('article', { slug: 'first' }), null);
  assert.equal(dispatches(), 2);
});
