import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrollIntoView at all (unlike a real browser) -
// components that call it (e.g. auto-scrolling a chat message list) throw
// without this. A no-op is fine here since tests don't assert on scroll
// position.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
