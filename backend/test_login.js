async function testLogin() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@mydentist.com',
        password: 'password123'
      })
    });
    const data = await res.json();
    console.log('Login Result:', data);
  } catch (err) {
    console.error('Login Failed!', err);
  }
}

testLogin();
