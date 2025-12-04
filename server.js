const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const usersFilePath = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function initializeUsersFile() {
  if (!fs.existsSync(usersFilePath)) {
    const initialData = { users: [], nextId: 1 };
    fs.writeFileSync(usersFilePath, JSON.stringify(initialData, null, 2));
    console.log('users.json created');
  } else {
    console.log('users.json already exists');
  }
}

function readUsers() {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users.json:', err);
    return { users: [], nextId: 1 };
  }
}

function writeUsers(data) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing users.json:', err);
  }
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ================== ROUTES ==================

// Đăng ký (CHỈ name, email, password - KHÔNG preferences)
app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập họ và tên' });
  }

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Mật khẩu không khớp' });
  }

  const data = readUsers();

  if (data.users.some(u => u.email === email)) {
    return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
  }

  const newUser = {
    id: data.nextId,
    firstName,
    lastName,
    email,
    phone: phone || '',
    password: hashPassword(password),
    // KHÔNG CÓ preferences ở đây
    preferences: [],
    dietaryRestrictions: [],
    cuisineTypes: [],
    priceRange: '',
    minRating: 3.0,
    hasPreferences: false, // Flag để biết user đã chọn preferences chưa
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  data.nextId += 1;
  writeUsers(data);

  return res.status(201).json({
    success: true,
    message: 'Tài khoản được tạo thành công!',
    userId: newUser.id
  });
});

// Đăng nhập
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
  }

  const data = readUsers();
  const user = data.users.find(u => u.email === email);

  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
  }

  return res.json({
    success: true,
    message: 'Đăng nhập thành công!',
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      hasPreferences: user.hasPreferences || false
    }
  });
});

// 📌 API MỚI: Cập nhật preferences
app.post('/api/auth/preferences', (req, res) => {
  const { userId, preferences, dietaryRestrictions, cuisineTypes, priceRange, minRating } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'Thiếu userId' });
  }

  const data = readUsers();
  const userIndex = data.users.findIndex(u => u.id === parseInt(userId));

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'User không tìm thấy' });
  }

  // Update preferences
  data.users[userIndex].preferences = Array.isArray(preferences) ? preferences : [];
  data.users[userIndex].dietaryRestrictions = Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [];
  data.users[userIndex].cuisineTypes = Array.isArray(cuisineTypes) ? cuisineTypes : [];
  data.users[userIndex].priceRange = priceRange || '';
  data.users[userIndex].minRating = minRating || 3.0;
  data.users[userIndex].hasPreferences = true; // Đánh dấu đã chọn

  writeUsers(data);

  return res.json({
    success: true,
    message: 'Preferences đã được cập nhật!',
    user: data.users[userIndex]
  });
});

// Get user info (có thể dùng để lấy preferences)
app.get('/api/users/:id', (req, res) => {
  const data = readUsers();
  const user = data.users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User không tìm thấy' });
  }

  const { password, ...userWithoutPassword } = user;
  return res.json({ success: true, user: userWithoutPassword });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'restaurant_login.html'));
});

// Start server
app.listen(PORT, () => {
  initializeUsersFile();
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`User data stored in: ${usersFilePath}`);
});

process.on('SIGINT', () => {
  console.log('\nServer stopped');
  process.exit(0);
});
