export const scrapeConfig = {
  type: 'scrape',
  title: 'Scrape URL',
  category: 'io',
  fields: [
    { name: 'url', label: 'URL', kind: 'text', default: 'https://' },
  ],
  handles: [
    // Optional: wire a URL in from upstream (overrides the field at run time).
    { id: 'url', type: 'target', position: 'left', dataType: 'Text' },
    // The scraped page text, ready to feed a Text/LLM/Extract node.
    { id: 'content', type: 'source', position: 'right', dataType: 'Text' },
  ],
};
