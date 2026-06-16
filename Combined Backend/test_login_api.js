const http = require('http');

const postData = JSON.stringify({ email: 'test123@gmail.com', password: 'test123' });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
    catch(e) { console.log(data); }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(postData);
req.end();
