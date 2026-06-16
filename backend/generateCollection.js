const fs = require('fs');

const collection = {
  "info": {
    "name": "MyDentist API Complete",
    "description": "Full collection of all MyDentist API endpoints.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": []
};

// Helper to create a request
const createReq = (name, method, path, requiresAuth = false, body = null, query = []) => {
  const req = {
    name,
    request: {
      method,
      header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: {
        raw: `http://localhost:5000/api/${path}${query.length ? '?' + query.map(q => `${q.key}=${q.value}`).join('&') : ''}`,
        protocol: "http",
        host: ["localhost"],
        port: "5000",
        path: ["api", ...path.split('/')],
        query: query
      }
    },
    response: []
  };

  if (requiresAuth) {
    req.request.auth = {
      type: "bearer",
      bearer: [{ key: "token", value: "{{YOUR_ACCESS_TOKEN_HERE}}", type: "string" }]
    };
  }

  if (body) {
    req.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
  }

  return req;
};

// 1. Auth
collection.item.push({
  name: "1. Authentication",
  item: [
    createReq("Login", "POST", "auth/login", false, { email: "patient@example.com", password: "password123" }),
    createReq("Register", "POST", "auth/register", false, { email: "new@example.com", password: "password123", role: "patient" }),
    createReq("Refresh Token", "POST", "auth/refresh-token", false, { refreshToken: "YOUR_REFRESH_TOKEN" })
  ]
});

// 2. Users
collection.item.push({
  name: "2. Users",
  item: [
    createReq("Get My Profile", "GET", "users/me", true),
    createReq("Update Profile", "PUT", "users/me", true, { email: "updated@example.com" }),
    createReq("Create Patient Profile", "POST", "users/patient-profile", true, { fullName: "Test Patient", mobileNumber: "03001234567", dateOfBirth: "1995-01-01", gender: "male", city: "Lahore" })
  ]
});

// 3. Doctors
collection.item.push({
  name: "3. Doctors",
  item: [
    createReq("Get All Doctors", "GET", "doctors", false),
    createReq("Search Doctors", "GET", "doctors/search", false, null, [{ key: "q", value: "Ali" }]),
    createReq("Get Doctor By ID", "GET", "doctors/664c9d1e2f3a1b2c3d4e5f6g", false)
  ]
});

// 4. Treatments
collection.item.push({
  name: "4. Treatments",
  item: [
    createReq("Get Doctor Treatments", "GET", "treatments/doctor/664c9d1e2f3a1b2c3d4e5f6g", false),
    createReq("Create Treatment (Doctor only)", "POST", "treatments", true, { name: "Teeth Whitening", priceMin: 5000, priceMax: 15000 })
  ]
});

// 5. Appointments
collection.item.push({
  name: "5. Appointments",
  item: [
    createReq("Get My Appointments", "GET", "appointments/my", true),
    createReq("Book Appointment", "POST", "appointments", true, { doctorId: "PASTE_DOCTOR_ID", treatmentType: "Consultation", date: "2026-06-25", time: "10:00 AM", duration: 30 }),
    createReq("Cancel Appointment", "PUT", "appointments/PASTE_ID/cancel", true)
  ]
});

// 6. Bills
collection.item.push({
  name: "6. Bills",
  item: [
    createReq("Get My Bills", "GET", "bills/my", true),
    createReq("Get Bill Summary", "GET", "bills/summary", true),
    createReq("Create Bill (Doctor only)", "POST", "bills", true, { appointmentId: "PASTE_ID", patientId: "PASTE_ID", treatmentName: "Consultation", amount: 1500 }),
    createReq("Pay Bill", "PUT", "bills/PASTE_ID/pay", true)
  ]
});

// 7. Reviews
collection.item.push({
  name: "7. Reviews",
  item: [
    createReq("Get Doctor Reviews", "GET", "reviews/doctor/PASTE_DOCTOR_ID", false),
    createReq("Write Review", "POST", "reviews", true, { doctorId: "PASTE_ID", rating: 5, comment: "Great!" })
  ]
});

// 8. Rewards
collection.item.push({
  name: "8. Rewards",
  item: [
    createReq("Get My Rewards", "GET", "rewards/my", true),
    createReq("Redeem Points", "POST", "rewards/redeem", true, { pointsToRedeem: 100 })
  ]
});

// 9. Payments
collection.item.push({
  name: "9. Payments",
  item: [
    createReq("Get Payment Methods", "GET", "payments/methods", true),
    createReq("Add Payment Method", "POST", "payments/methods", true, { type: "visa", lastFourDigits: "4242", expiryDate: "12/28" })
  ]
});

// 10. Notifications
collection.item.push({
  name: "10. Notifications",
  item: [
    createReq("Get Notifications", "GET", "notifications", true),
    createReq("Mark All Read", "PUT", "notifications/read-all", true)
  ]
});

// 11. Chat
collection.item.push({
  name: "11. Chat",
  item: [
    createReq("Get Conversations", "GET", "chat/conversations", true),
    createReq("Send Message", "POST", "chat/messages", true, { receiverId: "PASTE_ID", message: "Hello!" })
  ]
});

// 12. Favorites
collection.item.push({
  name: "12. Favorites",
  item: [
    createReq("Get Favorites", "GET", "favorites", true),
    createReq("Add Favorite", "POST", "favorites/PASTE_DOCTOR_ID", true)
  ]
});

fs.writeFileSync('d:\\Patient\\MyDentist_Complete_Collection.json', JSON.stringify(collection, null, 2));
console.log('Collection generated successfully!');
