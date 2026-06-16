const http = require('http');
const options = { hostname: 'localhost', port: 5000, path: '/api/doctors', method: 'GET' };
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); } 
    catch(e) { console.log(data); }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();
