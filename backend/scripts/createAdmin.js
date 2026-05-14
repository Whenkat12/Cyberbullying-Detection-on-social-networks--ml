import User from '../models/User.js';
import bcrypt from 'bcryptjs';

export const createAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cybersentinel.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      profile: {
        firstName: 'System',
        lastName: 'Administrator'
      },
      emailVerified: true,
      isActive: true
    });

    await adminUser.save();
    
    console.log('✅ Admin user created successfully');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('⚠️  Please change the default password after first login');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    throw error;
  }
};

export default createAdminUser;