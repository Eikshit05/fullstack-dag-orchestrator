export const httpConfig = {
  type: 'http',
  title: 'HTTP Request',
  category: 'io',
  fields: [
    { name: 'url', label: 'URL', kind: 'text', default: 'https://' },
    { name: 'method', label: 'Method', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
  ],
  handles: [{ id: 'response', type: 'source', position: 'right' }],
};
