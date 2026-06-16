const fs = require('fs');
const path = 'd:/Patient/backend/controllers/appointment.controller.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Notification.create recipient -> userId
content = content.replace(/recipient:/g, 'userId:');

// 2. Fix doctorProfile.user -> doctorProfile.userId
content = content.replace(/doctorProfile\.user/g, 'doctorProfile.userId');

// 3. Fix patientProfile.user -> patientProfile.userId
content = content.replace(/patientProfile\.user/g, 'patientProfile.userId');

// 4. Fix appointment.doctorId.user -> appointment.doctorId.userId
content = content.replace(/appointment\.doctorId\.user/g, 'appointment.doctorId.userId');

// 5. Fix appointment.patientId.user -> appointment.patientId.userId
content = content.replace(/appointment\.patientId\.user/g, 'appointment.patientId.userId');

// 6. Fix populate select fields
content = content.replace(/select: 'fullName specialization clinicName photo user'/g, "select: 'fullName specialization clinicName photo userId'");
content = content.replace(/select: 'fullName user'/g, "select: 'fullName userId'");
content = content.replace(/select: 'user fullName'/g, "select: 'userId fullName'");
content = content.replace(/select: 'fullName specialization user'/g, "select: 'fullName specialization userId'");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed appointment.controller.js');
