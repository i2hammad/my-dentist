const fs = require('fs');

const collection = {
  "info": {
    "name": "MyDentist Patient App API",
    "description": "Collection of ONLY the endpoints required for the Patient Application based on the UI mockups. No doctor/admin endpoints included.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": []
};

// Valid 24-character hex placeholder for MongoDB ObjectIds
const DUMMY_ID = "5f8d0d55b54764421b7156d9";

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
    createReq("Register Patient", "POST", "auth/register", false, { email: "patient1@example.com", password: "password123", role: "patient" }),
    createReq("Login", "POST", "auth/login", false, { email: "patient1@example.com", password: "password123" }),
    createReq("Forgot Password", "POST", "auth/forgot-password", false, { email: "patient1@example.com" })
  ]
});

// 2. Patient Profile
collection.item.push({
  name: "2. Patient Profile",
  item: [
    createReq("Get My Profile", "GET", "users/me", true),
    createReq("Create Patient Profile", "POST", "users/patient-profile", true, { fullName: "Ahmad Khan", mobileNumber: "03001234567", dateOfBirth: "1990-01-01", gender: "male", city: "Lahore" }),
    createReq("Update Patient Profile", "PUT", "users/patient-profile", true, { city: "Islamabad" })
  ]
});

// 3. Home / Search Doctors
collection.item.push({
  name: "3. Find Doctors",
  item: [
    createReq("Get All Doctors", "GET", "doctors", false),
    createReq("Search Doctors", "GET", "doctors/search", false, null, [{ key: "q", value: "Ali" }]),
    createReq("Get Nearby Doctors", "GET", "doctors/nearby", false, null, [{ key: "lat", value: "31.5204" }, { key: "lng", value: "74.3587" }, { key: "radius", value: "10" }])
  ]
});

// 4. View Doctor Details
collection.item.push({
  name: "4. Doctor Details",
  item: [
    createReq("Get Doctor By ID", "GET", `doctors/${DUMMY_ID}`, false),
    createReq("Get Doctor Services", "GET", `doctors/${DUMMY_ID}/stats`, false),
    createReq("Get Doctor Gallery", "GET", `gallery/doctor/${DUMMY_ID}`, false),
    createReq("Get Doctor Reviews", "GET", `reviews/doctor/${DUMMY_ID}`, false)
  ]
});

// 5. Appointments
collection.item.push({
  name: "5. Appointments",
  item: [
    createReq("Book Appointment", "POST", "appointments", true, { doctorId: DUMMY_ID, treatmentType: "Teeth Cleaning", description: "Routine checkup", date: "2026-06-25", time: "10:00 AM", duration: 30 }),
    createReq("Get My Appointments", "GET", "appointments/my", true),
    createReq("Reschedule Appointment", "PUT", `appointments/${DUMMY_ID}/reschedule`, true, { newDate: "2026-06-26", newTime: "11:00 AM" }),
    createReq("Cancel Appointment", "PUT", `appointments/${DUMMY_ID}/cancel`, true)
  ]
});

// 6. Favorites
collection.item.push({
  name: "6. Favorites",
  item: [
    createReq("Add Doctor to Favorites", "POST", `favorites/${DUMMY_ID}`, true),
    createReq("Get My Favorites", "GET", "favorites", true),
    createReq("Remove Doctor from Favorites", "DELETE", `favorites/${DUMMY_ID}`, true)
  ]
});

// 7. Chat
collection.item.push({
  name: "7. Chat",
  item: [
    createReq("Send Message to Doctor", "POST", "chat/messages", true, { receiverId: DUMMY_ID, message: "Hello Doctor, what time should I come?" }),
    createReq("Get My Chat Conversations", "GET", "chat/conversations", true),
    createReq("Get Messages with Doctor", "GET", `chat/messages/${DUMMY_ID}`, true)
  ]
});

// 8. Bills & Payments
collection.item.push({
  name: "8. Bills & Payments",
  item: [
    createReq("Get My Bills", "GET", "bills/my", true),
    createReq("Pay Bill", "PUT", `bills/${DUMMY_ID}/pay`, true, { paymentMethodId: DUMMY_ID }),
    createReq("Add Payment Method", "POST", "payments/methods", true, { type: "visa", cardNumber: "4242424242424242", expiryDate: "12/28", cardHolderName: "Ahmad Khan" }),
    createReq("Get My Payment Methods", "GET", "payments/methods", true)
  ]
});

// 9. Reviews & Rewards
collection.item.push({
  name: "9. Reviews & Rewards",
  item: [
    createReq("Write Review for Doctor", "POST", "reviews", true, { doctorId: DUMMY_ID, rating: 5, comment: "Excellent experience!" }),
    createReq("Get My Rewards", "GET", "rewards/my", true)
  ]
});

// 10. Notifications
collection.item.push({
  name: "10. Notifications",
  item: [
    createReq("Get My Notifications", "GET", "notifications", true),
    createReq("Mark All Notifications Read", "PUT", "notifications/read-all", true)
  ]
});

fs.writeFileSync('d:\\Patient\\MyDentist_Patient_App_Collection.json', JSON.stringify(collection, null, 2));
console.log('Patient App Collection generated successfully!');
